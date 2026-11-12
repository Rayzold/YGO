-- Card images: re-hosted from YGOPRODeck into the public `card-images` bucket by the
-- `sync-card-images` Edge Function (supabase/functions/sync-card-images).
--
-- pg_cron calls private.trigger_image_sync() every 2 minutes. It only calls the function while
-- cards are missing an image, and passes a one-time job token: the function cannot do anything
-- without a token that only the database can mint, so no secret has to be shared or stored.

create extension if not exists pg_net with schema extensions;

-- hardening (advisor 0028/0029): the sign-up trigger function must not be callable through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table if not exists public.card_images (
  card_id integer primary key references public.cards (id) on delete cascade,
  status text not null check (status in ('ok', 'missing', 'error')),
  attempts smallint not null default 1,
  synced_at timestamptz not null default now()
);
comment on table public.card_images is 'Image sync state; image URL: <project>/storage/v1/object/public/card-images/<card_id>.jpg';

alter table public.card_images enable row level security;
drop policy if exists "card_images: public read" on public.card_images;
create policy "card_images: public read" on public.card_images for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.card_images from anon, authenticated;

-- not exposed through the API
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.job_tokens (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Cards that still need an image (TCG first). Errors are retried hourly, up to 5 attempts.
create or replace view private.cards_needing_images as
select c.id, c.tcg, coalesce(i.attempts, 0) as attempts
from public.cards c
left join public.card_images i on i.card_id = c.id
where c.id > 0
  and not c.fake_password
  and (i.card_id is null or (i.status = 'error' and i.attempts < 5 and i.synced_at < now() - interval '1 hour'));

-- Called by the Edge Function with the token it received; returns its batch of work.
create or replace function public.claim_image_job(job_token uuid, max_rows integer default 120)
returns table (card_id integer, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.job_tokens t where t.token = job_token and t.created_at > now() - interval '15 minutes';
  if not found then
    raise exception 'invalid or expired job token' using errcode = '28000';
  end if;
  delete from private.job_tokens t where t.created_at < now() - interval '1 hour';
  return query
    select n.id, n.attempts from private.cards_needing_images n
    order by n.tcg desc, n.id
    limit least(greatest(max_rows, 1), 300);
end;
$$;
revoke execute on function public.claim_image_job(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_image_job(uuid, integer) to service_role;

-- Called by pg_cron: mint a token and invoke the function, only while there is work.
create or replace function private.trigger_image_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t uuid;
begin
  if not exists (select 1 from private.cards_needing_images) then
    return null;
  end if;
  insert into private.job_tokens default values returning token into t;
  return net.http_post(
    url := 'https://zbzvfkgutcqbyznswvqs.supabase.co/functions/v1/sync-card-images',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-token', t::text),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
end;
$$;
revoke execute on function private.trigger_image_sync() from public, anon, authenticated;

select cron.schedule('ygo-sync-card-images', '*/2 * * * *', $$select private.trigger_image_sync()$$);

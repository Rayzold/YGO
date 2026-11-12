-- Card database: every OCG/TCG card, loaded from the repo's `data` branch
-- (published nightly by .github/workflows/build-deploy.yml).
--
--   select public.refresh_card_data();       -- load if the data branch has a newer build
--   select public.refresh_card_data(true);   -- force a full reload
--
-- pg_cron checks hourly (only meta.json is fetched when nothing changed).

create extension if not exists http with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  -- card password (the number .ydk files use); brand-new cards without one get -konami_id
  id integer primary key,
  konami_id integer,          -- not unique: alternate artworks (Dark Magician, Polymerization) share it
  password integer unique,
  name text not null,
  -- names in other languages: de, es, fr, it, pt, ja, ja_romaji, ko, ko_rr, zh-TW, zh-CN
  names jsonb not null default '{}'::jsonb,
  card_type text not null check (card_type in ('Monster', 'Spell', 'Trap')),
  frame text,                 -- monster type line, e.g. "Zombie / Tuner / Effect"
  property text,              -- Spell/Trap property, e.g. "Quick-Play"
  attribute text,
  level smallint,
  rank smallint,
  link_rating smallint,
  link_arrows text[],
  atk integer,                -- null for "?" and Link DEF
  def integer,
  scale smallint,
  series text[] not null default '{}',
  mentions text[] not null default '{}',
  materials text,
  text text,
  pendulum_text text,
  -- mechanic tags from pipeline/tagger.py (search, mill, trig_sent_to_gy, hand_trap, ...)
  tags text[] not null default '{}',
  extra_deck boolean not null default false,
  tcg boolean not null default false,
  ocg boolean not null default false,
  -- 0 Forbidden, 1 Limited, 2 Semi-Limited, 3 Unlimited; null when not in that format / no upcoming list
  tcg_limit smallint check (tcg_limit between 0 and 3),
  tcg_next_limit smallint check (tcg_next_limit between 0 and 3),
  ocg_limit smallint check (ocg_limit between 0 and 3),
  ocg_next_limit smallint check (ocg_next_limit between 0 and 3),
  md_rarity text,
  fake_password boolean not null default false,
  src_hash text,              -- md5 of the source record, so unchanged cards are not rewritten
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(text, '') || ' ' || coalesce(pendulum_text, ''))
  ) stored
);
comment on table public.cards is 'Every Yu-Gi-Oh! OCG/TCG card. Loaded by refresh_card_data(); do not edit by hand.';

create index if not exists cards_konami_id_idx on public.cards (konami_id);
create index if not exists cards_name_trgm_idx on public.cards using gin (name extensions.gin_trgm_ops);
create index if not exists cards_fts_idx on public.cards using gin (fts);
create index if not exists cards_tags_idx on public.cards using gin (tags);
create index if not exists cards_series_idx on public.cards using gin (series);
create index if not exists cards_tcg_idx on public.cards (tcg, tcg_limit);

create table if not exists public.card_prints (
  id bigint generated always as identity primary key,
  card_id integer not null references public.cards (id) on delete cascade,
  region text not null check (region in ('en', 'ja')),   -- en = TCG, ja = OCG
  set_number text,
  set_name text,
  rarity text
);
create index if not exists card_prints_card_idx on public.card_prints (card_id);
create index if not exists card_prints_set_idx on public.card_prints (set_number);

create table if not exists public.card_data_meta (
  id boolean primary key default true check (id),
  built timestamptz,
  tcg_banlist date,
  tcg_upcoming date,
  ocg_banlist date,
  ocg_upcoming date,
  cards integer,
  tcg_cards integer,
  ocg_cards integer,
  prints integer,
  refreshed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Read-only for everyone; only refresh_card_data() (security definer) writes.
-- ---------------------------------------------------------------------------
alter table public.cards enable row level security;
alter table public.card_prints enable row level security;
alter table public.card_data_meta enable row level security;

drop policy if exists "cards: public read" on public.cards;
create policy "cards: public read" on public.cards for select to anon, authenticated using (true);
drop policy if exists "card_prints: public read" on public.card_prints;
create policy "card_prints: public read" on public.card_prints for select to anon, authenticated using (true);
drop policy if exists "card_data_meta: public read" on public.card_data_meta;
create policy "card_data_meta: public read" on public.card_data_meta for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.cards, public.card_prints, public.card_data_meta from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Loader
-- ---------------------------------------------------------------------------
create or replace function public.refresh_card_data(force boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base constant text := 'https://raw.githubusercontent.com/Rayzold/YGO/data/';
  res extensions.http_response;
  meta jsonb;
  data jsonb;
  changed integer;
  n_prints integer;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '180');

  select * into res from extensions.http_get(base || 'meta.json');
  if res.status <> 200 then
    raise exception 'meta.json: HTTP %', res.status;
  end if;
  meta := res.content::jsonb;
  if not force and exists (
    select 1 from public.card_data_meta m where m.built = (meta ->> 'built')::timestamptz
  ) then
    return 'up to date (built ' || (meta ->> 'built') || ')';
  end if;

  -- cards ---------------------------------------------------------------------
  select * into res from extensions.http_get(base || 'cards.json');
  if res.status <> 200 then
    raise exception 'cards.json: HTTP %', res.status;
  end if;
  data := res.content::jsonb;
  if jsonb_array_length(data) < 10000 then
    raise exception 'cards.json looks truncated (% cards); keeping the current data', jsonb_array_length(data);
  end if;

  -- a new card that received its password: drop its old placeholder row (id = -konami_id)
  delete from public.cards c
  using jsonb_to_recordset(data) as x(id integer, konami_id integer)
  where c.id < 0 and x.id > 0 and c.konami_id = x.konami_id;

  insert into public.cards as c (
    id, konami_id, password, name, names, card_type, frame, property, attribute, level, rank,
    link_rating, link_arrows, atk, def, scale, series, mentions, materials, text, pendulum_text, tags,
    extra_deck, tcg, ocg, tcg_limit, tcg_next_limit, ocg_limit, ocg_next_limit, md_rarity, fake_password,
    src_hash, updated_at
  )
  select
    x.id, x.konami_id, x.password, x.name, coalesce(x.names, '{}'::jsonb), x.card_type, x.frame, x.property,
    x.attribute, x.level, x.rank, x.link_rating, x.link_arrows, x.atk, x.def, x.scale,
    coalesce(x.series, '{}'), coalesce(x.mentions, '{}'), x.materials, x.text, x.pendulum_text,
    coalesce(x.tags, '{}'), coalesce(x.extra_deck, false), coalesce(x.tcg, false), coalesce(x.ocg, false),
    x.tcg_limit, x.tcg_next_limit, x.ocg_limit, x.ocg_next_limit, x.md_rarity, coalesce(x.fake_password, false),
    md5(e::text), now()
  from jsonb_array_elements(data) as e,
       jsonb_to_record(e) as x(
         id integer, konami_id integer, password integer, name text, names jsonb, card_type text,
         frame text, property text, attribute text, level smallint, rank smallint, link_rating smallint,
         link_arrows text[], atk integer, def integer, scale smallint, series text[], mentions text[],
         materials text, text text, pendulum_text text, tags text[], extra_deck boolean, tcg boolean,
         ocg boolean, tcg_limit smallint, tcg_next_limit smallint, ocg_limit smallint,
         ocg_next_limit smallint, md_rarity text, fake_password boolean
       )
  on conflict (id) do update set
    konami_id = excluded.konami_id, password = excluded.password, name = excluded.name,
    names = excluded.names, card_type = excluded.card_type, frame = excluded.frame,
    property = excluded.property, attribute = excluded.attribute, level = excluded.level,
    rank = excluded.rank, link_rating = excluded.link_rating, link_arrows = excluded.link_arrows,
    atk = excluded.atk, def = excluded.def, scale = excluded.scale, series = excluded.series,
    mentions = excluded.mentions, materials = excluded.materials, text = excluded.text,
    pendulum_text = excluded.pendulum_text, tags = excluded.tags, extra_deck = excluded.extra_deck,
    tcg = excluded.tcg, ocg = excluded.ocg, tcg_limit = excluded.tcg_limit,
    tcg_next_limit = excluded.tcg_next_limit, ocg_limit = excluded.ocg_limit,
    ocg_next_limit = excluded.ocg_next_limit, md_rarity = excluded.md_rarity,
    fake_password = excluded.fake_password, src_hash = excluded.src_hash, updated_at = now()
  where c.src_hash is distinct from excluded.src_hash;
  get diagnostics changed = row_count;

  -- prints: replaced as a whole ------------------------------------------------
  select * into res from extensions.http_get(base || 'prints.json');
  if res.status <> 200 then
    raise exception 'prints.json: HTTP %', res.status;
  end if;
  delete from public.card_prints where true;
  insert into public.card_prints (card_id, region, set_number, set_name, rarity)
  select x.card_id, x.region, x.set_number, x.set_name, x.rarity
  from jsonb_to_recordset(res.content::jsonb) as x(card_id integer, region text, set_number text, set_name text, rarity text)
  where exists (select 1 from public.cards c where c.id = x.card_id);
  get diagnostics n_prints = row_count;

  -- meta ------------------------------------------------------------------------
  insert into public.card_data_meta as m (
    id, built, tcg_banlist, tcg_upcoming, ocg_banlist, ocg_upcoming, cards, tcg_cards, ocg_cards, prints, refreshed_at
  ) values (
    true, (meta ->> 'built')::timestamptz, (meta ->> 'tcg_banlist')::date, (meta ->> 'tcg_upcoming')::date,
    (meta ->> 'ocg_banlist')::date, (meta ->> 'ocg_upcoming')::date, (meta ->> 'cards')::int,
    (meta ->> 'tcg_cards')::int, (meta ->> 'ocg_cards')::int, n_prints, now()
  )
  on conflict (id) do update set
    built = excluded.built, tcg_banlist = excluded.tcg_banlist, tcg_upcoming = excluded.tcg_upcoming,
    ocg_banlist = excluded.ocg_banlist, ocg_upcoming = excluded.ocg_upcoming, cards = excluded.cards,
    tcg_cards = excluded.tcg_cards, ocg_cards = excluded.ocg_cards, prints = excluded.prints,
    refreshed_at = excluded.refreshed_at;

  return format('%s cards (%s new or changed), %s prints, built %s',
                jsonb_array_length(data), changed, n_prints, meta ->> 'built');
end;
$$;

revoke execute on function public.refresh_card_data(boolean) from public, anon, authenticated;

-- hourly check; cheap when nothing changed (only meta.json is fetched)
select cron.schedule('ygo-refresh-card-data', '23 * * * *', $$select public.refresh_card_data()$$);

-- YGO Deck Builder: initial schema.
-- Apply in the Supabase dashboard (SQL Editor) or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Profiles: one row per user, created automatically on sign-up.
-- `plan` is the hook for future paid features.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Decks. Card lists are arrays of card passwords, one entry per copy.
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Untitled deck' check (char_length(name) <= 120),
  format text not null default 'tcg' check (format in ('tcg')),
  main integer[] not null default '{}' check (cardinality(main) <= 100),
  extra integer[] not null default '{}' check (cardinality(extra) <= 30),
  side integer[] not null default '{}' check (cardinality(side) <= 30),
  notes text check (char_length(notes) <= 5000),
  is_public boolean not null default false,
  -- opt-in: allow this deck to feed anonymous "played together" statistics
  share_for_stats boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists decks_user_id_idx on public.decks (user_id);

-- ---------------------------------------------------------------------------
-- Collection: copies owned per card.
-- ---------------------------------------------------------------------------
create table if not exists public.collection (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id integer not null,
  qty integer not null check (qty > 0 and qty <= 999),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: users only ever see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.collection enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- users must not upgrade themselves: plan is changed only by the service role (billing webhook).
-- A column-level revoke is not enough when the role has table-level UPDATE (Supabase grants it
-- by default), so take UPDATE away and give back only the editable columns.
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "decks: read own or public" on public.decks;
create policy "decks: read own or public" on public.decks
  for select to authenticated, anon using (is_public or user_id = (select auth.uid()));
drop policy if exists "decks: insert own" on public.decks;
create policy "decks: insert own" on public.decks
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "decks: update own" on public.decks;
create policy "decks: update own" on public.decks
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "decks: delete own" on public.decks;
create policy "decks: delete own" on public.decks
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "collection: own rows" on public.collection;
create policy "collection: own rows" on public.collection
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Public bucket for re-hosted card images (written only by the GitHub Action
-- with the service-role key; anyone can read).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

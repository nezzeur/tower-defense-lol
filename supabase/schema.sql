-- Rift Defenders cloud saves: one row per account, readable and writable only by its owner.
-- Run once in the Supabase SQL editor (or apply as a migration).
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "own save: read" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "own save: insert" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own save: update" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own save: delete" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);

-- Public leaderboard: pseudo + stats, readable by anyone, written only by the owner (stats are reported by the client).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 3 and 16 and pseudo ~ '^[[:alnum:]_ .-]+$'),
  kills bigint not null default 0 check (kills >= 0),
  gold_earned bigint not null default 0 check (gold_earned >= 0),
  stars integer not null default 0 check (stars >= 0),
  maps integer not null default 0 check (maps >= 0),
  champions integer not null default 0 check (champions >= 0),
  endless integer not null default 0 check (endless >= 0),
  runs integer not null default 0 check (runs >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_pseudo_unique on public.profiles (lower(pseudo));
create index if not exists profiles_kills_idx on public.profiles (kills desc);
create index if not exists profiles_gold_idx on public.profiles (gold_earned desc);
create index if not exists profiles_stars_idx on public.profiles (stars desc);
create index if not exists profiles_endless_idx on public.profiles (endless desc);

alter table public.profiles enable row level security;

create policy "leaderboard: anyone can read" on public.profiles for select to anon, authenticated using (true);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own profile: delete" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

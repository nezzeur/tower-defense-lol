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

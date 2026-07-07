-- Run this once in your Supabase project's SQL editor to enable
-- cross-device sync for Twine. One row per signed-in user, holding
-- the same JSON shape as the app's Export Backup feature.

create table if not exists public.twine_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.twine_backups enable row level security;

create policy "select own backup" on public.twine_backups
  for select using (auth.uid() = user_id);

create policy "insert own backup" on public.twine_backups
  for insert with check (auth.uid() = user_id);

create policy "update own backup" on public.twine_backups
  for update using (auth.uid() = user_id);

-- enables realtime change notifications so other signed-in devices
-- pick up updates automatically
alter publication supabase_realtime add table public.twine_backups;

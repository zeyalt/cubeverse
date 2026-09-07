-- Per-cuber alg-trainer progress, synced across devices. One JSON document
-- per trainer (starting with 2x2 CLL) so case reps, notes, and settings travel
-- with the household account instead of sitting in localStorage.

create table trainer_progress (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  cuber_id     uuid not null references cubers(id) on delete cascade,
  trainer_key  text not null,
  progress     jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (cuber_id, trainer_key)
);

create index trainer_progress_owner_idx on trainer_progress (owner_id);

alter table trainer_progress enable row level security;
drop policy if exists "owner_all" on trainer_progress;
create policy "owner_all" on trainer_progress
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

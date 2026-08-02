-- Saved WCA IDs for the "Competitor Benchmarking" chart, so a cuber's rivals
-- persist across visits instead of being re-typed every time.
create table benchmark_competitors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  cuber_id   uuid not null references cubers(id) on delete cascade,
  wca_id     text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (cuber_id, wca_id)
);

alter table benchmark_competitors enable row level security;
create policy "owner_all" on benchmark_competitors
  for all using (true) with check (true);

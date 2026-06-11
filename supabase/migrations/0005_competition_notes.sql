-- Competition and Event Journal Notes
create table competition_notes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  event_id       text references events(id) on delete cascade,
  round_type     text,  -- 'first'|'second'|'semi'|'final'|null (null = competition-level note)
  content        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (cuber_id, competition_id, event_id, round_type)
);

alter table competition_notes enable row level security;
create policy "owner_all" on competition_notes
  for all using (true) with check (true);

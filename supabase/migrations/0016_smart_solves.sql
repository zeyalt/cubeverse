-- Smart-cube solves, deliberately in their own table rather than a flag on `solves`.
--
-- A smart-cube solve is a different kind of record: it carries a move stream, a reconstruction,
-- and a confidence level, and it is timed by the cube's own clock rather than by a thumb on a
-- screen. More importantly, these must never reach personal bests, badges, goals or the Analytics
-- tab. A column on `solves` would have made that a property of every query ever written against
-- that table — one missed filter and a Bluetooth drift artefact becomes someone's PB. A separate
-- table makes the isolation structural: `record_practice_solve`, `pb_history`, `goals` and
-- `achievements` are untouched and cannot see this data.

create table smart_solves (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  cuber_id            uuid not null references cubers(id) on delete cascade,
  event_id            text not null references events(id),
  time_cs             int not null,
  penalty             text not null default 'none' check (penalty in ('none', 'plus2', 'dnf')),
  scramble            text,
  -- Compact per-move encoding from lib/smartcube/moveStream.ts: roughly 2-3 bytes a move against
  -- ~25 for verbose JSON, and Postgres never has to parse it.
  move_stream         text,
  move_stream_version smallint not null default 1,
  -- The analysis output, stored even when the method wasn't recognised: it still carries the
  -- totals, with an empty step list and a reason. Nullable only for rows written before analysis
  -- existed, or if it ever fails outright.
  reconstruction      jsonb,
  -- 'cube' when the cube's clock was used, 'local' when we had to fall back to the browser's.
  timing_source       text not null default 'cube' check (timing_source in ('cube', 'local')),
  -- 'low' when a turn was missed over Bluetooth mid-solve, so the splits may be off.
  confidence          text not null default 'high' check (confidence in ('high', 'low')),
  cube_name           text,
  -- Dedupes retries from the offline outbox, exactly as `solves` does.
  idempotency_key     uuid not null default gen_random_uuid(),
  solved_at           timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (cuber_id, idempotency_key)
);

create index smart_solves_recent_idx on smart_solves (cuber_id, event_id, solved_at desc);
create index smart_solves_owner_idx on smart_solves (owner_id);

alter table smart_solves enable row level security;
drop policy if exists "owner_all" on smart_solves;
create policy "owner_all" on smart_solves
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

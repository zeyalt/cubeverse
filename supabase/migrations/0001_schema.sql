create extension if not exists "pgcrypto";

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
create table events (
  id          text primary key,
  name        text not null,
  format      text not null default 'ao5',  -- 'ao5' | 'mo3' | 'bo3' | 'bo1'
  is_wca      boolean not null default true,
  owner_id    uuid references auth.users(id) on delete cascade,  -- NULL = global
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table events enable row level security;
create policy "events_select" on events
  for select using (owner_id is null or owner_id = auth.uid());
create policy "events_write" on events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── CUBERS ──────────────────────────────────────────────────────────────────
create table cubers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  display_name text,
  wca_id       text,
  avatar_url   text,
  birthdate    date,
  created_at   timestamptz not null default now()
);

alter table cubers enable row level security;
create policy "owner_all" on cubers
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── COMPETITIONS ─────────────────────────────────────────────────────────────
create table competitions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  cuber_id           uuid not null references cubers(id) on delete cascade,
  name               text not null,
  type               text not null default 'wca',     -- 'wca' | 'unofficial'
  wca_competition_id text,
  city               text,
  country            text,
  start_date         date,
  end_date           date,
  source             text not null default 'manual',  -- 'manual' | 'wca_import'
  notes              text,
  created_at         timestamptz not null default now(),
  unique (cuber_id, wca_competition_id)
);

alter table competitions enable row level security;
create policy "owner_all" on competitions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── RESULTS ─────────────────────────────────────────────────────────────────
create table results (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  event_id       text not null references events(id),
  round_type     text not null default 'final',  -- 'first'|'second'|'semi'|'final'
  format         text not null default 'ao5',
  best_cs        int,
  average_cs     int,
  ranking        int,
  source         text not null default 'manual',
  created_at     timestamptz not null default now()
);

alter table results enable row level security;
create policy "owner_all" on results
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  cuber_id   uuid not null references cubers(id) on delete cascade,
  event_id   text not null references events(id),
  name       text,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;
create policy "owner_all" on sessions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── SOLVES ──────────────────────────────────────────────────────────────────
create table solves (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  event_id       text not null references events(id),
  context        text not null,                    -- 'practice' | 'competition'
  session_id     uuid references sessions(id) on delete cascade,
  result_id      uuid references results(id) on delete cascade,
  competition_id uuid references competitions(id) on delete cascade,
  time_cs        int not null,
  penalty        text not null default 'none',     -- 'none'|'plus2'|'dnf'|'dns'
  scramble       text,
  position       int,
  comment        text,
  solved_at      timestamptz not null default now(),
  source         text not null default 'manual',   -- 'manual'|'wca_import'|'twisty_import'
  created_at     timestamptz not null default now(),
  constraint solve_context_link check (
    (context = 'practice'    and session_id is not null) or
    (context = 'competition' and result_id  is not null)
  )
);

alter table solves enable row level security;
create policy "owner_all" on solves
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── PB_HISTORY ───────────────────────────────────────────────────────────────
create table pb_history (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  event_id       text not null references events(id),
  record_type    text not null,   -- 'single' | 'average'
  context        text not null,   -- 'official' | 'practice' | 'overall'
  time_cs        int not null,
  solve_id       uuid references solves(id) on delete set null,
  result_id      uuid references results(id) on delete set null,
  competition_id uuid references competitions(id) on delete set null,
  achieved_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table pb_history enable row level security;
create policy "owner_all" on pb_history
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── GOALS ───────────────────────────────────────────────────────────────────
create table goals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  event_id    text not null references events(id),
  record_type text not null default 'single',   -- 'single' | 'average'
  target_cs   int not null,
  target_date date,
  status      text not null default 'active',   -- 'active'|'achieved'|'archived'
  achieved_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table goals enable row level security;
create policy "owner_all" on goals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
create table achievements (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  badge_key   text not null,
  event_id    text references events(id),
  metadata    jsonb not null default '{}',
  unlocked_at timestamptz not null default now(),
  unique (cuber_id, badge_key)
);

alter table achievements enable row level security;
create policy "owner_all" on achievements
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── JOURNAL_ENTRIES ──────────────────────────────────────────────────────────
create table journal_entries (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  competition_id uuid references competitions(id) on delete set null,
  entry_date     date not null default current_date,
  mood           text,
  title          text,
  body           text,
  author         text not null default 'parent',  -- 'parent' | 'child'
  created_at     timestamptz not null default now()
);

alter table journal_entries enable row level security;
create policy "owner_all" on journal_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── CUBES ───────────────────────────────────────────────────────────────────
create table cubes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  event_id    text references events(id),
  name        text not null,
  brand       text,
  is_main     boolean not null default false,
  photo_url   text,
  acquired_on date,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table cubes enable row level security;
create policy "owner_all" on cubes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── MEDIA ───────────────────────────────────────────────────────────────────
create table media (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  cuber_id     uuid not null references cubers(id) on delete cascade,
  storage_path text not null,
  kind         text not null,   -- 'image' | 'video'
  linked_type  text,            -- 'solve'|'journal'|'competition'|'pb'
  linked_id    uuid,
  caption      text,
  created_at   timestamptz not null default now()
);

alter table media enable row level security;
create policy "owner_all" on media
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── APP_SETTINGS ─────────────────────────────────────────────────────────────
create table app_settings (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  parent_pin_hash   text,
  default_cuber_id  uuid references cubers(id) on delete set null,
  theme             text default 'system',
  updated_at        timestamptz not null default now()
);

alter table app_settings enable row level security;
create policy "owner_all" on app_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── WCA_AVERAGE FUNCTION ─────────────────────────────────────────────────────
-- Mirrors lib/cubing.ts wcaAverage(). Pass effective times; DNF = -1.
create or replace function wca_average(times_cs int[]) returns int
language plpgsql immutable as $$
declare
  n      int := array_length(times_cs, 1);
  dnf    int := 0;
  sorted int[];
  s      bigint := 0;
  i      int;
  t      int;
begin
  if n is null or n not in (3, 5) then return null; end if;
  foreach t in array times_cs loop
    if t = -1 then dnf := dnf + 1; end if;
  end loop;
  if n = 5 then
    if dnf >= 2 then return -1; end if;
    select array_agg(x order by (case when x = -1 then 2147483647 else x end))
      into sorted from unnest(times_cs) x;
    for i in 2..4 loop s := s + sorted[i]; end loop;
    return round(s::numeric / 3);
  else  -- n = 3, Mo3
    if dnf >= 1 then return -1; end if;
    foreach t in array times_cs loop s := s + t; end loop;
    return round(s::numeric / 3);
  end if;
end;
$$;

-- ─── SEED EVENTS ─────────────────────────────────────────────────────────────
-- Zayyan's current events first (sort_order 1–7), then future events (10+).
-- owner_id NULL = global rows visible to all users.
insert into events (id, name, format, is_wca, owner_id, sort_order) values
  ('222',   '2x2x2 Cube',          'ao5', true, null,  1),
  ('333',   '3x3x3 Cube',          'ao5', true, null,  2),
  ('pyram', 'Pyraminx',            'ao5', true, null,  3),
  ('skewb', 'Skewb',               'ao5', true, null,  4),
  ('clock', 'Clock',               'ao5', true, null,  5),
  ('444',   '4x4x4 Cube',          'ao5', true, null,  6),
  ('333oh', '3x3x3 One-Handed',    'ao5', true, null,  7),
  ('555',   '5x5x5 Cube',          'ao5', true, null, 10),
  ('666',   '6x6x6 Cube',          'mo3', true, null, 11),
  ('777',   '7x7x7 Cube',          'mo3', true, null, 12),
  ('333bf', '3x3x3 Blindfolded',   'bo3', true, null, 13),
  ('minx',  'Megaminx',            'ao5', true, null, 14),
  ('sq1',   'Square-1',            'ao5', true, null, 15);

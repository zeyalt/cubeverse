# Cubeverse — Build Prompt for Cursor / Claude Code

> **App name:** Cubeverse. A personal PWA to track, record, and
> visualise a child's speedcubing progress across WCA competitions, non-WCA
> competitions, and daily home practice — for both parent (analytics + keepsake) and
> child (motivation). Built by a parent for their son.

You are the engineer building this app. Read this whole document before writing code.
Build **phase by phase** in the order given. After each phase, stop, verify the
"Definition of done", commit, and only then continue. Prefer correctness and small,
testable increments over speed.

---

## 0. Domain primer — READ THIS, speedcubing scoring is not uniform

Get this wrong and every number in the app is wrong. Bake these rules into the data
model and a shared `lib/cubing.ts`, with unit tests.

- **Store all times as integer centiseconds** (cs), never floats. `12.34s → 1234`.
  This matches how the WCA itself stores results and makes import lossless.
- **Penalties:** an attempt is `none`, `plus2` (+2s), `dnf` (Did Not Finish), or
  `dns` (Did Not Start).
  - *Effective time* = `time_cs + 200` when `plus2`, else `time_cs`.
  - Represent **DNF/DNS as `-1`** in any array passed to averaging logic.
- **Single (a.k.a. "best"):** the fastest *effective* time among the attempts. There is
  **no such thing as "Bo5"** in WCA scoring — the user has been informally calling the
  best single "bo5". Model it as `best` (the min) + `average`.
- **Average format depends on the event:**
  - **Ao5 (Average of 5):** drop the best and worst, mean the middle 3. Used for
    `333, 222, 444, 555, 333oh, clock, minx, pyram, skewb, sq1`.
    - `≥2` DNFs in the 5 → the **average is DNF**.
    - exactly `1` DNF → it counts as the worst (removed); average the middle 3.
  - **Mo3 (Mean of 3):** mean of all 3; **any** DNF → average is DNF. Used for
    `666, 777`.
  - **Bo3 (Best of 3):** no average, best single only. Used for `333bf`.
  - **Bo1:** single attempt. (We can ignore FMC/multi-BLD for now — not this child's events.)
- **Rounding:** averages round to the nearest centisecond.
- **Official vs practice is a hard distinction.** A sub-20 at home is *not* an official
  PB. Every record carries a `context`: `official` (from WCA), `practice` (in-app
  timer / non-WCA), or `overall` (the better of the two). Never silently merge them.

A reference `wca_average(times_cs int[])` SQL function is provided in Phase 2 and must
match a TypeScript twin in `lib/cubing.ts`. **Write tests for: clean Ao5, Ao5 with one
+2, Ao5 with one DNF, Ao5 with two DNFs, clean Mo3, Mo3 with one DNF.**

---

## 1. Product shape

One parent account (auth). Under it, one or more **cubers** (children — start with the
son; the schema must allow adding the younger daughter later). The app has **two modes
in one codebase**:

- **Kid mode (default landing).** Fullscreen-friendly, big, colourful, celebratory.
  The timer, today's solves, "did I beat myself?", a trophy shelf, a practice streak.
  Almost no raw statistics.
- **Parent mode (PIN-gated).** The analytics dashboard, competition records, journal,
  goals, achievements admin, cube collection, WCA import, settings.

The app **opens in kid mode**. A small lock icon → enter parent PIN → unlocks `/parent`.
The PIN protects *exit to analytics*, not the child's own data entry.

---

## 2. Tech stack & conventions

- **Next.js (App Router, TypeScript strict)**, React Server Components where natural;
  all writes via **server actions** (`"use server"`).
- **Supabase**: Postgres + Auth (email magic link is fine for a personal app) + Storage
  (media bucket). **Row Level Security on every table.**
- **Vercel** deploy. **PWA** (installable, offline-capable timer — see Phase 13).
- **Tailwind CSS + shadcn/ui** for components. **Recharts** for charts.
  **canvas-confetti** for celebrations. **html-to-image** (or `next/og`) for PB share cards.
- Scramble generation: use the **`cubing`** package (cubing.js) `randomScrambleForEvent`
  (WASM, runs in-browser). If integration is fiddly, fall back to **`scrambow`**.
  Confirm the exact import/signature at build time.
- Conventions: integer centiseconds everywhere; DNF = `-1` in averaging arrays; no
  client-side service-role key; idempotent imports; one commit per phase.

### Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never exposed to client
# Optional — only if the official WCA API path needs OAuth (see Phase 8):
WCA_OAUTH_CLIENT_ID=
WCA_OAUTH_CLIENT_SECRET=
```

---

## 3. Data model (Supabase migration)

All tables get `owner_id uuid` denormalised for fast RLS, plus `cuber_id` where
relevant. RLS policy on every table: a row is visible/writable only when
`owner_id = auth.uid()`. `events` is the one exception (global rows + custom rows).

```sql
create extension if not exists "pgcrypto";

-- EVENTS (reference; global rows have owner_id NULL, custom non-WCA rows are user-owned)
create table events (
  id          text primary key,            -- '333','222','444','555','666','777','333oh','333bf','clock','minx','pyram','skewb','sq1', or custom slug
  name        text not null,
  format      text not null default 'ao5', -- 'ao5' | 'mo3' | 'bo3' | 'bo1'
  is_wca      boolean not null default true,
  owner_id    uuid references auth.users(id) on delete cascade, -- NULL = global
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- CUBERS (the children)
create table cubers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  display_name text,
  wca_id       text,                         -- e.g. '2024XXXX01'
  avatar_url   text,
  birthdate    date,                          -- enables age-group context later
  created_at   timestamptz not null default now()
);

-- COMPETITIONS (WCA + non-WCA; NOT practice)
create table competitions (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  cuber_id          uuid not null references cubers(id) on delete cascade,
  name              text not null,
  type              text not null default 'wca',   -- 'wca' | 'unofficial'
  wca_competition_id text,                          -- official id when type='wca'
  city              text,
  country           text,
  start_date        date,
  end_date          date,
  source            text not null default 'manual', -- 'manual' | 'wca_import'
  notes             text,
  created_at        timestamptz not null default now(),
  unique (cuber_id, wca_competition_id)
);

-- RESULTS (one event + round at one competition)
create table results (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  event_id       text not null references events(id),
  round_type     text not null default 'final',  -- 'first'|'second'|'semi'|'final'
  format         text not null default 'ao5',
  best_cs        int,                              -- centiseconds; -1 = DNF
  average_cs     int,                              -- centiseconds; -1 = DNF; null if n/a
  ranking        int,
  source         text not null default 'manual',  -- 'manual' | 'wca_import'
  created_at     timestamptz not null default now()
);

-- PRACTICE SESSIONS
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

-- SOLVES (unified: competition attempts AND practice solves)
create table solves (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  event_id       text not null references events(id),
  context        text not null,                    -- 'practice' | 'competition'
  session_id     uuid references sessions(id) on delete cascade,
  result_id      uuid references results(id) on delete cascade,
  competition_id uuid references competitions(id) on delete cascade,
  time_cs        int not null,                     -- raw recorded cs (BEFORE +2)
  penalty        text not null default 'none',     -- 'none'|'plus2'|'dnf'|'dns'
  scramble       text,
  position       int,                              -- 1..5 in a round, or order in session
  comment        text,
  solved_at      timestamptz not null default now(),
  source         text not null default 'manual',
  created_at     timestamptz not null default now(),
  constraint solve_context_link check (
    (context = 'practice'    and session_id is not null) or
    (context = 'competition' and result_id  is not null)
  )
);

-- PB HISTORY (append-only log → powers the staircase chart + celebrations)
create table pb_history (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  event_id       text not null references events(id),
  record_type    text not null,                    -- 'single' | 'average'
  context        text not null,                    -- 'official' | 'practice' | 'overall'
  time_cs        int not null,
  solve_id       uuid references solves(id) on delete set null,
  result_id      uuid references results(id) on delete set null,
  competition_id uuid references competitions(id) on delete set null,
  achieved_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- GOALS
create table goals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  event_id    text not null references events(id),
  record_type text not null default 'single',      -- 'single' | 'average'
  target_cs   int not null,
  target_date date,
  status      text not null default 'active',       -- 'active'|'achieved'|'archived'
  achieved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ACHIEVEMENTS / BADGES (definitions live in code; unlocks live here)
create table achievements (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  badge_key   text not null,                        -- 'sub20_333_single','streak_7','first_comp'...
  event_id    text references events(id),
  metadata    jsonb not null default '{}',
  unlocked_at timestamptz not null default now(),
  unique (cuber_id, badge_key)
);

-- JOURNAL (reflections per competition or day)
create table journal_entries (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  cuber_id       uuid not null references cubers(id) on delete cascade,
  competition_id uuid references competitions(id) on delete set null,
  entry_date     date not null default current_date,
  mood           text,                              -- emoji or short label
  title          text,
  body           text,
  author         text not null default 'parent',    -- 'parent' | 'child'
  created_at     timestamptz not null default now()
);

-- CUBE COLLECTION (the gear shelf)
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

-- MEDIA (photos/clips attached to solves, journals, comps, PBs)
create table media (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  cuber_id    uuid not null references cubers(id) on delete cascade,
  storage_path text not null,                       -- Supabase Storage path
  kind        text not null,                        -- 'image' | 'video'
  linked_type text,                                 -- 'solve'|'journal'|'competition'|'pb'
  linked_id   uuid,
  caption     text,
  created_at  timestamptz not null default now()
);

-- APP SETTINGS (per user)
create table app_settings (
  owner_id        uuid primary key references auth.users(id) on delete cascade,
  parent_pin_hash text,                             -- hashed PIN to exit kid mode
  default_cuber_id uuid references cubers(id) on delete set null,
  theme           text default 'system',
  updated_at      timestamptz not null default now()
);
```

**RLS:** enable on all tables. Standard policy (apply to every table that has `owner_id`):
```sql
alter table <t> enable row level security;
create policy "owner_all" on <t>
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```
For `events`, allow reading global + own and writing only own:
```sql
alter table events enable row level security;
create policy "events_select" on events
  for select using (owner_id is null or owner_id = auth.uid());
create policy "events_write" on events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

**Seed `events`** (owner_id NULL) with the events Zayyan actually competes in first, in
this order, then the rest as available-but-hidden:
**`222, 333, pyram, skewb, clock, 444, 333oh`** are his current events — make these the
default visible set. Also seed `555, 666, 777, 333bf, minx, sq1` for future use but keep
them out of the default kid-mode picker until he competes in them. Use the correct
`format` per the domain primer (`333oh` is Ao5; `clock/pyram/skewb` are Ao5; `666/777`
are Mo3; `333bf` is Bo3).

**Averaging function** (must mirror `lib/cubing.ts`):
```sql
create or replace function wca_average(times_cs int[]) returns int
language plpgsql immutable as $$
declare n int := array_length(times_cs,1); dnf int := 0; sorted int[]; s bigint := 0; i int; t int;
begin
  if n is null or n not in (3,5) then return null; end if;
  foreach t in array times_cs loop if t = -1 then dnf := dnf + 1; end if; end loop;
  if n = 5 then
    if dnf >= 2 then return -1; end if;
    select array_agg(x order by (case when x = -1 then 2147483647 else x end)) into sorted from unnest(times_cs) x;
    for i in 2..4 loop s := s + sorted[i]; end loop;          -- drop best+worst, mean middle 3
    return round(s::numeric / 3);
  else -- n = 3, Mo3
    if dnf >= 1 then return -1; end if;
    foreach t in array times_cs loop s := s + t; end loop;
    return round(s::numeric / 3);
  end if;
end; $$;
```
> Pass **effective** times (with +2 already added) and DNF as `-1`.

---

## 4. WCA auto-import (the headline feature)

The child has a **WCA ID**. The app should pull every official competition, result, and
(where available) individual solve automatically — so the parent never hand-types a WCA
comp. Keep the entire fetch layer behind **`lib/wca.ts`** so the source is swappable.

**DECIDED — primary source: the unofficial static REST API.**

1. **Unofficial static REST API (PRIMARY).**
   - Repo: `https://github.com/robiningelbrecht/wca-rest-api`
   - Docs / endpoint specs: `https://wca-rest-api.robiningelbrecht.be/`
   - Static JSON served from GitHub, **no auth / no key**, rebuilt daily from the
     official WCA export. Has person, competition, and result entities; query by WCA ID.
2. **Official WCA v0 API (FALLBACK / source of truth).**
   - Base: `https://www.worldcubeassociation.org/api/v0/` (e.g. `/persons/{wca_id}`).
   - Authoritative; may require an OAuth app for some endpoints. Raw daily export it's
     all derived from: `https://www.worldcubeassociation.org/export/results`.

> Do **not** hardcode endpoint paths from memory. Open the chosen API's docs, confirm
> the exact person/results response shape, and write `lib/wca.ts` against the real schema.
> If individual attempt times per official solve are exposed, create `solves`
> (`context='competition'`); if only best/average are exposed, store those on `results`
> and skip per-solve rows.

**Import must be idempotent.** Upsert `competitions` on `(cuber_id, wca_competition_id)`
and results on their natural key; re-running an import updates rather than duplicates.
After import, recompute `pb_history` rows with `context='official'`.

**Validated against real data (WCA ID `2025ZEYA01`).** A live fetch of his profile
confirms the approach works and surfaces edge cases the parser MUST handle:
- **Time formats:** both `13.79` and `1:10.12` (mm:ss.cc) appear — parse both to cs.
- **DNFs in a result:** e.g. a 3x3 round with a DNF among the 5 solves; store the solve
  with `penalty='dnf'` and let `wca_average` apply the Ao5 DNF rule. A round can still
  have a valid average with exactly one DNF.
- **Partial rounds:** some rounds show only 2 solves and a **blank average** (combined
  rounds where he didn't make the cutoff). Store the solves you have; leave
  `average_cs` null — do not fabricate an average.
- His events on record: `333, 222, 444, 333oh, clock, pyram, skewb` across 4 comps.

### Twisty Timer import (DEFERRED — design for it now, build it later)

The family practises mainly in **Twisty Timer** (Android). Import is **deferred** — do
**not** build the parser in the initial app. But **future-proof the design now** so it
drops in cleanly later:

- The `solves` table already carries `source` — reserve `'twisty_import'` as a value.
- Create `lib/import/twistytimer.ts` as a **typed stub** (signature + TODO) and a
  matching empty tab/placeholder at `/parent/import` labelled "Twisty Timer (coming
  soon)". No parsing logic yet.
- Keep the import contract generic: any importer returns `ParsedSolve[]` (event_id,
  time_cs, penalty, scramble?, solved_at, comment?) that a shared `ingestPracticeSolves()`
  function writes (grouping into sessions, idempotent dedupe). Build that shared ingest
  path now so both the in-app timer and a future importer use it.
- When the owner is ready, they'll drop a real export at
  `/fixtures/twistytimer-sample.txt` and the parser gets written against the true format
  (delimited rows: puzzle/category, time in **ms**, penalty, scramble, date, comment —
  confirm from the actual file; convert ms → cs). csTimer JSON can reuse the same contract.

---

## 5. App structure (routes)

```
/                       Kid mode home — pick event, big "START" → timer, today's solves, streak, trophies
/timer                  Fullscreen timer for the selected event
/parent                 PIN gate → parent dashboard shell
/parent/overview        At-a-glance: current PBs per event, recent activity, comp timeline
/parent/event/[id]      Per-event analytics (charts below)
/parent/competitions    List of WCA + non-WCA comps; add/edit non-WCA; per-comp detail
/parent/import         WCA import (by WCA ID) + Twisty Timer import (upload export file)
/parent/journal         Reflections (parent + child entries), attach media
/parent/goals           Set/track goals (progress bars)
/parent/achievements    Badge shelf + thresholds config
/parent/cubes           Cube collection
/parent/settings        Cubers, PIN, theme, default event
```

---

## 6. The timer (Phase 5–6 — the heart of the app)

Behaviour (WCA-style, tuned for a young child):

- Show a **scramble** for the selected event at the top (generated via `cubing.js`).
- **Inspection: optional toggle, OFF by default.** When on: 15s countdown, audible/visual
  cue at 8s and 12s, +2 if 15–17s, DNF if >17s.
- **Start gesture:** hold spacebar (desktop) or touch-and-hold (mobile) for ~400ms →
  indicator turns "ready" (colour change) → **release to start**. Timer runs, big digits.
- **Stop:** tap anywhere / press space → stop, record `time_cs`.
- **Post-solve bar:** show the time + buttons `OK` · `+2` · `DNF` · `Delete`, optional
  comment, scramble retained. Then auto-generate the next scramble.
- **Persist each solve immediately** to `solves` (`context='practice'`), attached to the
  current `session` (create one on first solve of a sitting; close on inactivity/leave).
- **Live session stats:** current Ao5 and Ao12 over the session's solves, plus session
  best, updating after each solve. Use the shared `lib/cubing.ts` averaging.
- Large tap targets, no tiny controls. Haptic feedback on mobile if available.

---

## 7. Analytics (Phase 10, parent mode) — use Recharts

Per event, and on overview:

- **PB staircase** — step chart of `pb_history` (single and average), official vs
  practice distinguished by colour. The motivation centrepiece.
- **Single vs Ao5 over time** — scatter/line of solves with a trend line; toggle
  practice-only / official-only / both.
- **Rolling average** — Ao12 / Ao50 / Ao100 line over the practice stream.
- **Solve distribution** — histogram for a chosen window (shape of his times).
- **Consistency** — rolling standard deviation over time; *tightening spread = improving*
  even when the PB is flat. Surface this explicitly; it's invisible in a spreadsheet.
- **Practice heatmap** — GitHub-style calendar of solves/day (feeds the streak).
- **Competition overlay** — comp dates marked on the practice timeline so the parent can
  see whether training intensity tracks with comp PBs.

---

## 8. Gamification & keepsake

- **Badges** — definitions in `lib/badges.ts`, evaluated after every solve and after each
  import. Examples: `sub30_333_single`, `sub20_333_single`, `sub15_333_single`,
  per-event sub-X thresholds (configurable in settings), `first_comp`, `first_podium`,
  `streak_7`, `streak_30`, `100_solves`, `1000_solves`. Write to `achievements`
  (unique per cuber+badge). Show a **celebration** (canvas-confetti) on unlock in kid mode.
- **PB detection engine** — after a solve/import, compare to current PB for
  (cuber,event,record_type,context); if beaten, append `pb_history`, fire the
  celebration, and check threshold badges. Keep this in a tested server module
  (`lib/pb.ts`), not a DB trigger, so it's debuggable.
- **PB share card** — generate a clean PNG (event, time, date, cuber name/avatar) via
  `next/og` or `html-to-image`, downloadable to send to family.
- **Goals** — set targets *with the child*; render as progress bars (current PB → target),
  mark achieved automatically when crossed.
- **Streak** — consecutive days with ≥1 practice solve; shown big in kid mode.
- **Journal** — short reflection per comp/day (`author` = parent or child), attach media.
  This turns the app into a keepsake, not just stats.
- **Cube collection** — the gear shelf; mark a "main" per event.

---

## 9. Design direction

- **Kid mode:** big, rounded, high-contrast, joyful. One primary action visible at a time
  (START). Celebration moments matter. Minimal numbers. Friendly palette.
- **Parent mode:** calm, clean, dense-but-legible dashboard (think tasteful, restrained,
  data-forward). Dark mode supported. shadcn/ui for consistency.
- Accessibility: large tap targets, keyboard support for the timer, reduced-motion respect.
- Mobile-first (the timer lives on a phone); desktop gets the full dashboard.

---

## 10. PWA & offline (Phase 13)

- Web app manifest, icons, installable. Opens to kid mode.
- **Offline-first timer:** the timer must work with no connection. Queue solves in
  IndexedDB and sync to Supabase when back online (a child may practise anywhere).
  Show a subtle "synced / pending" indicator.

---

## BUILD SEQUENCE — do these in order, verify "Done" before moving on

**Phase 1 — Scaffold.** Next.js (App Router, TS strict) + Tailwind + shadcn/ui +
Supabase client (`lib/supabase/{client,server}.ts`) + env wiring.
*Done:* app boots, Supabase connects, lint/typecheck clean.

**Phase 2 — Schema.** Apply the full migration (tables + RLS + seed events +
`wca_average`). Build `lib/cubing.ts` (centisecond helpers, effective time, Ao5/Mo3,
formatting `cs → "12.34"` / `"1:23.45"` / `"DNF"`) **with tests** matching the SQL fn.
*Done:* migration applies; cubing tests pass (incl. the six cases in §0).

**Phase 3 — Auth & first cuber.** **Username + password auth, no email required, but
genuinely multi-user.** Use Supabase auth with a *synthetic email* under the hood:
sign-up takes a username + password and registers `${username}@cubeverse.local` (disable
email confirmation in Supabase Auth settings). Each registered user is an independent
account; all data is already isolated per user via the `owner_id = auth.uid()` RLS on
every table, so multiple families can use the same deployment without seeing each other's
data. On first login, create a `cuber` and `app_settings`; set a parent PIN (hashed).
*Done:* two separate username accounts can each sign in, create their own cuber, set a
PIN, and cannot see each other's rows.

**Phase 4 — Mode shell.** Kid-mode landing as default route; lock icon → PIN gate →
`/parent`. Event picker drives the rest.
*Done:* can switch between kid and parent modes; PIN enforced.

**Phase 5 — Timer core (no persistence).** Scramble generation + hold/release/stop +
penalty bar + next scramble. Inspection toggle (off by default).
*Done:* can time solves on screen with correct +2/DNF handling; scrambles look valid.

**Phase 6 — Persist solves + sessions.** Save each solve to `solves`/`sessions`; live
session Ao5/Ao12/best.
*Done:* solves persist; reload shows today's solves; session averages correct.

**Phase 7 — Manual non-WCA comps.** Add/edit a `competition` (type `unofficial`), enter
`results` with their 5 solves; auto-compute best/average via `lib/cubing.ts`.
*Done:* the 2 non-WCA comps can be entered and display correctly.

**Phase 8 — WCA import.** Build `lib/wca.ts` against the confirmed API; `/parent/import`
takes the WCA ID, fetches, upserts comps/results/(solves), idempotently. Recompute
official PBs.
*Done:* importing the son's WCA ID brings in all official comps with correct numbers;
re-running creates no duplicates.

**Phase 8b — Twisty Timer import (DEFERRED / future).** Do NOT build now. Phase 8 must
only leave the design hooks in place: `source='twisty_import'` reserved, the
`ingestPracticeSolves()` shared path built and used by the in-app timer, the typed stub
`lib/import/twistytimer.ts`, and the "coming soon" placeholder tab on `/parent/import`.
*Done (for now):* hooks exist and are unused; building the real parser is a later task
once a real export fixture is provided.

**Phase 9 — PB engine + celebrations.** `lib/pb.ts` + `pb_history` + confetti + share
card; threshold badges fire.
*Done:* beating a PB logs history, celebrates, and (where crossed) unlocks a badge;
share card PNG downloads.

**Phase 10 — Parent analytics.** All charts in §7.
*Done:* every chart renders from real data; official/practice toggles work.

**Phase 11 — Gamification.** Full badge set + streaks + goals with progress bars.
*Done:* badges, streak, and goal progress all compute correctly.

**Phase 12 — Journal, media, cubes.** Reflections (+ media upload to Storage), cube shelf.
*Done:* can write an entry, attach a photo, and add a cube.

**Phase 13 — PWA & offline.** Manifest/icons/install + IndexedDB offline solve queue + sync.
*Done:* installable; timer works offline and syncs on reconnect.

---

## Guardrails (apply throughout)

- TypeScript strict; no `any` in domain logic.
- **Integer centiseconds only**; DNF = `-1` in averaging arrays; never floats for times.
- RLS on every table; service-role key server-only.
- All writes via server actions; validate inputs.
- WCA fetch isolated in `lib/wca.ts`; imports idempotent.
- `lib/cubing.ts` and `wca_average()` must agree; keep their tests green.
- One commit per phase with a clear message; don't start a phase until the previous
  "Done" is met.

---

### Open decisions to confirm with me (the owner) before/while building
1. **App name** — Cubeverse (decided).
2. **WCA API source** — decided: unofficial static API primary, official v0 fallback
   (§4). Confirm exact person/results JSON shape against the live docs at build time.
3. **Auth** — decided: username + password, no email, multi-user via RLS (Phase 3).
4. **Twisty Timer import** — decided: **deferred** (§4 + Phase 8b). Build only the design
   hooks now; the real parser comes later once a real export fixture is provided.
5. **Cuber identity** — decided: import from WCA ID `2025ZEYA01` (Zayyan Adam Zeya). See
   Appendix A for his current PBs, seeded events, and tuned goals/badges.

---

## Appendix A — Zayyan's starting data (seed after WCA import)

Pulled live from the WCA (`2025ZEYA01`). After the Phase 8 import runs, these will be his
official PBs — but seed the **goals** and **badge tiers** below so the app is motivating
from day one. Times shown as seconds; store everything in centiseconds.

**Current official PBs (single / average):**
`222` 4.37 / 5.86 · `333` 13.79 / 17.13 · `pyram` 8.49 / 12.17 · `skewb` 10.44 / 11.14 ·
`clock` 18.79 / 21.54 · `444` 1:10.12 / 1:21.12 · `333oh` 1:14.60 / —

**Main event:** `333` (most-contested; make it the kid-mode default).

**Starter goals (reachable next targets — render as progress bars):**
- `333` average **sub-15** (from 17.13) and single **sub-12** (from 13.79)
- `222` average **sub-5** (from 5.86) and single **sub-4** (from 4.37)
- `pyram` average **sub-10** (from 12.17)
- `skewb` average **sub-10** (from 11.14)
- `clock` average **sub-20** (from 21.54)

**Badge tiers (single + average per event; unlock when crossed).** Use a tiered ladder so
there's always a next rung. Mark already-achieved tiers as unlocked on import:
- `333`: sub-20, sub-15, sub-12, sub-10, sub-8 (he's already past sub-20 and sub-15 single)
- `222`: sub-8, sub-6, sub-5, sub-4, sub-3
- `pyram`: sub-15, sub-12, sub-10, sub-8, sub-6
- `skewb`: sub-15, sub-12, sub-10, sub-8
- `clock`: sub-25, sub-20, sub-18, sub-15
- `444`: sub-1:30, sub-1:20, sub-1:10, sub-1:00
- Plus non-time badges: `first_comp`, `5_comps`, `100_solves`, `1000_solves`,
  `streak_7`, `streak_30`, `new_pb` (every PB), `all_events_in_one_comp`.

> The owner noted he counts ~5 WCA comps + 2 non-WCA; the WCA currently lists 4 official.
> Import whatever the WCA returns; the 2 non-WCA comps are entered manually (Phase 7).

-- Partial unique index to prevent duplicate imported solves
-- Deduplicates on (cuber_id, event_id, solved_at, time_cs) for twisty_import source
create unique index if not exists solves_import_dedup
  on solves (cuber_id, event_id, solved_at, time_cs)
  where source = 'twisty_import';

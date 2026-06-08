-- Drop auth.users FK constraints so owner_id can be any UUID (no-auth single-user mode).
-- RLS stays in place; the service-role key bypasses it on the server.
alter table cubers         drop constraint if exists cubers_owner_id_fkey;
alter table competitions   drop constraint if exists competitions_owner_id_fkey;
alter table results        drop constraint if exists results_owner_id_fkey;
alter table sessions       drop constraint if exists sessions_owner_id_fkey;
alter table solves         drop constraint if exists solves_owner_id_fkey;
alter table pb_history     drop constraint if exists pb_history_owner_id_fkey;
alter table goals          drop constraint if exists goals_owner_id_fkey;
alter table achievements   drop constraint if exists achievements_owner_id_fkey;
alter table journal_entries drop constraint if exists journal_entries_owner_id_fkey;
alter table cubes          drop constraint if exists cubes_owner_id_fkey;
alter table media          drop constraint if exists media_owner_id_fkey;
alter table app_settings   drop constraint if exists app_settings_owner_id_fkey;

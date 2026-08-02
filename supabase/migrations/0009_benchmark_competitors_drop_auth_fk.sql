-- Same fix as 0002_remove_auth_fk.sql, applied to the table added in 0008:
-- owner_id must accept any UUID in no-auth single-user mode.
alter table benchmark_competitors drop constraint if exists benchmark_competitors_owner_id_fkey;

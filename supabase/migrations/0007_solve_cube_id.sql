-- Track which cube was used for each solve
alter table solves add column cube_id uuid references cubes(id) on delete set null;

comment on column solves.cube_id is 'Cube used for this solve (nullable for backwards compatibility)';

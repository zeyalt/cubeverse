-- Ao12 / Ao50 / Ao100 skip DNFs and average the last N successful solves.
-- Ao5 keeps WCA rules (two DNFs in the window still make the average DNF).

create or replace function cubeverse_ao_n_skip_dnf(p_times int[], p_n int)
returns int
language sql
immutable
set search_path = public, pg_catalog
as $$
  select public.cubeverse_ao_n(s.times)
  from (
    select coalesce((
      select array_agg(newest.v order by newest.ord)
      from (
        select t.v, t.ord
        from unnest(p_times) with ordinality as t(v, ord)
        where t.v > 0
        order by t.ord desc
        limit p_n
      ) newest
    ), array[]::int[]) as times
  ) s
  where cardinality(s.times) = p_n
$$;

revoke all on function cubeverse_ao_n_skip_dnf(int[], int) from public;
grant execute on function cubeverse_ao_n_skip_dnf(int[], int) to authenticated, service_role;

create or replace function get_practice_summaries(
  p_owner_id uuid,
  p_cuber_id uuid,
  p_event_ids text[],
  p_tail_limit int default 120
)
returns table (
  event_id text,
  ao5 int,
  ao12 int,
  ao50 int,
  ao100 int,
  best int,
  count bigint,
  recent_times int[]
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
begin
  if p_tail_limit < 0 or p_tail_limit > 500 then
    raise exception 'tail limit must be between 0 and 500';
  end if;

  if not exists (
    select 1 from cubers c
    where c.id = p_cuber_id and c.owner_id = p_owner_id
  ) then
    raise exception 'cuber does not belong to owner';
  end if;

  return query
  with requested as (
    select unnest(p_event_ids) as event_id
  ),
  aggregates as (
    select s.event_id,
           count(*) as solve_count,
           min(case
             when s.penalty in ('dnf', 'dns') then null
             when s.penalty = 'plus2' then s.time_cs + 200
             else s.time_cs
           end) as best_time
    from solves s
    where s.cuber_id = p_cuber_id
      and s.context = 'practice'
      and s.event_id = any(p_event_ids)
    group by s.event_id
  ),
  tails as (
    select r.event_id,
           coalesce(array(
             select q.effective_time
             from (
               select case
                        when s.penalty in ('dnf', 'dns') then -1
                        when s.penalty = 'plus2' then s.time_cs + 200
                        else s.time_cs
                      end as effective_time,
                      s.solved_at,
                      s.id
               from solves s
               where s.cuber_id = p_cuber_id
                 and s.event_id = r.event_id
                 and s.context = 'practice'
               order by s.solved_at desc, s.id desc
               limit greatest(p_tail_limit, 160)
             ) q
             order by q.solved_at, q.id
           ), array[]::int[]) as times
    from requested r
  )
  select r.event_id,
         case when cardinality(t.times) >= 5
              then nullif(cubeverse_ao_n(t.times[(cardinality(t.times)-4):cardinality(t.times)]), -1) end,
         cubeverse_ao_n_skip_dnf(t.times, 12),
         cubeverse_ao_n_skip_dnf(t.times, 50),
         cubeverse_ao_n_skip_dnf(t.times, 100),
         a.best_time,
         coalesce(a.solve_count, 0),
         case
           when p_tail_limit = 0 then array[]::int[]
           when cardinality(t.times) <= p_tail_limit then t.times
           else t.times[(cardinality(t.times)-p_tail_limit+1):cardinality(t.times)]
         end
  from requested r
  left join aggregates a on a.event_id = r.event_id
  join tails t on t.event_id = r.event_id;
end
$$;

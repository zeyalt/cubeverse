-- Square-1 joins the active events. Keep it after 3x3 OH in display order and
-- add its badge ladder to the thresholds checked on every practice solve
-- (mirrors BADGE_TIERS in lib/badges.ts). The function body is otherwise
-- unchanged from 0011.

update events set sort_order = 8 where id = 'sq1';

create or replace function record_practice_solve(
  p_owner_id uuid,
  p_cuber_id uuid,
  p_event_id text,
  p_time_cs int,
  p_penalty text,
  p_scramble text default null,
  p_cube_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_solve_id uuid;
  v_position int;
  v_effective int;
  v_tail int[];
  v_count bigint;
  v_total_count bigint;
  v_best int;
  v_ao5 int;
  v_ao12 int;
  v_is_single_pb boolean := false;
  v_is_average_pb boolean := false;
  v_new_badges text[] := array[]::text[];
  v_added text[];
  v_days date[];
  v_streak int := 0;
  v_day date;
  v_offset int;
begin
  if p_time_cs <= 0 then raise exception 'time must be positive'; end if;
  if p_penalty not in ('none', 'plus2', 'dnf') then raise exception 'invalid penalty'; end if;

  if not exists (
    select 1 from cubers c
    where c.id = p_cuber_id and c.owner_id = p_owner_id
  ) then
    raise exception 'cuber does not belong to owner';
  end if;
  if not exists (select 1 from events e where e.id = p_event_id) then
    raise exception 'unknown event';
  end if;
  if p_cube_id is not null and not exists (
    select 1 from cubes c where c.id = p_cube_id and c.owner_id = p_owner_id
  ) then
    raise exception 'cube does not belong to owner';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cuber_id::text || ':' || p_event_id, 0));

  if p_idempotency_key is not null then
    select s.id, s.session_id into v_solve_id, v_session_id
    from solves s
    where s.owner_id = p_owner_id
      and s.client_idempotency_key = p_idempotency_key;
    if v_solve_id is not null then
      return jsonb_build_object(
        'sessionId', v_session_id,
        'solveId', v_solve_id,
        'count', 0,
        'bestCs', null,
        'ao5', null,
        'ao12', null,
        'isPb', false,
        'newBadges', '[]'::jsonb
      );
    end if;
  end if;

  select s.id into v_session_id
  from sessions s
  where s.owner_id = p_owner_id
    and s.cuber_id = p_cuber_id
    and s.event_id = p_event_id
    and s.ended_at is null
    and s.started_at > v_now - interval '2 hours'
  order by s.started_at desc
  limit 1;

  if v_session_id is null then
    insert into sessions (owner_id, cuber_id, event_id, started_at)
    values (p_owner_id, p_cuber_id, p_event_id, v_now)
    returning id into v_session_id;
  end if;

  select count(*)::int + 1 into v_position
  from solves where session_id = v_session_id;

  insert into solves (
    owner_id, cuber_id, event_id, context, session_id, time_cs, penalty,
    scramble, position, solved_at, source, cube_id, client_idempotency_key
  ) values (
    p_owner_id, p_cuber_id, p_event_id, 'practice', v_session_id, p_time_cs,
    p_penalty, p_scramble, v_position, v_now, 'manual', p_cube_id, p_idempotency_key
  )
  returning id into v_solve_id;

  v_effective := case
    when p_penalty = 'dnf' then -1
    when p_penalty = 'plus2' then p_time_cs + 200
    else p_time_cs
  end;

  select count(*),
         min(case
           when penalty in ('dnf', 'dns') then null
           when penalty = 'plus2' then time_cs + 200
           else time_cs
         end)
  into v_count, v_best
  from solves where session_id = v_session_id;

  select array(
    select q.effective_time
    from (
      select case
               when penalty in ('dnf', 'dns') then -1
               when penalty = 'plus2' then time_cs + 200
               else time_cs
             end as effective_time,
             solved_at,
             id
      from solves
      where session_id = v_session_id
      order by solved_at desc, id desc
      limit 12
    ) q
    order by q.solved_at, q.id
  ) into v_tail;

  if cardinality(v_tail) >= 5 then
    v_ao5 := cubeverse_ao_n(v_tail[(cardinality(v_tail)-4):cardinality(v_tail)]);
  end if;
  if cardinality(v_tail) >= 12 then
    v_ao12 := cubeverse_ao_n(v_tail);
  end if;

  if v_effective > 0 and not exists (
    select 1 from pb_history p
    where p.cuber_id = p_cuber_id and p.event_id = p_event_id
      and p.record_type = 'single' and p.context = 'practice'
      and p.time_cs > 0 and p.time_cs <= v_effective
  ) then
    v_is_single_pb := true;
    insert into pb_history (
      owner_id, cuber_id, event_id, record_type, context, time_cs, solve_id, achieved_at
    ) values (
      p_owner_id, p_cuber_id, p_event_id, 'single', 'practice',
      v_effective, v_solve_id, v_now
    );
    if not exists (
      select 1 from pb_history p
      where p.cuber_id = p_cuber_id and p.event_id = p_event_id
        and p.record_type = 'single' and p.context = 'overall'
        and p.time_cs > 0 and p.time_cs <= v_effective
    ) then
      insert into pb_history (
        owner_id, cuber_id, event_id, record_type, context, time_cs, solve_id, achieved_at
      ) values (
        p_owner_id, p_cuber_id, p_event_id, 'single', 'overall',
        v_effective, v_solve_id, v_now
      );
    end if;
    update goals
    set status = 'achieved', achieved_at = v_now
    where cuber_id = p_cuber_id and event_id = p_event_id
      and record_type = 'single' and status = 'active'
      and target_cs >= v_effective;
  end if;

  if v_ao5 > 0 and not exists (
    select 1 from pb_history p
    where p.cuber_id = p_cuber_id and p.event_id = p_event_id
      and p.record_type = 'average' and p.context = 'practice'
      and p.time_cs > 0 and p.time_cs <= v_ao5
  ) then
    v_is_average_pb := true;
    insert into pb_history (
      owner_id, cuber_id, event_id, record_type, context, time_cs, solve_id, achieved_at
    ) values (
      p_owner_id, p_cuber_id, p_event_id, 'average', 'practice',
      v_ao5, v_solve_id, v_now
    );
    if not exists (
      select 1 from pb_history p
      where p.cuber_id = p_cuber_id and p.event_id = p_event_id
        and p.record_type = 'average' and p.context = 'overall'
        and p.time_cs > 0 and p.time_cs <= v_ao5
    ) then
      insert into pb_history (
        owner_id, cuber_id, event_id, record_type, context, time_cs, solve_id, achieved_at
      ) values (
        p_owner_id, p_cuber_id, p_event_id, 'average', 'overall',
        v_ao5, v_solve_id, v_now
      );
    end if;
    update goals
    set status = 'achieved', achieved_at = v_now
    where cuber_id = p_cuber_id and event_id = p_event_id
      and record_type = 'average' and status = 'active'
      and target_cs >= v_ao5;
  end if;

  with badge_thresholds(badge_key, event_id, record_type, threshold_cs) as (
    values
      ('sub20_333_single','333','single',2000),('sub15_333_single','333','single',1500),
      ('sub12_333_single','333','single',1200),('sub10_333_single','333','single',1000),
      ('sub8_333_single','333','single',800),('sub20_333_average','333','average',2000),
      ('sub15_333_average','333','average',1500),('sub12_333_average','333','average',1200),
      ('sub10_333_average','333','average',1000),('sub8_222_single','222','single',800),
      ('sub6_222_single','222','single',600),('sub5_222_single','222','single',500),
      ('sub4_222_single','222','single',400),('sub3_222_single','222','single',300),
      ('sub8_222_average','222','average',800),('sub6_222_average','222','average',600),
      ('sub5_222_average','222','average',500),('sub4_222_average','222','average',400),
      ('sub15_pyram_single','pyram','single',1500),('sub12_pyram_single','pyram','single',1200),
      ('sub10_pyram_single','pyram','single',1000),('sub8_pyram_single','pyram','single',800),
      ('sub6_pyram_single','pyram','single',600),('sub15_pyram_average','pyram','average',1500),
      ('sub12_pyram_average','pyram','average',1200),('sub10_pyram_average','pyram','average',1000),
      ('sub15_skewb_single','skewb','single',1500),('sub12_skewb_single','skewb','single',1200),
      ('sub10_skewb_single','skewb','single',1000),('sub8_skewb_single','skewb','single',800),
      ('sub15_skewb_average','skewb','average',1500),('sub12_skewb_average','skewb','average',1200),
      ('sub10_skewb_average','skewb','average',1000),('sub8_skewb_average','skewb','average',800),
      ('sub25_clock_single','clock','single',2500),('sub20_clock_single','clock','single',2000),
      ('sub18_clock_single','clock','single',1800),('sub15_clock_single','clock','single',1500),
      ('sub25_clock_average','clock','average',2500),('sub20_clock_average','clock','average',2000),
      ('sub18_clock_average','clock','average',1800),('sub90_444_single','444','single',9000),
      ('sub80_444_single','444','single',8000),('sub70_444_single','444','single',7000),
      ('sub60_444_single','444','single',6000),('sub90_444_average','444','average',9000),
      ('sub80_444_average','444','average',8000),('sub60_sq1_single','sq1','single',6000),
      ('sub45_sq1_single','sq1','single',4500),('sub30_sq1_single','sq1','single',3000),
      ('sub20_sq1_single','sq1','single',2000),('sub15_sq1_single','sq1','single',1500),
      ('sub60_sq1_average','sq1','average',6000),('sub45_sq1_average','sq1','average',4500),
      ('sub30_sq1_average','sq1','average',3000),('sub20_sq1_average','sq1','average',2000)
  ),
  inserted as (
    insert into achievements (owner_id, cuber_id, badge_key, event_id, metadata)
    select p_owner_id, p_cuber_id, b.badge_key, p_event_id,
           jsonb_build_object('time_cs',
             case when b.record_type = 'single' then v_effective else v_ao5 end)
    from badge_thresholds b
    where b.event_id = p_event_id
      and ((b.record_type = 'single' and v_is_single_pb and v_effective < b.threshold_cs)
        or (b.record_type = 'average' and v_is_average_pb and v_ao5 < b.threshold_cs))
    on conflict (cuber_id, badge_key) do nothing
    returning badge_key
  )
  select coalesce(array_agg(badge_key), array[]::text[]) into v_added from inserted;
  v_new_badges := v_new_badges || v_added;

  select count(*) into v_total_count
  from (
    select 1
    from solves
    where cuber_id = p_cuber_id and context = 'practice'
    limit 1000
  ) milestone_count;

  select coalesce(array_agg(distinct solved_at::date), array[]::date[])
  into v_days
  from solves
  where cuber_id = p_cuber_id and context = 'practice'
    and solved_at >= current_date - 31;

  v_day := current_date;
  if not (v_day = any(v_days)) then v_day := v_day - 1; end if;
  for v_offset in 0..29 loop
    exit when not (v_day - v_offset = any(v_days));
    v_streak := v_streak + 1;
  end loop;

  with candidates(badge_key) as (
    select 'new_pb' where v_is_single_pb or v_is_average_pb
    union all select '100_solves' where v_total_count >= 100
    union all select '1000_solves' where v_total_count >= 1000
    union all select 'streak_7' where v_streak >= 7
    union all select 'streak_30' where v_streak >= 30
  ),
  inserted as (
    insert into achievements (owner_id, cuber_id, badge_key)
    select p_owner_id, p_cuber_id, badge_key from candidates
    on conflict (cuber_id, badge_key) do nothing
    returning badge_key
  )
  select coalesce(array_agg(badge_key), array[]::text[]) into v_added from inserted;
  v_new_badges := v_new_badges || v_added;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'solveId', v_solve_id,
    'count', v_count,
    'bestCs', coalesce(v_best, -1),
    'ao5', nullif(v_ao5, -1),
    'ao12', nullif(v_ao12, -1),
    'isPb', v_is_single_pb or v_is_average_pb,
    'newBadges', to_jsonb(v_new_badges)
  );
end
$$;

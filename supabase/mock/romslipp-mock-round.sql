-- LOCAL DEVELOPMENT ONLY. Never run this against a hosted project.
--
-- Starts a romslipp (as mock70, the mock Romsjef) and lets the first residents in the order
-- answer: every third one moves to the first free room, the others stay. The rest are left
-- waiting, so you can log in as the resident whose turn it is (printed at the end) and answer
-- yourself, or as mock70 / your Admin to answer for them, skip, close or cancel.
-- While a round is open rooms can't be assigned by hand; cancel it to get that back.
--
-- Needs rooms-mock-data.sql first. Cancels any round that is already open (mock or not).
-- Usage: docker exec -i <supabase_db container> psql -U postgres < supabase/mock/romslipp-mock-round.sql

begin;

do $$
begin
  if not exists (select 1 from public.users where email = 'mock70@mock.test') then
    raise exception 'Run vakt-mock-data.sql and rooms-mock-data.sql first.';
  end if;
end $$;

update public.romslipp_rounds set status = 'cancelled', closed_at = now() where status = 'open';

do $$
declare
  v_manager uuid := (select id from public.users where email = 'mock70@mock.test');
  v_round uuid;
  v_turn uuid;
  v_room uuid;
  v_step int := 0;
begin
  -- Act as the mock Romsjef so the database functions see a signed-in room manager.
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_round := public.start_romslipp('mock');

  loop
    exit when v_step >= 14;
    select user_id into v_turn
    from public.romslipp_participants
    where round_id = v_round and status = 'waiting'
    order by position
    limit 1;
    exit when v_turn is null;

    v_step := v_step + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_turn, 'role', 'authenticated')::text, true);

    v_room := null;
    if v_step % 3 = 0 then
      select a.room_id into v_room
      from public.romslipp_available_rooms(v_round) a
      join public.romslipp_participants p on p.round_id = v_round and p.user_id = v_turn
      where a.room_id is distinct from p.from_room_id
      order by a.number
      limit 1;
    end if;

    perform public.romslipp_answer(v_round, v_room);
  end loop;

  execute 'reset role';
end $$;

commit;

select 'round' as what, status, semester_key as detail from public.romslipp_rounds where status = 'open'
union all select 'answered', status, count(*)::text from public.romslipp_participants
  where round_id = (select id from public.romslipp_rounds where status = 'open') group by status
union all select 'on turn', u.email, 'position ' || p.position
  from public.romslipp_participants p join public.users u on u.id = p.user_id
  where p.round_id = (select id from public.romslipp_rounds where status = 'open') and p.status = 'waiting'
  order by 1 desc limit 3;

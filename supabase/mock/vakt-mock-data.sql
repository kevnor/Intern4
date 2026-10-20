-- LOCAL DEVELOPMENT ONLY. Never run this against a hosted project.
--
-- Fills the local database with mock residents and a published vakt schedule for the current
-- semester, so the Vakt pages have something to show:
--   * ~70 residents (@mock.test, password "mock1234"): Full Vakt, Halv/Halv, Full Regi,
--     one Vaktsjef and one resident on leave
--   * unavailable days, a fair auto-assigned and published schedule (same rules as the app:
--     targets from the 48 h requirement, 12 h rest, unavailable days)
--   * shifts up for swap (some with an offer), and a history of past swaps
--   * a few shifts for the first real Admin so "Mine vakter" and "Bytter" aren't empty
--
-- Safe to run again: it removes the mock residents (and the regi mock data that refers to them)
-- and recreates everything. Run regi-mock-data.sql afterwards for regi hours and tasks.
-- Usage: docker exec -i <supabase_db container> psql -U postgres < supabase/mock/vakt-mock-data.sql

begin;

-- 1. Clean up an earlier run -------------------------------------------------------------------
-- Regi mock data points at the mock residents, so it has to go first (see regi-mock-data.sql).
delete from public.work_assignments
  where user_uuid in (select id from public.users where email like '%@mock.test')
     or work_id in (select id from public.work_items where description like '%(mock)');
delete from public.work_tasks where id in (select id from public.work_items where description like '%(mock)');
delete from public.work_misc where id in (select id from public.work_items where description like '%(mock)');
delete from public.work_items where description like '%(mock)';
delete from public.work_categories where description like '%(mock)';

update public.vakt_shifts set user_id = null;
delete from public.vakt_swap_log;
delete from public.vakt_unavailability
  where user_id in (select id from public.users where email like '%@mock.test');
delete from public.users where email like '%@mock.test';
delete from auth.identities where user_id in (select id from auth.users where email like '%@mock.test');
delete from auth.users where email like '%@mock.test';

-- 2. Make sure there are shifts for the whole semester ---------------------------------------
-- Same slots as the app: 00-08 and 16-24 every day, 08-16 on weekends (Europe/Oslo).
do $$
declare
  v_start date := case when extract(month from now() at time zone 'Europe/Oslo') < 8
                       then make_date(extract(year from now())::int, 1, 1)
                       else make_date(extract(year from now())::int, 8, 1) end;
  v_end date := case when extract(month from now() at time zone 'Europe/Oslo') < 8
                     then make_date(extract(year from now())::int, 8, 1)
                     else make_date(extract(year from now())::int + 1, 1, 1) end;
  v_day date;
  v_hour int;
  v_type text;
  v_starts timestamptz;
begin
  for v_day in select generate_series(v_start, v_end - 1, interval '1 day')::date loop
    foreach v_hour in array array[0, 8, 16] loop
      if v_hour = 8 and extract(isodow from v_day) < 6 then continue; end if;
      v_type := case v_hour when 0 then 'natt' when 8 then 'dag' else 'kveld' end;
      v_starts := (v_day + make_interval(hours => v_hour)) at time zone 'Europe/Oslo';
      insert into public.vakt_shifts (starts_at, ends_at, slot_type, status)
      values (v_starts, v_starts + interval '8 hours', v_type, 'published')
      on conflict (starts_at) do nothing;
    end loop;
  end loop;
end $$;

update public.vakt_shifts set status = 'published';

-- 3. Residents -----------------------------------------------------------------------------
create temp table mock_residents (
  n int, id uuid, name text, email text, role text, on_leave boolean, room int
) on commit drop;

insert into mock_residents (n, id, name, email, role, on_leave, room)
select
  g,
  gen_random_uuid(),
  (array['Anders','Maria','Jonas','Emma','Henrik','Nora','Sander','Ingrid','Mathias','Sofie',
         'Magnus','Julie','Eirik','Thea','Kristian','Amalie','Fredrik','Hanna','Sebastian','Kaja',
         'Lars','Ida','Tobias','Emilie','Oskar','Maja','Markus','Sara','Daniel','Live'])[1 + (g * 7) % 30]
  || ' ' ||
  (array['Hansen','Johansen','Olsen','Larsen','Andersen','Pedersen','Nilsen','Kristiansen','Jensen',
         'Karlsen','Johnsen','Pettersen','Eriksen','Berg','Haugen','Hagen','Johannessen','Andreassen',
         'Jacobsen','Dahl','Jørgensen','Halvorsen','Henriksen','Lund','Sørensen'])[1 + (g * 11) % 25],
  'mock' || lpad(g::text, 2, '0') || '@mock.test',
  case
    when g = 1 then 'Vaktsjef'
    when g <= 43 then 'Full Vakt'
    when g <= 67 then 'Halv/Halv'
    else 'Full Regi'
  end,
  g = 43,                      -- one Full Vakt resident is on leave
  100 + g
from generate_series(1, 70) g;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
select
  id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
  extensions.crypt('mock1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', ''
from mock_residents;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
from mock_residents;

insert into public.users (id, name, email, role_id, is_active, on_leave, room_number, seniority, country)
select r.id, r.name, r.email, (select id from public.roles where name = r.role), true, r.on_leave,
       r.room, 1 + r.n % 6, 'Norge'
from mock_residents r;

-- 4. Unavailable days (the schedule is built around them) ----------------------------------
insert into public.vakt_unavailability (user_id, from_date, to_date, note)
select r.id,
       (current_date + (r.n * 3 % 60))::date,
       (current_date + (r.n * 3 % 60) + (r.n % 4))::date,
       (array['Eksamen','Hjemme hos familien','Reiser','Jobb','Konferanse'])[1 + r.n % 5]
from mock_residents r
where r.role in ('Full Vakt', 'Halv/Halv') and r.n % 3 = 0;

-- 5. Fair auto-assignment, like the app's generator ------------------------------------------
-- Chronologically, each shift goes to the available, rested resident furthest from their target
-- (6 shifts for Full Vakt, 3 for Halv/Halv), balancing night/evening/day shifts. Nobody exceeds
-- their target and there is at least 12 h between a resident's shifts.
create temp table mock_state (
  id uuid primary key, target int, done int default 0,
  last_end timestamptz default '-infinity',
  natt int default 0, dag int default 0, kveld int default 0
) on commit drop;

insert into mock_state (id, target)
select id, case role when 'Full Vakt' then 6 else 3 end
from mock_residents
where role in ('Full Vakt', 'Halv/Halv') and not on_leave;

do $$
declare
  v_shift record;
  v_pick uuid;
begin
  for v_shift in select id, starts_at, ends_at, slot_type from public.vakt_shifts order by starts_at loop
    select s.id into v_pick
    from mock_state s
    where s.done < s.target
      and s.last_end + interval '12 hours' <= v_shift.starts_at
      and not exists (
        select 1 from public.vakt_unavailability u
        where u.user_id = s.id
          and (v_shift.starts_at at time zone 'Europe/Oslo')::date between u.from_date and u.to_date
      )
    order by (s.target - s.done)::numeric / s.target desc,
             case v_shift.slot_type when 'natt' then s.natt when 'dag' then s.dag else s.kveld end,
             s.last_end,
             s.id
    limit 1;

    if v_pick is not null then
      update public.vakt_shifts set user_id = v_pick where id = v_shift.id;
      update mock_state set
        done = done + 1,
        last_end = v_shift.ends_at,
        natt = natt + (v_shift.slot_type = 'natt')::int,
        dag = dag + (v_shift.slot_type = 'dag')::int,
        kveld = kveld + (v_shift.slot_type = 'kveld')::int
      where id = v_pick;
    end if;
  end loop;
end $$;

-- 6. Swaps -----------------------------------------------------------------------------------
-- Upcoming assigned shifts that are up for swap, some with an offer.
with upcoming as (
  select id, row_number() over (order by starts_at) rn
  from public.vakt_shifts
  where user_id is not null and starts_at > now() + interval '1 day'
    and user_id in (select id from mock_residents)
)
update public.vakt_shifts s
set swap_requested = true,
    swap_offer_amount = (array[null, 100, 200, 300, 150, null, 250])[1 + (u.rn / 5 % 7)::int],
    swap_note = (array['Eksamen','Syk','Reiser bort','Har jobb','Bursdag',null,'Familiebesøk'])[1 + (u.rn / 5 % 7)::int]
from upcoming u
where s.id = u.id and u.rn % 5 = 0 and u.rn <= 40;

-- Past swaps between mock residents: the shift now belongs to the taker.
with past as (
  select s.id, s.starts_at, s.slot_type, s.user_id,
         row_number() over (order by s.starts_at desc) rn
  from public.vakt_shifts s
  where s.user_id in (select id from mock_residents) and s.starts_at < now()
)
insert into public.vakt_swap_log (shift_id, shift_starts_at, slot_type, from_user_id, to_user_id, amount, paid, created_at)
select p.id, p.starts_at, p.slot_type,
       (select id from mock_residents where n = 2 + p.rn::int % 20),
       p.user_id,
       (array[null, 100, 200, 150])[1 + p.rn::int % 4],
       p.rn % 3 <> 0,
       p.starts_at - interval '6 days'
from past p
where p.rn <= 8;

-- 7. A few shifts for the first real Admin ---------------------------------------------------
-- Taken over from whoever had them, so the schedule stays full. Two are finished (with a swap
-- history: one taken, one given back) and three are coming up, one of them up for swap.
do $$
declare
  v_admin uuid;
  v_shift record;
  v_other uuid;
begin
  select u.id into v_admin
  from public.users u join public.roles r on r.id = u.role_id
  where r.name = 'Admin' and u.email not like '%@mock.test'
  order by u.created_at limit 1;
  if v_admin is null then return; end if;

  -- Finished: taken from a mock resident for 150 kr (not paid yet).
  select * into v_shift from public.vakt_shifts
  where user_id in (select id from mock_residents) and slot_type = 'kveld' and starts_at < now() - interval '14 days'
  order by starts_at desc limit 1;
  insert into public.vakt_swap_log (shift_id, shift_starts_at, slot_type, from_user_id, to_user_id, amount, paid, created_at)
  values (v_shift.id, v_shift.starts_at, v_shift.slot_type, v_shift.user_id, v_admin, 150, false, v_shift.starts_at - interval '5 days');
  update public.vakt_shifts set user_id = v_admin where id = v_shift.id;

  -- Finished: a night shift, and it was paid for earlier by giving another one away.
  update public.vakt_shifts set user_id = v_admin
  where id = (select id from public.vakt_shifts
              where user_id in (select id from mock_residents) and slot_type = 'natt' and starts_at < now() - interval '3 days'
              order by starts_at desc limit 1);

  select id into v_other from mock_residents where n = 9;
  insert into public.vakt_swap_log (shift_id, shift_starts_at, slot_type, from_user_id, to_user_id, amount, paid, created_at)
  select id, starts_at, slot_type, v_admin, user_id, 100, true, starts_at - interval '4 days'
  from public.vakt_shifts
  where user_id in (select id from mock_residents) and slot_type = 'kveld' and starts_at < now() - interval '7 days' and starts_at > now() - interval '12 days'
  order by starts_at desc limit 1;

  -- Upcoming: an evening in 2 days, a weekend day shift and a night.
  update public.vakt_shifts set user_id = v_admin
  where id in (
    (select id from public.vakt_shifts where user_id in (select id from mock_residents) and slot_type = 'kveld' and starts_at > now() + interval '2 days' order by starts_at limit 1),
    (select id from public.vakt_shifts where user_id in (select id from mock_residents) and slot_type = 'dag'   and starts_at > now() + interval '5 days' order by starts_at limit 1),
    (select id from public.vakt_shifts where user_id in (select id from mock_residents) and slot_type = 'natt'  and starts_at > now() + interval '9 days' order by starts_at limit 1)
  );

  -- The last of those is up for swap with an offer.
  update public.vakt_shifts
  set swap_requested = true, swap_offer_amount = 200, swap_note = 'Trenger fri'
  where id = (select id from public.vakt_shifts where user_id = v_admin and starts_at > now() order by starts_at desc limit 1);
end $$;

commit;

-- Summary
select 'residents' as what, count(*) from public.users where email like '%@mock.test'
union all select 'shifts', count(*) from public.vakt_shifts
union all select 'assigned', count(user_id) from public.vakt_shifts
union all select 'published', count(*) from public.vakt_shifts where status = 'published'
union all select 'up for swap', count(*) from public.vakt_shifts where swap_requested
union all select 'swap history', count(*) from public.vakt_swap_log
union all select 'unavailable periods', count(*) from public.vakt_unavailability;

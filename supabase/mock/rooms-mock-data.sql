-- LOCAL DEVELOPMENT ONLY. Never run this against a hosted project.
--
-- Mock rooms data on top of the mock residents (run vakt-mock-data.sql first, and
-- regi-mock-data.sql if you want work on rooms):
--   * room types for every room, some parhybels with two residents, and a Husfar in husfarhybelen
--   * room history: earlier stays for current residents and 12 former residents
--   * 8 problem reports (open, with a task, resolved, dismissed) and a few regi entries on rooms
--   * mock69 is made Regisjef and mock70 Romsjef, so you can log in as the people who handle rooms
--   * the first real Admin gets a room (263) if they have none, with a report
--
-- Room types stay set after a re-run (the room list is static). Safe to run again: it rebuilds the
-- mock residents' stays, reports and former residents. To also try a romslipp, run
-- romslipp-mock-round.sql afterwards.
-- Usage: docker exec -i <supabase_db container> psql -U postgres < supabase/mock/rooms-mock-data.sql

begin;

do $$
begin
  if not exists (select 1 from public.users where email like 'mock%@mock.test') then
    raise exception 'Run supabase/mock/vakt-mock-data.sql first: there are no mock residents.';
  end if;
end $$;

-- 1. Clean up an earlier run -------------------------------------------------------------------
delete from public.romslipp_rounds
  where created_by in (select id from public.users where email like '%@mock.test');
delete from public.room_reports
  where reported_by in (select id from public.users where email like '%@mock.test');
delete from public.users where email like 'old%@mock.test';

create temp table mock_residents on commit drop as
select u.id, substring(u.email from 5 for 2)::int as n, u.room_number
from public.users u
where u.email like 'mock%@mock.test';

-- The stays are rebuilt below; the sync trigger resets room_number until then.
delete from public.room_occupancies where user_id in (select id from mock_residents);
update public.users set is_husfar = false where email like 'mock%@mock.test';

-- 2. Room types ------------------------------------------------------------------------------
update public.rooms set type = case
  when number = 60 then 'husfarhybel'
  when number between 100 and 119 then 'bottekott'
  when number between 120 and 139 then 'korrhybel'
  when number between 140 and 159 then 'liten_parhybel'
  when number between 160 and 173 then 'stor_parhybel'
  when number between 200 and 219 then 'bottekott'
  when number between 220 and 249 then 'korrhybel'
  when number between 250 and 259 then 'liten_parhybel'
  else 'stor_parhybel'
end;

-- 3. Roles, seniority and the Husfar -----------------------------------------------------------
update public.users set role_id = (select id from public.roles where name = 'Regisjef')
  where email = 'mock69@mock.test';
update public.users set role_id = (select id from public.roles where name = 'Romsjef')
  where email = 'mock70@mock.test';
update public.users u set seniority = 1 + (m.n * 7) % 8 from mock_residents m where u.id = m.id;
update public.users set is_husfar = true where email = 'mock05@mock.test';

-- 4. Current stays -----------------------------------------------------------------------------
-- mock51-60 share rooms with mock41-50 (liten parhybel) and mock05 lives in husfarhybelen. The
-- time everyone has lived in their room varies from 2023 to 2025, which decides ties in a romslipp.
create temp table current_stays on commit drop as
select m.id as user_id,
       m.n,
       r.id as room_id,
       (date '2025-08-01' - (m.n % 5) * 182) as moved_in
from mock_residents m
join public.rooms r on r.number = case
  when m.n = 5 then 60
  when m.n between 51 and 60 then 90 + m.n
  else m.room_number
end
where m.room_number > 0;

insert into public.room_occupancies (room_id, user_id, moved_in)
select room_id, user_id, moved_in from current_stays;

-- Earlier stays for every third resident, and a second one before that for every sixth.
insert into public.room_occupancies (room_id, user_id, moved_in, moved_out)
select r.id, c.user_id, c.moved_in - 365, c.moved_in
from current_stays c
join public.rooms r on r.number = 200 + c.n
where c.n % 3 = 0 and c.n <> 5;

insert into public.room_occupancies (room_id, user_id, moved_in, moved_out)
select r.id, c.user_id, c.moved_in - 730, c.moved_in - 365
from current_stays c
join public.rooms r on r.number = 180 + c.n % 20 + 20
where c.n % 6 = 0 and c.n <> 5;

-- 5. Former residents --------------------------------------------------------------------------
insert into public.users (id, name, email, role_id, is_active, on_leave, room_number, seniority,
                          created_at, country)
select gen_random_uuid(),
       (array['Gunnar Moen','Silje Aas','Håkon Vik','Tuva Solberg','Ole Brekke','Mina Lie',
              'Jakob Strand','Frida Næss','Per Holm','Aurora Dahl','Ivar Sæther','Lena Krog'])[g],
       'old' || lpad(g::text, 2, '0') || '@mock.test',
       (select id from public.roles where name = 'Halv/Halv'),
       false, false, 0, 6 + g % 4,
       (date '2021-08-01' + g * 90)::timestamptz, 'Norge'
from generate_series(1, 12) g;

-- Each lived in one or two rooms between 2021 and 2025; some in rooms that are occupied now.
insert into public.room_occupancies (room_id, user_id, moved_in, moved_out)
select r.id, o.id, o.moved_in, o.moved_out
from (
  select u.id, row_number() over (order by u.email) as g,
         (date '2021-08-01' + (row_number() over (order by u.email))::int * 90) as moved_in,
         (date '2021-08-01' + (row_number() over (order by u.email))::int * 90 + 540) as moved_out
  from public.users u where u.email like 'old%@mock.test'
) o
join public.rooms r on r.number = 101 + (o.g::int * 5) % 70;

insert into public.room_occupancies (room_id, user_id, moved_in, moved_out)
select r.id, o.id, o.moved_out, o.moved_out + 400
from (
  select u.id, row_number() over (order by u.email) as g,
         (date '2021-08-01' + (row_number() over (order by u.email))::int * 90 + 540) as moved_out
  from public.users u where u.email like 'old%@mock.test'
) o
join public.rooms r on r.number = 150 + (o.g::int * 3) % 20
where o.g % 2 = 0;

-- 6. The first real Admin gets a room ------------------------------------------------------------
insert into public.room_occupancies (room_id, user_id, moved_in)
select r.id, u.id, date '2025-08-01'
from public.users u
join public.roles ro on ro.id = u.role_id and ro.name = 'Admin'
join public.rooms r on r.number = 263
where u.email not like '%@mock.test'
  and u.is_active
  and not exists (select 1 from public.room_occupancies o where o.user_id = u.id and o.moved_out is null)
  and u.id = (
    select u2.id from public.users u2 join public.roles r2 on r2.id = u2.role_id
    where r2.name = 'Admin' and u2.email not like '%@mock.test' order by u2.created_at limit 1
  );

-- 7. Problem reports -----------------------------------------------------------------------------
create temp table report_input (n int, title text, description text, status text, days_ago int) on commit drop;
insert into report_input values
  (12, 'Ødelagt lås på døra',        'Døra går ikke i lås, og nøkkelen sitter fast.',             'open',         3),
  (30, 'Mugg på badet',              'Svart mugg i hjørnet ved dusjen. Lukter fuktig.',            'open',         6),
  (44, 'Vindu som ikke lukker seg',  'Vinduet blir stående på gløtt og det trekker hele natta.',   'open',         1),
  (63, 'Radiatoren er kald',         null,                                                         'open',         9),
  (21, 'Lyspære i taket',            'Taklampen virker ikke, trolig ikke bare pæra.',              'task_created', 14),
  (37, 'Skade i veggen',             'Hull etter at en hylle falt ned. Trenger sparkling og maling.', 'task_created', 20),
  (8,  'Kranen drypper',             'Vasken drypper hele tiden.',                                 'resolved',     30),
  (52, 'Støy fra ventilasjonen',     'Ventilasjonen durer. Kanskje normalt?',                      'dismissed',    25);

insert into public.room_reports (room_id, reported_by, title, description, status, created_at)
select c.room_id, c.user_id, i.title, i.description, i.status, now() - make_interval(days => i.days_ago)
from report_input i
join current_stays c on c.n = i.n;

-- Reports that have become tasks get a real regi task tied to the room.
do $$
declare
  v_report record;
  v_item bigint;
  v_category bigint := (select id from public.work_categories
                        where name = 'Vedlikehold' and description like '%(mock)' limit 1);
begin
  for v_report in
    select rr.id, rr.room_id, rr.title, r.number
    from public.room_reports rr
    join public.rooms r on r.id = rr.room_id
    where rr.status = 'task_created' and rr.reported_by in (select id from public.users where email like 'mock%@mock.test')
  loop
    if v_category is null then
      insert into public.work_categories (name, description, color)
      values ('Vedlikehold', 'Små reparasjoner (mock)', '#2563eb')
      returning id into v_category;
    end if;
    insert into public.work_items (work_category_id, type, title, description, room_id)
    values (v_category, 'task', 'Rom ' || v_report.number || ': ' || v_report.title,
            'Opprettet fra melding om rommet (mock)', v_report.room_id)
    returning id into v_item;
    insert into public.work_tasks (id, deadline, time_estimate, max_participants)
    values (v_item, current_date + 14, 2, 1);
    update public.room_reports set work_item_id = v_item where id = v_report.id;
  end loop;
end $$;

-- A report from the first real Admin about their own room.
insert into public.room_reports (room_id, reported_by, title, description, status, created_at)
select o.room_id, o.user_id, 'Dørhåndtaket sitter løst', 'Håndtaket på innsiden henger og kan falle av.',
       'open', now() - interval '2 days'
from public.room_occupancies o
join public.users u on u.id = o.user_id
join public.roles ro on ro.id = u.role_id and ro.name = 'Admin'
where o.moved_out is null and u.email not like '%@mock.test'
  and o.room_id = (select id from public.rooms where number = 263)
  and not exists (select 1 from public.room_reports x where x.reported_by = u.id)
limit 1;

-- 8. Regi work done on rooms --------------------------------------------------------------------
update public.work_items w
set room_id = (select id from public.rooms where number = 100 + (w.id % 70)::int)
where w.type = 'misc' and w.description like '%(mock)' and w.id % 4 = 0;

commit;

select 'rooms with a type' as what, count(*) from public.rooms where type is not null
union all select 'current stays', count(*) from public.room_occupancies where moved_out is null
union all select 'past stays', count(*) from public.room_occupancies where moved_out is not null
union all select 'shared parhybels (2 residents)', count(*) from (
  select room_id from public.room_occupancies where moved_out is null group by room_id having count(*) = 2) s
union all select 'former residents', count(*) from public.users where email like 'old%@mock.test'
union all select 'reports', count(*) from public.room_reports
union all select 'regi entries on rooms', count(*) from public.work_items where room_id is not null and type = 'misc';

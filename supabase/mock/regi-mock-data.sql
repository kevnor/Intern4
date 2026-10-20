-- LOCAL DEVELOPMENT ONLY. Never run this against a hosted project.
--
-- Mock regi data for the residents created by vakt-mock-data.sql (run that first):
--   * 6 categories and ~18 tasks (open, full, past deadlines) with participants in every
--     state: joined, submitted, approved and rejected
--   * manual hour registrations spread over the semester, so the Status table shows residents
--     who are done, halfway, just started and not started
--   * pending approvals for the Godkjenning tab
--   * a few entries for the first real Admin, so Hjem and "Mine timer" have something to show
--
-- Everything created here has "(mock)" at the end of its description, which is how a re-run
-- (and vakt-mock-data.sql) finds it again to delete it.
-- Usage: docker exec -i <supabase_db container> psql -U postgres < supabase/mock/regi-mock-data.sql

begin;

-- 1. Clean up an earlier run -------------------------------------------------------------------
delete from public.work_assignments
  where user_uuid in (select id from public.users where email like '%@mock.test')
     or work_id in (select id from public.work_items where description like '%(mock)');
delete from public.work_tasks where id in (select id from public.work_items where description like '%(mock)');
delete from public.work_misc where id in (select id from public.work_items where description like '%(mock)');
delete from public.work_items where description like '%(mock)';
delete from public.work_categories where description like '%(mock)';

do $$
begin
  if not exists (select 1 from public.users where email like '%@mock.test') then
    raise exception 'Run supabase/mock/vakt-mock-data.sql first: there are no mock residents.';
  end if;
end $$;

-- 2. Categories ------------------------------------------------------------------------------
insert into public.work_categories (name, description, color)
values
  ('Kjøkken',              'Matlaging og kjøkkenvakt (mock)', '#f59e0b'),
  ('Hage og uteområder',   'Hagearbeid og måking (mock)',     '#16a34a'),
  ('Vedlikehold',          'Små reparasjoner (mock)',         '#2563eb'),
  ('Rengjøring',           'Felles områder (mock)',           '#0891b2'),
  ('Arrangement',          'Fester og dugnader (mock)',       '#9333ea'),
  ('IT og nett',           'Nettside og wifi (mock)',         '#475569');

-- 3. Who can do regi ---------------------------------------------------------------------------
-- Everyone but Full Vakt owes regi; Halv/Halv owe half. Full Vakt only do the odd voluntary task.
create temp table pool on commit drop as
select row_number() over (order by u.email) as idx,
       u.id, substring(u.email from 5 for 2)::int as n, r.name as role
from public.users u join public.roles r on r.id = u.role_id
where u.email like 'mock%@mock.test' and r.name in ('Vaktsjef', 'Full Regi', 'Halv/Halv') and not u.on_leave;

create temp table approver on commit drop as
select coalesce(
  (select u.id from public.users u join public.roles r on r.id = u.role_id
   where r.name = 'Admin' and u.email not like '%@mock.test' order by u.created_at limit 1),
  (select id from public.users where email = 'mock01@mock.test')
) as id;

-- 4. Tasks -------------------------------------------------------------------------------------
do $$
declare
  titles text[] := array[
    'Male fellesstuen','Rydde bodene','Klippe hekken','Måke trappene','Handle inn til fredagsmiddag',
    'Vaske kjøkkenet','Bytte lyspærer i gangen','Pakke ut vinkjeller','Sette opp julepynt',
    'Hjelpe til på høstdugnaden','Rydde sykkelparkeringen','Reparere døren til bryggerhuset',
    'Oppdatere wifi-plakaten','Vaske vinduer i stua','Lage mat til husmøtet',
    'Flytte møbler til arrangement','Fikse hagemøbler','Rense takrenner'];
  cats bigint[];
  pool_size int := (select count(*) from pool);
  i int; j int; k int;
  v_item bigint;
  v_deadline date;
  v_hours int;
  v_max int;
  v_user uuid;
  v_state int;
  v_performed date;
  v_approver uuid := (select id from approver);
  v_roll int;
begin
  select array_agg(id order by id) into cats from public.work_categories where description like '%(mock)';

  for i in 1..array_length(titles, 1) loop
    v_hours := 2 + i % 5;
    v_max := 1 + i % 4;
    -- Deadlines from seven weeks ago to three and a half weeks ahead.
    v_deadline := current_date - 50 + (i * 4);

    insert into public.work_items (work_category_id, type, title, description)
    values (cats[1 + i % 6], 'task', titles[i], 'Oppgave for beboerne (mock)')
    returning id into v_item;

    insert into public.work_tasks (id, deadline, time_estimate, contact_person_uuid, max_participants)
    values (v_item, v_deadline, v_hours,
            (select id from pool where idx = 1 + (i * 3) % pool_size), v_max);

    -- Past tasks are mostly full; the coming ones are filled up to half (some stay empty).
    for j in 1..(case when v_deadline < current_date then v_max else (v_max * (i % 3)) / 2 end) loop
      v_user := (select id from pool where idx = 1 + (i * 5 + j * 3) % pool_size);
      v_roll := (i * 7 + j * 3) % 10;

      if v_deadline < current_date then
        v_state := case when v_roll < 6 then 1 when v_roll < 8 then 3 when v_roll < 9 then 2 else 4 end;
      else
        v_state := case when v_roll < 6 then 0 else 3 end;
      end if;
      -- 0 = joined (no hours yet), 1 = approved, 2 = rejected, 3 = submitted (pending), 4 = joined but never sent in
      v_performed := least(coalesce(v_deadline, current_date) - (j % 3), current_date);

      insert into public.work_assignments
        (user_uuid, work_id, hours_used, approved_state, approval_comment, approved_by_uuid, performed_at, created_at)
      values (
        v_user, v_item,
        case when v_state in (0, 4) then null else v_hours end,
        case v_state when 1 then 1 when 2 then 2 else 0 end,
        case v_state when 2 then 'Oppgaven var ikke ferdig. Fiks og send inn på nytt.' else null end,
        case when v_state in (1, 2) then v_approver else null end,
        case when v_state in (0, 4) then current_date else v_performed end,
        (v_performed - 3)::timestamptz
      );
    end loop;
  end loop;
end $$;

-- 5. Manual registrations ------------------------------------------------------------------
-- Each resident registers hours until they reach a share of their requirement, so Status shows
-- everyone from "done" to "not started".
do $$
declare
  r record;
  misc_titles text[] := array['Hjalp til på dugnad','Vasket trappeoppgangen','Tok imot leveranse',
    'Sorterte pant','Hjalp til på fest','Kjørte ut søppel','Ryddet fellesrommet','Stekte vafler til husmøtet'];
  cats bigint[];
  v_item bigint;
  v_sum numeric;
  v_need numeric;
  v_hours numeric;
  v_state int;
  v_date date;
  k int;
  v_start date := case when extract(month from current_date) < 8
                       then make_date(extract(year from current_date)::int, 1, 1)
                       else make_date(extract(year from current_date)::int, 8, 1) end;
  v_days int := greatest(current_date - v_start, 1);
  v_approver uuid := (select id from approver);
begin
  select array_agg(id order by id) into cats from public.work_categories where description like '%(mock)';

  for r in select * from pool loop
    v_need := (case when r.role = 'Halv/Halv' then 24 else 48 end)
              * (array[0.9, 0.55, 0.2, 0.0])[1 + r.n % 4];
    v_sum := 0;
    k := 0;
    while v_sum < v_need loop
      k := k + 1;
      v_hours := 2 + (r.n + k) % 3;
      v_date := v_start + ((r.n * 13 + k * 17) % v_days);
      v_state := case when (r.n + k) % 9 = 0 then 2 when (r.n + k) % 7 = 0 then 0 else 1 end;

      insert into public.work_items (work_category_id, type, title, description)
      values (cats[1 + (r.n + k) % 6], 'misc', misc_titles[1 + (r.n + k) % 8], 'Registrert av beboer (mock)')
      returning id into v_item;
      insert into public.work_misc (id) values (v_item);

      insert into public.work_assignments
        (user_uuid, work_id, hours_used, approved_state, approval_comment, approved_by_uuid, performed_at, created_at)
      values (r.id, v_item, v_hours, v_state,
              case v_state when 2 then 'Mangler bilde. Registrer på nytt med dokumentasjon.' else null end,
              case when v_state <> 0 then v_approver else null end,
              v_date, v_date::timestamptz + interval '18 hours');

      if v_state = 1 then v_sum := v_sum + v_hours; end if;
      exit when k > 40;
    end loop;
  end loop;
end $$;

-- A few Full Vakt residents also did one voluntary regi task.
insert into public.work_items (work_category_id, type, title, description)
select (select id from public.work_categories where name = 'Arrangement' and description like '%(mock)'),
       'misc', 'Hjalp til på fest', 'Frivillig innsats (mock)'
from generate_series(1, 4);

with new_items as (
  select id, row_number() over (order by id) rn
  from public.work_items where description = 'Frivillig innsats (mock)'
), vakt_users as (
  select u.id, row_number() over (order by u.email) rn
  from public.users u join public.roles r on r.id = u.role_id
  where u.email like 'mock%@mock.test' and r.name = 'Full Vakt' and not u.on_leave
), inserted_misc as (
  insert into public.work_misc (id) select id from new_items returning id
)
insert into public.work_assignments (user_uuid, work_id, hours_used, approved_state, approved_by_uuid, performed_at)
select v.id, n.id, 3, 1, (select id from approver), current_date - (n.rn::int * 6)
from new_items n join vakt_users v on v.rn = n.rn + 2;

-- 6. The first real Admin ------------------------------------------------------------------
do $$
declare
  v_admin uuid := (select u.id from public.users u join public.roles r on r.id = u.role_id
                   where r.name = 'Admin' and u.email not like '%@mock.test' order by u.created_at limit 1);
  v_manager uuid := (select id from public.users where email = 'mock01@mock.test');
  v_item bigint;
  v_cat bigint := (select id from public.work_categories where name = 'Vedlikehold' and description like '%(mock)');
begin
  if v_admin is null then return; end if;

  -- A task they joined but haven't sent in (shows under "Å gjøre").
  select id into v_item from public.work_items where title = 'Hjelpe til på høstdugnaden' and description like '%(mock)';
  insert into public.work_assignments (user_uuid, work_id, approved_state, performed_at)
  values (v_admin, v_item, 0, current_date);

  -- One approved and one rejected manual registration.
  insert into public.work_items (work_category_id, type, title, description)
  values (v_cat, 'misc', 'Byttet lyspære i kjelleren', 'Registrert av beboer (mock)') returning id into v_item;
  insert into public.work_misc (id) values (v_item);
  insert into public.work_assignments (user_uuid, work_id, hours_used, approved_state, approved_by_uuid, performed_at)
  values (v_admin, v_item, 1, 1, v_manager, current_date - 12);

  insert into public.work_items (work_category_id, type, title, description)
  values (v_cat, 'misc', 'Rydde loftet', 'Registrert av beboer (mock)') returning id into v_item;
  insert into public.work_misc (id) values (v_item);
  insert into public.work_assignments
    (user_uuid, work_id, hours_used, approved_state, approval_comment, approved_by_uuid, performed_at)
  values (v_admin, v_item, 4, 2, 'Mangler bilde. Registrer på nytt med dokumentasjon.', v_manager, current_date - 5);
end $$;

commit;

-- Summary
select 'categories' as what, count(*) from public.work_categories where description like '%(mock)'
union all select 'tasks', count(*) from public.work_items where type = 'task' and description like '%(mock)'
union all select 'manual registrations', count(*) from public.work_items where type = 'misc' and description like '%(mock)'
union all select 'approved', count(*) from public.work_assignments where approved_state = 1
union all select 'pending (hours sent in)', count(*) from public.work_assignments where approved_state = 0 and hours_used is not null
union all select 'joined (not sent in)', count(*) from public.work_assignments where approved_state = 0 and hours_used is null
union all select 'rejected', count(*) from public.work_assignments where approved_state = 2;

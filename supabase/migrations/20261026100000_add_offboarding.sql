-- Offboarding: one place for what happens when a resident moves out, a planned move-out date, and a
-- small log of who added, moved out and reactivated residents.

alter table public.users add column if not exists move_out_date date;

-- The people who may add, move out and reactivate residents. The edge functions and the app use the
-- same list (Admin, Data, Romsjef).
create or replace function public.is_user_manager()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name in ('Admin', 'Data', 'Romsjef')
  );
$function$;

revoke execute on function public.is_user_manager() from public, anon;
grant execute on function public.is_user_manager() to authenticated;

-- Whether the caller may move out (or add, or reactivate) someone who holds p_target_role. Only Admin
-- and Data touch a management role, and only Admin touches an Admin. The same rule as canManageRole in
-- the edge functions; it is repeated here because plan_move_out is called straight from the app.
create or replace function public.can_manage_role(p_target_role text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_caller text := public.current_user_role_name();
begin
  if v_caller is null then
    return false;
  end if;
  if v_caller = 'Admin' then
    return true;
  end if;
  if p_target_role = 'Admin' then
    return false;
  end if;
  if v_caller = 'Data' then
    return true;
  end if;
  return p_target_role not in ('Admin', 'Data', 'Regisjef', 'Romsjef', 'Daglig leder');
end;
$function$;

revoke execute on function public.can_manage_role(text) from public, anon;
grant execute on function public.can_manage_role(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Log
-- ---------------------------------------------------------------------------------------------

create table if not exists public.resident_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (
    kind in ('added', 'move_out_planned', 'move_out_cancelled', 'moved_out', 'reactivated')
  ),
  actor_id uuid references public.users (id) on delete set null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resident_events_user_idx
  on public.resident_events (user_id, created_at desc);

alter table public.resident_events enable row level security;

-- Written only by the functions below and the edge functions (service role).
revoke all on table public.resident_events from anon, authenticated;
grant select on table public.resident_events to authenticated;
grant select, insert, update, delete on table public.resident_events to service_role;

drop policy if exists "User managers can read resident events" on public.resident_events;
create policy "User managers can read resident events"
  on public.resident_events for select
  to authenticated
  using (public.is_user_manager());

-- ---------------------------------------------------------------------------------------------
-- Moving out
-- ---------------------------------------------------------------------------------------------

-- Roles that come with a position rather than with how someone does their hours. Moving out resets
-- them, so that a reactivation by mistake does not bring the access back.
create or replace function public.offboarding_reset_role()
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select 'Halv/Halv'::text;
$function$;

create or replace function public.offboarding_is_position_role(p_role text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select p_role in ('Daglig leder', 'Data', 'Regisjef', 'Romsjef', 'Utvalgsmedlem', 'Vaktsjef');
$function$;

-- What moving someone out will do, for the confirmation dialog.
create or replace function public.offboarding_preview(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_room integer;
begin
  if not public.is_user_manager() then
    raise exception 'Du har ikke tilgang til å se dette';
  end if;

  select r.name, u.room_number into v_role, v_room
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_user_id;

  if not found then
    raise exception 'Fant ikke beboeren';
  end if;

  return jsonb_build_object(
    'roomNumber', nullif(v_room, 0),
    'futureShifts', (
      select count(*) from public.vakt_shifts s
      where s.user_id = p_user_id and s.starts_at > now()
    ),
    'openSwaps', (
      select count(*) from public.vakt_shifts s
      where s.user_id = p_user_id and s.starts_at > now() and s.swap_requested
    ),
    'waitingRomslipp', (
      select count(*) from public.romslipp_participants p
      join public.romslipp_rounds r on r.id = p.round_id
      where p.user_id = p_user_id and p.status = 'waiting' and r.status = 'open'
    ),
    'openReports', (
      select count(*) from public.room_reports rr
      where rr.reported_by = p_user_id and rr.status in ('open', 'task_created')
    ),
    'roleReset', case
      when public.offboarding_is_position_role(v_role) then v_role
      else null
    end
  );
end;
$function$;

revoke execute on function public.offboarding_preview(uuid) from public, anon;
grant execute on function public.offboarding_preview(uuid) to authenticated;

-- Does the whole move-out in one transaction. The caller has already checked who may do it: the
-- delete-user edge function (service role) and offboard_due_users (the scheduled job).
create or replace function public.offboard_user_internal(
  p_user_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_active boolean;
  v_role text;
  v_released integer;
  v_skipped integer;
  v_role_reset boolean;
  v_details jsonb;
begin
  select u.is_active, r.name into v_active, v_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_user_id
  for update of u;

  if not found then
    raise exception 'Fant ikke beboeren';
  end if;

  if v_role = 'Admin' then
    raise exception 'En administrator kan ikke flyttes ut';
  end if;

  -- Make sure the login is blocked even when the profile was already inactive, so a move-out that
  -- stopped halfway can be repeated.
  update auth.users
  set banned_until = now() + interval '876000 hours'
  where id = p_user_id;

  if v_active is not true then
    return jsonb_build_object('alreadyInactive', true);
  end if;

  -- Future shifts go back to the Vaktsjef as gaps; a swap that was open no longer makes sense.
  update public.vakt_shifts
  set user_id = null,
      swap_requested = false,
      swap_offer_amount = null,
      swap_note = null
  where user_id = p_user_id and starts_at > now();
  get diagnostics v_released = row_count;

  -- Someone who is leaving is skipped in a romslipp that is running; the turn passes on.
  update public.romslipp_participants p
  set status = 'skipped', answered_at = now(), answered_by = p_actor_id
  where p.user_id = p_user_id
    and p.status = 'waiting'
    and p.round_id in (select id from public.romslipp_rounds where status = 'open');
  get diagnostics v_skipped = row_count;

  v_role_reset := public.offboarding_is_position_role(v_role);
  if v_role_reset then
    update public.users
    set role_id = (select id from public.roles where name = public.offboarding_reset_role())
    where id = p_user_id;
  end if;

  -- The existing trigger closes the room occupancy and clears Husfar.
  update public.users
  set is_active = false, on_leave = false, move_out_date = null
  where id = p_user_id;

  v_details := jsonb_build_object(
    'shiftsReleased', v_released,
    'romslippSkipped', v_skipped,
    'roleReset', case when v_role_reset then v_role else null end
  );

  insert into public.resident_events (user_id, kind, actor_id, reason, details)
  values (p_user_id, 'moved_out', p_actor_id, nullif(trim(p_reason), ''), v_details);

  return v_details;
end;
$function$;

revoke execute on function public.offboard_user_internal(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.offboard_user_internal(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Planned move-out
-- ---------------------------------------------------------------------------------------------

-- Today by the clock in Oslo, which is what a move-out date means.
create or replace function public.oslo_today()
returns date
language sql
stable
set search_path to 'public'
as $function$
  select (now() at time zone 'Europe/Oslo')::date;
$function$;

create or replace function public.plan_move_out(
  p_user_id uuid,
  p_date date,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_active boolean;
  v_role text;
begin
  if not public.is_user_manager() then
    raise exception 'Du har ikke tilgang til å flytte ut beboere';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Du kan ikke flytte ut deg selv';
  end if;

  select u.is_active, r.name into v_active, v_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_user_id;

  if not found then
    raise exception 'Fant ikke beboeren';
  end if;
  if v_role = 'Admin' then
    raise exception 'En administrator kan ikke flyttes ut';
  end if;
  if not public.can_manage_role(v_role) then
    raise exception 'Du kan ikke flytte ut brukere med rollen %', v_role;
  end if;
  if v_active is not true then
    raise exception 'Beboeren er allerede flyttet ut';
  end if;
  if p_date is null or p_date <= public.oslo_today() then
    raise exception 'Utflyttingsdatoen må være frem i tid';
  end if;

  update public.users set move_out_date = p_date where id = p_user_id;

  insert into public.resident_events (user_id, kind, actor_id, reason, details)
  values (
    p_user_id,
    'move_out_planned',
    auth.uid(),
    nullif(trim(p_reason), ''),
    jsonb_build_object('date', p_date)
  );
end;
$function$;

revoke execute on function public.plan_move_out(uuid, date, text) from public, anon;
grant execute on function public.plan_move_out(uuid, date, text) to authenticated;

create or replace function public.cancel_move_out(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_date date;
  v_role text;
begin
  if not public.is_user_manager() then
    raise exception 'Du har ikke tilgang til å endre utflyttinger';
  end if;

  select u.move_out_date, r.name into v_date, v_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_user_id;
  if not found then
    raise exception 'Fant ikke beboeren';
  end if;
  if not public.can_manage_role(v_role) then
    raise exception 'Du kan ikke endre utflyttingen til brukere med rollen %', v_role;
  end if;
  if v_date is null then
    raise exception 'Det er ingen planlagt utflytting';
  end if;

  update public.users set move_out_date = null where id = p_user_id;

  insert into public.resident_events (user_id, kind, actor_id, details)
  values (p_user_id, 'move_out_cancelled', auth.uid(), jsonb_build_object('date', v_date));
end;
$function$;

revoke execute on function public.cancel_move_out(uuid) from public, anon;
grant execute on function public.cancel_move_out(uuid) to authenticated;

-- Moves out everyone whose date has come. Runs every hour; the date check is by the Oslo clock, so it
-- does not matter which hour of the night it catches the change of date in. One failure does not stop
-- the others.
create or replace function public.offboard_due_users()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user record;
  v_count integer := 0;
begin
  for v_user in
    select u.id
    from public.users u
    where u.is_active and u.move_out_date is not null and u.move_out_date <= public.oslo_today()
    order by u.move_out_date
  loop
    begin
      perform public.offboard_user_internal(v_user.id, 'Planlagt utflytting', null);
      v_count := v_count + 1;
    exception when others then
      raise warning 'Kunne ikke flytte ut %: %', v_user.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$function$;

revoke execute on function public.offboard_due_users() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('offboard-due-users', '5 * * * *', 'select public.offboard_due_users()');

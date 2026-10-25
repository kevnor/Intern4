-- Close privilege-escalation holes in the baseline RLS policies.
--
-- 1. "Users can update own profile" had no column restriction, so any resident could
--    set their own role_id to Admin. Managers could do the same via
--    "Admins can update any user". A trigger now guards the privileged columns.
-- 2. "Users can insert own assignments" let residents insert pre-approved hours, and
--    "Users can delete own assignments" let them delete already processed rows.

create or replace function public.current_user_role_name()
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid();
$function$;

revoke all on function public.current_user_role_name() from public, anon;
grant execute on function public.current_user_role_name() to authenticated, service_role;

create or replace function public.guard_user_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  caller_role text;
  old_role text;
  new_role text;
begin
  -- No end-user JWT: service role (edge functions), SQL editor or migrations.
  if auth.uid() is null then
    return new;
  end if;

  caller_role := public.current_user_role_name();

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Kan ikke endre id eller opprettelsestidspunkt'
      using errcode = '42501';
  end if;

  if new.role_id is distinct from old.role_id then
    if old.id = auth.uid() then
      raise exception 'Du kan ikke endre din egen rolle' using errcode = '42501';
    end if;

    if caller_role is null or caller_role not in ('Admin', 'Data') then
      raise exception 'Kun Admin og Data kan endre roller' using errcode = '42501';
    end if;

    select name into old_role from public.roles where id = old.role_id;
    select name into new_role from public.roles where id = new.role_id;

    if (old_role = 'Admin' or new_role = 'Admin') and caller_role <> 'Admin' then
      raise exception 'Kun Admin kan gi eller fjerne Admin-rollen' using errcode = '42501';
    end if;
  end if;

  if (
    new.email is distinct from old.email
    or new.is_active is distinct from old.is_active
    or new.on_leave is distinct from old.on_leave
    or new.seniority is distinct from old.seniority
    or new.room_number is distinct from old.room_number
  ) and (caller_role is null or caller_role not in ('Admin', 'Data', 'Regisjef', 'Romsjef')) then
    raise exception 'Du har ikke tilgang til å endre disse feltene' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_user_privileged_columns on public.users;

create trigger guard_user_privileged_columns
  before update on public.users
  for each row
  execute function public.guard_user_privileged_columns();

-- Residents may only create pending, unapproved assignments for themselves.
drop policy if exists "Users can insert own assignments" on public.work_assignments;

create policy "Users can insert own assignments"
  on public.work_assignments
  as permissive
  for insert
  to authenticated
  with check (
    auth.uid() = user_uuid
    and approved_state = 0
    and approved_by_uuid is null
    and approval_comment is null
  );

-- Residents may only withdraw assignments that have not been processed yet.
drop policy if exists "Users can delete own assignments" on public.work_assignments;

create policy "Users can delete own assignments"
  on public.work_assignments
  as permissive
  for delete
  to authenticated
  using (auth.uid() = user_uuid and approved_state = 0);

-- Task submission (tasksDAO.submitTaskCompletion) updates the resident's own pending
-- assignment. There was no policy for this, so the update silently matched 0 rows.
drop policy if exists "Users can update own pending assignments" on public.work_assignments;

create policy "Users can update own pending assignments"
  on public.work_assignments
  as permissive
  for update
  to authenticated
  using (auth.uid() = user_uuid and approved_state = 0)
  with check (
    auth.uid() = user_uuid
    and approved_state = 0
    and approved_by_uuid is null
    and approval_comment is null
  );

alter table public.work_assignments
  drop constraint if exists work_assignments_hours_used_nonnegative;

alter table public.work_assignments
  add constraint work_assignments_hours_used_nonnegative
  check (hours_used is null or hours_used >= 0) not valid;

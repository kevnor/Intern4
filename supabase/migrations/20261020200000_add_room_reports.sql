-- Problems in a room. A resident living there reports one; Regisjef turns it into a regi task.
create or replace function public.is_room_occupant(p_room_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.room_occupancies o
    where o.room_id = p_room_id
      and o.user_id = auth.uid()
      and o.moved_out is null
  );
$function$;

-- Who handles reports: Regisjef (makes the task) and the people who run the rooms.
create or replace function public.is_room_report_manager()
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name in ('Admin', 'Data', 'Regisjef', 'Romsjef')
  );
$function$;

create table if not exists public.room_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  reported_by uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'task_created', 'resolved', 'dismissed')),
  work_item_id bigint references public.work_items(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists room_reports_room_id_idx on public.room_reports (room_id, created_at);
create index if not exists room_reports_status_idx on public.room_reports (status, created_at);

-- resolved_at follows the status, so it can't be set to something else.
create or replace function public.room_reports_set_resolved_at()
returns trigger
language plpgsql
as $function$
begin
  if new.status in ('resolved', 'dismissed') then
    if old.status not in ('resolved', 'dismissed') then
      new.resolved_at := now();
    end if;
  else
    new.resolved_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists room_reports_set_resolved_at on public.room_reports;
create trigger room_reports_set_resolved_at
  before update on public.room_reports
  for each row execute function public.room_reports_set_resolved_at();

alter table public.room_reports enable row level security;

-- New tables get every privilege by default; start from none so the column-level grants below
-- are what actually limits inserts and updates.
revoke all on table public.room_reports from anon, authenticated;

grant select, delete on table public.room_reports to authenticated;
-- A report's text and room are fixed when it is made; only handling it changes the rest.
grant insert (room_id, reported_by, title, description) on table public.room_reports to authenticated;
grant update (status, work_item_id) on table public.room_reports to authenticated;
grant select, insert, update, delete on table public.room_reports to service_role;

drop policy if exists "Residents and managers can read room reports" on public.room_reports;
create policy "Residents and managers can read room reports"
  on public.room_reports for select
  to authenticated
  using (
    reported_by = auth.uid()
    or public.is_room_occupant(room_id)
    or public.is_room_report_manager()
  );

drop policy if exists "Residents can report problems in their own room" on public.room_reports;
create policy "Residents can report problems in their own room"
  on public.room_reports for insert
  to authenticated
  with check (
    reported_by = auth.uid()
    and status = 'open'
    and work_item_id is null
    and public.is_room_occupant(room_id)
  );

drop policy if exists "Managers can handle room reports" on public.room_reports;
create policy "Managers can handle room reports"
  on public.room_reports for update
  to authenticated
  using (public.is_room_report_manager())
  with check (public.is_room_report_manager());

drop policy if exists "Reporters can withdraw open reports" on public.room_reports;
create policy "Reporters can withdraw open reports"
  on public.room_reports for delete
  to authenticated
  using (reported_by = auth.uid() and status = 'open');

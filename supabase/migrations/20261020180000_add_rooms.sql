-- Rooms and who has lived in them. The list of rooms is static (the numbers below); what changes
-- is each room's type and its occupants. users.room_number stays as a copy of the resident's
-- current room, kept in sync by triggers, so everything that reads it keeps working.
create or replace function public.is_room_manager()
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
      and r.name in ('Admin', 'Romsjef', 'Data')
  );
$function$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  number smallint not null unique,
  -- Not known for every room yet; Romsjef fills it in.
  type text check (type in ('bottekott', 'korrhybel', 'liten_parhybel', 'stor_parhybel', 'husfarhybel')),
  created_at timestamptz not null default now()
);

insert into public.rooms (number)
select n from (
  select 60 as n
  union all select generate_series(100, 173)
  union all select generate_series(200, 273)
) numbers
on conflict (number) do nothing;

-- Both kinds of parhybel hold two people, every other room one.
create or replace function public.room_capacity(p_type text)
returns int
language sql
immutable
as $function$
  select case when p_type in ('liten_parhybel', 'stor_parhybel') then 2 else 1 end;
$function$;

create table if not exists public.room_occupancies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  user_id uuid not null references public.users(id) on delete cascade,
  moved_in date not null default current_date,
  moved_out date,
  created_at timestamptz not null default now(),
  check (moved_out is null or moved_out >= moved_in)
);

create index if not exists room_occupancies_room_id_idx on public.room_occupancies (room_id, moved_in);
create index if not exists room_occupancies_user_id_idx on public.room_occupancies (user_id, moved_in);
-- A resident lives in at most one room at a time.
create unique index if not exists room_occupancies_one_current_room_idx
  on public.room_occupancies (user_id) where moved_out is null;

-- Residents who already have a room. Capacity is deliberately not checked here, so rooms that are
-- shared today don't make this fail. Former residents are skipped: their dates are unknown.
insert into public.room_occupancies (room_id, user_id, moved_in)
select r.id, u.id, coalesce(u.created_at::date, current_date)
from public.users u
join public.rooms r on r.number = u.room_number
where u.is_active
  and not exists (
    select 1 from public.room_occupancies o where o.user_id = u.id and o.moved_out is null
  );

-- Copies the current room onto users.room_number (0 when the resident has none).
create or replace function public.sync_user_room_number(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_number smallint;
begin
  select coalesce(
    (select r.number
     from public.room_occupancies o
     join public.rooms r on r.id = o.room_id
     where o.user_id = p_user_id and o.moved_out is null
     limit 1),
    0
  ) into v_number;

  update public.users set room_number = v_number
  where id = p_user_id and room_number is distinct from v_number;
end;
$function$;

create or replace function public.room_occupancies_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_user_room_number(new.user_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_user_room_number(old.user_id);
  end if;
  return null;
end;
$function$;

drop trigger if exists room_occupancies_sync on public.room_occupancies;
create trigger room_occupancies_sync
  after insert or update or delete on public.room_occupancies
  for each row execute function public.room_occupancies_sync();

-- Signed-in users can't set room_number directly; it follows the occupancy. Service-role callers
-- (edge functions, SQL) have no auth.uid() and are not blocked. Updates made by the sync trigger
-- run one trigger level deeper.
create or replace function public.guard_user_room_number()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if pg_trigger_depth() = 1
     and auth.uid() is not null
     and new.room_number is distinct from old.room_number then
    raise exception 'Rom tildeles via romadministrasjonen, ikke ved å endre romnummer'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_user_room_number on public.users;
create trigger guard_user_room_number
  before update of room_number on public.users
  for each row execute function public.guard_user_room_number();

-- A user created with a room (create-user edge function) gets an occupancy for it.
create or replace function public.users_create_initial_occupancy()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(new.room_number, 0) > 0 then
    insert into public.room_occupancies (room_id, user_id)
    select r.id, new.id from public.rooms r where r.number = new.room_number;
  end if;
  return null;
end;
$function$;

drop trigger if exists users_create_initial_occupancy on public.users;
create trigger users_create_initial_occupancy
  after insert on public.users
  for each row execute function public.users_create_initial_occupancy();

-- A deactivated resident moves out. The history is kept; reactivating doesn't bring the room back.
create or replace function public.users_close_occupancy_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.room_occupancies
  set moved_out = greatest(current_date, moved_in)
  where user_id = new.id and moved_out is null;
  return null;
end;
$function$;

drop trigger if exists users_close_occupancy_on_deactivate on public.users;
create trigger users_close_occupancy_on_deactivate
  after update of is_active on public.users
  for each row
  when (old.is_active is true and new.is_active is not true)
  execute function public.users_close_occupancy_on_deactivate();

-- Puts a resident in a room (or in none when p_room_id is null) from p_date. The room must have
-- space; the resident's previous room ends the same day.
create or replace function public.assign_resident_to_room(
  p_user_id uuid,
  p_room_id uuid default null,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms%rowtype;
  v_current public.room_occupancies%rowtype;
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan tildele rom';
  end if;

  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception 'Beboeren er ikke aktiv';
  end if;

  -- One assignment at a time, so two people can't take the last space in a room.
  perform pg_advisory_xact_lock(hashtext('room_assignment'));

  select * into v_current
  from public.room_occupancies
  where user_id = p_user_id and moved_out is null;

  if p_room_id is not null then
    select * into v_room from public.rooms where id = p_room_id;
    if not found then
      raise exception 'Fant ikke rommet';
    end if;

    if v_current.id is not null and v_current.room_id = p_room_id then
      return;
    end if;

    if (select count(*) from public.room_occupancies
        where room_id = p_room_id and moved_out is null) >= public.room_capacity(v_room.type) then
      raise exception 'Rommet er fullt';
    end if;
  end if;

  if v_current.id is not null then
    update public.room_occupancies
    set moved_out = greatest(p_date, moved_in)
    where id = v_current.id;
  end if;

  if p_room_id is not null then
    insert into public.room_occupancies (room_id, user_id, moved_in)
    values (p_room_id, p_user_id, p_date);
  end if;
end;
$function$;

revoke execute on function public.assign_resident_to_room(uuid, uuid, date) from public, anon;
grant execute on function public.assign_resident_to_room(uuid, uuid, date) to authenticated;

alter table public.rooms enable row level security;
alter table public.room_occupancies enable row level security;

grant select on table public.rooms to authenticated;
grant select on table public.room_occupancies to authenticated;
-- Only the type can be changed; the list of rooms is fixed.
grant update (type) on table public.rooms to authenticated;
grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.room_occupancies to service_role;

drop policy if exists "Authenticated users can read rooms" on public.rooms;
create policy "Authenticated users can read rooms"
  on public.rooms for select
  to authenticated
  using (true);

drop policy if exists "Room managers can update rooms" on public.rooms;
create policy "Room managers can update rooms"
  on public.rooms for update
  to authenticated
  using (public.is_room_manager())
  with check (public.is_room_manager());

drop policy if exists "Authenticated users can read room occupancies" on public.room_occupancies;
create policy "Authenticated users can read room occupancies"
  on public.room_occupancies for select
  to authenticated
  using (true);

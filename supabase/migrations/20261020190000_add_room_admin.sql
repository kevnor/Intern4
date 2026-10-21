-- Room administration: who the Husfar is, and the rules that go with husfarhybelen.
alter table public.users
  add column if not exists is_husfar boolean not null default false;

-- There is one Husfar and one husfarhybelen.
create unique index if not exists users_one_husfar_idx
  on public.users (is_husfar) where is_husfar;
create unique index if not exists rooms_one_husfarhybel_idx
  on public.rooms (type) where type = 'husfarhybel';

-- Only set_husfar() changes the flag. It tells this trigger so with a setting that lasts for the
-- transaction; service-role callers (no auth.uid()) and nested triggers are not blocked.
create or replace function public.guard_user_husfar()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if pg_trigger_depth() = 1
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_husfar_change', true), '') <> '1'
     and new.is_husfar is distinct from old.is_husfar then
    raise exception 'Husfar settes av romsjefen i romadministrasjonen'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_user_husfar on public.users;
create trigger guard_user_husfar
  before update of is_husfar on public.users
  for each row execute function public.guard_user_husfar();

-- Husfarhybelen can only be typed on a room where nobody but the Husfar lives.
create or replace function public.rooms_check_husfarhybel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.type = 'husfarhybel' and exists (
    select 1
    from public.room_occupancies o
    join public.users u on u.id = o.user_id
    where o.room_id = new.id and o.moved_out is null and not u.is_husfar
  ) then
    raise exception 'Noen som ikke er Husfar bor på rommet. Flytt dem først';
  end if;
  return new;
end;
$function$;

drop trigger if exists rooms_check_husfarhybel on public.rooms;
create trigger rooms_check_husfarhybel
  before update of type on public.rooms
  for each row execute function public.rooms_check_husfarhybel();

-- Same as before, plus: husfarhybelen is only for the Husfar.
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

    if v_room.type = 'husfarhybel'
       and not exists (select 1 from public.users where id = p_user_id and is_husfar) then
      raise exception 'Husfarhybelen er forbeholdt Husfar';
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

-- Makes a resident Husfar (and moves them into husfarhybelen), or lets them stop being Husfar.
-- Declining the room works the same way: clear the flag, then move them somewhere else.
create or replace function public.set_husfar(p_user_id uuid, p_is_husfar boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room_id uuid;
  v_other text;
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan sette Husfar';
  end if;

  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception 'Beboeren er ikke aktiv';
  end if;

  perform set_config('app.allow_husfar_change', '1', true);

  if not p_is_husfar then
    update public.users set is_husfar = false where id = p_user_id;
    return;
  end if;

  select id into v_room_id from public.rooms where type = 'husfarhybel';
  if v_room_id is null then
    raise exception 'Sett først typen husfarhybelen på et rom';
  end if;

  select u.name into v_other
  from public.users u
  where u.is_husfar and u.id <> p_user_id
  limit 1;
  if v_other is not null then
    raise exception '% er allerede Husfar. Fjern vedkommende først', v_other;
  end if;

  select u.name into v_other
  from public.room_occupancies o
  join public.users u on u.id = o.user_id
  where o.room_id = v_room_id and o.moved_out is null and o.user_id <> p_user_id
  limit 1;
  if v_other is not null then
    raise exception 'Husfarhybelen er opptatt av %. Flytt dem først', v_other;
  end if;

  update public.users set is_husfar = true where id = p_user_id;
  perform public.assign_resident_to_room(p_user_id, v_room_id);
end;
$function$;

revoke execute on function public.set_husfar(uuid, boolean) from public, anon;
grant execute on function public.set_husfar(uuid, boolean) to authenticated;

-- A deactivated Husfar is no longer Husfar.
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

  update public.users set is_husfar = false where id = new.id and is_husfar;
  return null;
end;
$function$;

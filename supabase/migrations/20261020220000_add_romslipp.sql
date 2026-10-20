-- Romslipp: the room round each semester. Residents are asked one by one, in order of seniority,
-- whether they want to move to a room that has space. Whoever moves frees their old room for the
-- people after them. Nothing changes in room_occupancies until Romsjef closes the round, so a
-- round can be cancelled and the history gets clean dates.
create table if not exists public.romslipp_rounds (
  id uuid primary key default gen_random_uuid(),
  semester_key text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- One round at a time.
create unique index if not exists romslipp_one_open_round_idx
  on public.romslipp_rounds (status) where status = 'open';

create table if not exists public.romslipp_participants (
  round_id uuid not null references public.romslipp_rounds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position int not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'moved', 'stayed', 'skipped')),
  -- The room they had when the round started, and the one they chose.
  from_room_id uuid references public.rooms(id),
  chosen_room_id uuid references public.rooms(id),
  answered_at timestamptz,
  answered_by uuid references public.users(id) on delete set null,
  primary key (round_id, user_id),
  unique (round_id, position),
  check ((status = 'moved') = (chosen_room_id is not null))
);

alter table public.romslipp_rounds enable row level security;
alter table public.romslipp_participants enable row level security;

-- Rounds change only through the functions below.
revoke all on table public.romslipp_rounds from anon, authenticated;
revoke all on table public.romslipp_participants from anon, authenticated;
grant select on table public.romslipp_rounds to authenticated;
grant select on table public.romslipp_participants to authenticated;
grant select, insert, update, delete on table public.romslipp_rounds to service_role;
grant select, insert, update, delete on table public.romslipp_participants to service_role;

drop policy if exists "Authenticated users can read romslipp rounds" on public.romslipp_rounds;
create policy "Authenticated users can read romslipp rounds"
  on public.romslipp_rounds for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read romslipp participants" on public.romslipp_participants;
create policy "Authenticated users can read romslipp participants"
  on public.romslipp_participants for select
  to authenticated
  using (true);

-- Rooms with space as the round stands now: what has space at the start, plus the rooms people
-- have vacated in the round, minus the places they have taken. Husfarhybelen is never offered.
create or replace function public.romslipp_available_rooms(p_round_id uuid)
returns table (room_id uuid, number smallint, type text, free_spots int)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with moves as (
    select p.user_id, p.chosen_room_id
    from public.romslipp_participants p
    where p.round_id = p_round_id and p.status = 'moved'
  ),
  staying as (
    select o.room_id, count(*) as n
    from public.room_occupancies o
    where o.moved_out is null
      and not exists (select 1 from moves m where m.user_id = o.user_id)
    group by o.room_id
  ),
  incoming as (
    select m.chosen_room_id as room_id, count(*) as n
    from moves m
    group by m.chosen_room_id
  )
  select r.id,
         r.number,
         r.type,
         public.room_capacity(r.type) - coalesce(s.n, 0)::int - coalesce(i.n, 0)::int
  from public.rooms r
  left join staying s on s.room_id = r.id
  left join incoming i on i.room_id = r.id
  where r.type is distinct from 'husfarhybel'
    and public.room_capacity(r.type) - coalesce(s.n, 0) - coalesce(i.n, 0) > 0
  order by r.number;
$function$;

-- Starts a round. Residents who live in a room, are not on leave and are not the Husfar take part,
-- most senior first; ties go to whoever has lived in their room longest, then by name.
create or replace function public.start_romslipp(p_semester_key text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round_id uuid;
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan starte romslipp';
  end if;

  if exists (select 1 from public.romslipp_rounds where status = 'open') then
    raise exception 'Et romslipp pågår allerede';
  end if;

  insert into public.romslipp_rounds (semester_key, created_by)
  values (p_semester_key, auth.uid())
  returning id into v_round_id;

  insert into public.romslipp_participants (round_id, user_id, position, from_room_id)
  select v_round_id,
         x.user_id,
         row_number() over (order by x.seniority desc, x.moved_in asc, x.name asc, x.user_id)::int,
         x.room_id
  from (
    select u.id as user_id,
           coalesce(u.seniority, 0) as seniority,
           o.moved_in,
           coalesce(u.name, '') as name,
           o.room_id
    from public.users u
    join public.room_occupancies o on o.user_id = u.id and o.moved_out is null
    where u.is_active and not coalesce(u.on_leave, false) and not u.is_husfar
  ) x;

  if not exists (select 1 from public.romslipp_participants where round_id = v_round_id) then
    raise exception 'Ingen beboere kan delta i romslippet';
  end if;

  return v_round_id;
end;
$function$;

-- A resident answers when it is their turn: a room with space, or null to stay where they are.
-- Romsjef can answer for someone else.
create or replace function public.romslipp_answer(
  p_round_id uuid,
  p_room_id uuid default null,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round public.romslipp_rounds%rowtype;
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_turn uuid;
  v_participant public.romslipp_participants%rowtype;
begin
  select * into v_round from public.romslipp_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'open' then
    raise exception 'Romslippet pågår ikke';
  end if;

  if v_user_id is distinct from auth.uid() and not public.is_room_manager() then
    raise exception 'Du kan bare svare for deg selv';
  end if;

  select user_id into v_turn
  from public.romslipp_participants
  where round_id = p_round_id and status = 'waiting'
  order by position
  limit 1;

  if v_turn is distinct from v_user_id then
    raise exception 'Det er ikke din tur';
  end if;

  select * into v_participant
  from public.romslipp_participants
  where round_id = p_round_id and user_id = v_user_id;

  if p_room_id is not null then
    if p_room_id = v_participant.from_room_id then
      raise exception 'Du bor allerede på dette rommet';
    end if;

    if not exists (
      select 1 from public.romslipp_available_rooms(p_round_id) a where a.room_id = p_room_id
    ) then
      raise exception 'Rommet er ikke ledig';
    end if;
  end if;

  update public.romslipp_participants
  set status = case when p_room_id is null then 'stayed' else 'moved' end,
      chosen_room_id = p_room_id,
      answered_at = now(),
      answered_by = auth.uid()
  where round_id = p_round_id and user_id = v_user_id;
end;
$function$;

-- Romsjef passes over someone who can't answer (they stay where they are).
create or replace function public.romslipp_skip(p_round_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round public.romslipp_rounds%rowtype;
  v_turn uuid;
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan hoppe over noen';
  end if;

  select * into v_round from public.romslipp_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'open' then
    raise exception 'Romslippet pågår ikke';
  end if;

  select user_id into v_turn
  from public.romslipp_participants
  where round_id = p_round_id and status = 'waiting'
  order by position
  limit 1;

  if v_turn is distinct from p_user_id then
    raise exception 'Det er ikke denne beboerens tur';
  end if;

  update public.romslipp_participants
  set status = 'skipped', answered_at = now(), answered_by = auth.uid()
  where round_id = p_round_id and user_id = p_user_id;
end;
$function$;

-- Applies the moves: each mover's old stay ends today and the new one starts today.
create or replace function public.close_romslipp(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round public.romslipp_rounds%rowtype;
  v_room record;
  v_move record;
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan avslutte romslipp';
  end if;

  select * into v_round from public.romslipp_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'open' then
    raise exception 'Romslippet pågår ikke';
  end if;

  if exists (
    select 1 from public.romslipp_participants where round_id = p_round_id and status = 'waiting'
  ) then
    raise exception 'Noen har ikke svart ennå. Be dem svare, eller hopp dem over';
  end if;

  perform pg_advisory_xact_lock(hashtext('room_assignment'));

  -- The rooms people chose must still have space once the movers have left.
  for v_room in
    select r.number, r.type, c.n as incoming
    from (
      select chosen_room_id, count(*) as n
      from public.romslipp_participants
      where round_id = p_round_id and status = 'moved'
      group by chosen_room_id
    ) c
    join public.rooms r on r.id = c.chosen_room_id
  loop
    if (
      select count(*) from public.room_occupancies o
      where o.moved_out is null
        and o.room_id = (select id from public.rooms where number = v_room.number)
        and not exists (
          select 1 from public.romslipp_participants p
          where p.round_id = p_round_id and p.status = 'moved' and p.user_id = o.user_id
        )
    ) + v_room.incoming > public.room_capacity(v_room.type) then
      raise exception 'Rom % er blitt fullt siden romslippet startet', v_room.number;
    end if;
  end loop;

  update public.room_occupancies o
  set moved_out = greatest(current_date, o.moved_in)
  where o.moved_out is null
    and o.user_id in (
      select user_id from public.romslipp_participants
      where round_id = p_round_id and status = 'moved'
    );

  for v_move in
    select user_id, chosen_room_id
    from public.romslipp_participants
    where round_id = p_round_id and status = 'moved'
    order by position
  loop
    insert into public.room_occupancies (room_id, user_id, moved_in)
    values (v_move.chosen_room_id, v_move.user_id, current_date);
  end loop;

  update public.romslipp_rounds set status = 'closed', closed_at = now() where id = p_round_id;
end;
$function$;

create or replace function public.cancel_romslipp(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_room_manager() then
    raise exception 'Bare romsjef kan avbryte romslipp';
  end if;

  update public.romslipp_rounds
  set status = 'cancelled', closed_at = now()
  where id = p_round_id and status = 'open';

  if not found then
    raise exception 'Romslippet pågår ikke';
  end if;
end;
$function$;

-- Rooms are not handed out by hand while a round is running: it would change what is free.
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

  if exists (select 1 from public.romslipp_rounds where status = 'open') then
    raise exception 'Romslipp pågår. Avslutt eller avbryt det før rom tildeles';
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

revoke execute on function public.romslipp_available_rooms(uuid) from public, anon;
revoke execute on function public.start_romslipp(text) from public, anon;
revoke execute on function public.romslipp_answer(uuid, uuid, uuid) from public, anon;
revoke execute on function public.romslipp_skip(uuid, uuid) from public, anon;
revoke execute on function public.close_romslipp(uuid) from public, anon;
revoke execute on function public.cancel_romslipp(uuid) from public, anon;
grant execute on function public.romslipp_available_rooms(uuid) to authenticated;
grant execute on function public.start_romslipp(text) to authenticated;
grant execute on function public.romslipp_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.romslipp_skip(uuid, uuid) to authenticated;
grant execute on function public.close_romslipp(uuid) to authenticated;
grant execute on function public.cancel_romslipp(uuid) to authenticated;

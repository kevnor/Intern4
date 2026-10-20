-- Shift swaps. A resident flags one of their published shifts as needing a swap, optionally
-- offering money, and another resident claims it. Residents change shifts only through the
-- functions below, never by updating the table directly.
alter table public.vakt_shifts
  add column if not exists swap_requested boolean not null default false,
  add column if not exists swap_offer_amount numeric check (swap_offer_amount >= 0),
  add column if not exists swap_note text;

-- A shift that changes hands, by claiming or by the Vaktsjef, is no longer up for swap.
create or replace function public.reset_vakt_swap_on_reassign()
returns trigger
language plpgsql
as $function$
begin
  if new.user_id is distinct from old.user_id then
    new.swap_requested := false;
    new.swap_offer_amount := null;
    new.swap_note := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists reset_vakt_swap_on_reassign on public.vakt_shifts;
create trigger reset_vakt_swap_on_reassign
  before update on public.vakt_shifts
  for each row execute function public.reset_vakt_swap_on_reassign();

-- Who gave a shift to whom, and what was offered. Money is settled outside the app.
create table if not exists public.vakt_swap_log (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.vakt_shifts(id) on delete set null,
  shift_starts_at timestamptz not null,
  slot_type text not null check (slot_type in ('natt', 'dag', 'kveld')),
  from_user_id uuid references public.users(id) on delete set null,
  to_user_id uuid references public.users(id) on delete set null,
  amount numeric check (amount >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vakt_swap_log_from_idx on public.vakt_swap_log (from_user_id);
create index if not exists vakt_swap_log_to_idx on public.vakt_swap_log (to_user_id);

alter table public.vakt_swap_log enable row level security;

grant select on table public.vakt_swap_log to authenticated;
grant select, insert, update, delete on table public.vakt_swap_log to service_role;

drop policy if exists "Residents can read their own swaps" on public.vakt_swap_log;
create policy "Residents can read their own swaps"
  on public.vakt_swap_log for select
  to authenticated
  using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_vakt_manager()
  );

create or replace function public.request_vakt_swap(
  p_shift_id uuid,
  p_amount numeric default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_amount is not null and p_amount < 0 then
    raise exception 'Beløpet kan ikke være negativt';
  end if;

  update public.vakt_shifts
  set swap_requested = true,
      swap_offer_amount = p_amount,
      swap_note = nullif(trim(p_note), '')
  where id = p_shift_id
    and user_id = auth.uid()
    and status = 'published'
    and starts_at > now();

  if not found then
    raise exception 'Du kan bare be om bytte på dine egne kommende vakter';
  end if;
end;
$function$;

create or replace function public.cancel_vakt_swap(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.vakt_shifts
  set swap_requested = false,
      swap_offer_amount = null,
      swap_note = null
  where id = p_shift_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Du kan bare avbryte bytte på dine egne vakter';
  end if;
end;
$function$;

create or replace function public.claim_vakt_shift(p_shift_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_shift public.vakt_shifts%rowtype;
  v_log_id uuid;
begin
  select * into v_shift
  from public.vakt_shifts
  where id = p_shift_id
  for update;

  if not found
     or not v_shift.swap_requested
     or v_shift.status <> 'published'
     or v_shift.starts_at <= now() then
    raise exception 'Vakten er ikke lenger ledig for bytte';
  end if;

  if v_shift.user_id = auth.uid() then
    raise exception 'Du kan ikke ta din egen vakt';
  end if;

  if not exists (
    select 1 from public.users u where u.id = auth.uid() and u.is_active
  ) then
    raise exception 'Bare aktive beboere kan ta vakter';
  end if;

  insert into public.vakt_swap_log (
    shift_id, shift_starts_at, slot_type, from_user_id, to_user_id, amount
  )
  values (
    v_shift.id, v_shift.starts_at, v_shift.slot_type, v_shift.user_id, auth.uid(),
    v_shift.swap_offer_amount
  )
  returning id into v_log_id;

  update public.vakt_shifts set user_id = auth.uid() where id = v_shift.id;

  return v_log_id;
end;
$function$;

-- Either side of a swap can confirm that the money has changed hands.
create or replace function public.set_vakt_swap_paid(p_log_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.vakt_swap_log
  set paid = p_paid
  where id = p_log_id
    and (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_vakt_manager());

  if not found then
    raise exception 'Fant ikke bytten';
  end if;
end;
$function$;

revoke execute on function public.request_vakt_swap(uuid, numeric, text) from public, anon;
revoke execute on function public.cancel_vakt_swap(uuid) from public, anon;
revoke execute on function public.claim_vakt_shift(uuid) from public, anon;
revoke execute on function public.set_vakt_swap_paid(uuid, boolean) from public, anon;
grant execute on function public.request_vakt_swap(uuid, numeric, text) to authenticated;
grant execute on function public.cancel_vakt_swap(uuid) to authenticated;
grant execute on function public.claim_vakt_shift(uuid) to authenticated;
grant execute on function public.set_vakt_swap_paid(uuid, boolean) to authenticated;

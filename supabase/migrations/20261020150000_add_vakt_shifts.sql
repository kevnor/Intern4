-- Reception shifts. Each calendar day is split into 00-08 (natt), 08-16 (dag, weekends only)
-- and 16-24 (kveld). Shifts start as drafts and are only visible to residents once published.
create or replace function public.is_vakt_manager()
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
      and r.name in ('Admin', 'Vaktsjef')
  );
$function$;

create table if not exists public.vakt_shifts (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  slot_type text not null check (slot_type in ('natt', 'dag', 'kveld')),
  user_id uuid references public.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists vakt_shifts_user_id_starts_at_idx
  on public.vakt_shifts (user_id, starts_at);

alter table public.vakt_shifts enable row level security;

grant select, insert, update, delete on table public.vakt_shifts to authenticated;
grant select, insert, update, delete on table public.vakt_shifts to service_role;

drop policy if exists "Residents can read published shifts" on public.vakt_shifts;
create policy "Residents can read published shifts"
  on public.vakt_shifts for select
  to authenticated
  using (status = 'published' or public.is_vakt_manager());

drop policy if exists "Vakt managers can insert shifts" on public.vakt_shifts;
create policy "Vakt managers can insert shifts"
  on public.vakt_shifts for insert
  to authenticated
  with check (public.is_vakt_manager());

drop policy if exists "Vakt managers can update shifts" on public.vakt_shifts;
create policy "Vakt managers can update shifts"
  on public.vakt_shifts for update
  to authenticated
  using (public.is_vakt_manager())
  with check (public.is_vakt_manager());

drop policy if exists "Vakt managers can delete shifts" on public.vakt_shifts;
create policy "Vakt managers can delete shifts"
  on public.vakt_shifts for delete
  to authenticated
  using (public.is_vakt_manager());

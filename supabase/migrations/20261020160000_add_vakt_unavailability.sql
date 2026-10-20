-- Days a resident can't take vakt. The schedule generator avoids them.
create table if not exists public.vakt_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

create index if not exists vakt_unavailability_user_id_idx
  on public.vakt_unavailability (user_id, from_date);

alter table public.vakt_unavailability enable row level security;

grant select, insert, update, delete on table public.vakt_unavailability to authenticated;
grant select, insert, update, delete on table public.vakt_unavailability to service_role;

drop policy if exists "Residents can read own unavailability" on public.vakt_unavailability;
create policy "Residents can read own unavailability"
  on public.vakt_unavailability for select
  to authenticated
  using (user_id = auth.uid() or public.is_vakt_manager());

drop policy if exists "Residents can add own unavailability" on public.vakt_unavailability;
create policy "Residents can add own unavailability"
  on public.vakt_unavailability for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Residents can delete own unavailability" on public.vakt_unavailability;
create policy "Residents can delete own unavailability"
  on public.vakt_unavailability for delete
  to authenticated
  using (user_id = auth.uid() or public.is_vakt_manager());

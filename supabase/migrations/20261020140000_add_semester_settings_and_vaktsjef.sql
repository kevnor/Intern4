insert into public.roles (name)
select 'Vaktsjef'
where not exists (select 1 from public.roles where name = 'Vaktsjef');

-- One row per semester, keyed like src/shared/utils/semester.ts ("2026-H" for autumn, "2026-V" for spring).
create table if not exists public.semester_settings (
  semester_key text primary key,
  required_hours numeric not null check (required_hours >= 0),
  updated_at timestamptz not null default now()
);

alter table public.semester_settings enable row level security;

grant select, insert, update on table public.semester_settings to authenticated;
grant select, insert, update on table public.semester_settings to service_role;

drop policy if exists "Authenticated users can read semester settings" on public.semester_settings;
create policy "Authenticated users can read semester settings"
  on public.semester_settings for select
  to authenticated
  using (true);

drop policy if exists "Admins can insert semester settings" on public.semester_settings;
create policy "Admins can insert semester settings"
  on public.semester_settings for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.name = 'Admin'
    )
  );

drop policy if exists "Admins can update semester settings" on public.semester_settings;
create policy "Admins can update semester settings"
  on public.semester_settings for update
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.name = 'Admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.name = 'Admin'
    )
  );

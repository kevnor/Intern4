-- Data may set the required semester hours too. They already manage residents and roles, and the
-- Admin page (/admin) is where both roles do it. Everyone signed in can still read them.

drop policy if exists "Admins can insert semester settings" on public.semester_settings;
drop policy if exists "Admins can update semester settings" on public.semester_settings;
drop policy if exists "Admin and Data can insert semester settings" on public.semester_settings;
drop policy if exists "Admin and Data can update semester settings" on public.semester_settings;

create policy "Admin and Data can insert semester settings"
  on public.semester_settings for insert
  to authenticated
  with check (public.current_user_role_name() in ('Admin', 'Data'));

create policy "Admin and Data can update semester settings"
  on public.semester_settings for update
  to authenticated
  using (public.current_user_role_name() in ('Admin', 'Data'))
  with check (public.current_user_role_name() in ('Admin', 'Data'));

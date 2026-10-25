-- Nothing in the app is used without signing in, so the anon role gets no access to the public
-- schema. Row level security already blocks it today (no policy applies to anon or PUBLIC); this
-- takes away the privileges too, so one mistaken policy can no longer open a table to the world.
-- scripts/db-security-check.sql keeps it that way.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- New objects made by migrations (which run as postgres) no longer start out open to anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- Helpers that row level security policies call. The querying role needs EXECUTE on them, which is
-- authenticated; they stay closed to anon and PUBLIC.
revoke all on function public.is_admin_or_regisjef() from public, anon;
revoke all on function public.is_admin_or_romsjef() from public, anon;
revoke all on function public.is_room_manager() from public, anon;
revoke all on function public.is_room_occupant(uuid) from public, anon;
revoke all on function public.is_room_report_manager() from public, anon;
revoke all on function public.is_vakt_manager() from public, anon;

grant execute on function public.is_admin_or_regisjef() to authenticated, service_role;
grant execute on function public.is_admin_or_romsjef() to authenticated, service_role;
grant execute on function public.is_room_manager() to authenticated, service_role;
grant execute on function public.is_room_occupant(uuid) to authenticated, service_role;
grant execute on function public.is_room_report_manager() to authenticated, service_role;
grant execute on function public.is_vakt_manager() to authenticated, service_role;

-- Trigger functions and internal helpers. A trigger runs whatever the caller's privileges, so nobody
-- needs EXECUTE on these, and nobody should be able to call them as an RPC.
revoke all on function public.guard_user_privileged_columns() from public, anon, authenticated;
revoke all on function public.room_occupancies_sync() from public, anon, authenticated;
revoke all on function public.rooms_check_husfarhybel() from public, anon, authenticated;
revoke all on function public.sync_user_room_number(uuid) from public, anon, authenticated;
revoke all on function public.users_close_occupancy_on_deactivate() from public, anon, authenticated;
revoke all on function public.users_create_initial_occupancy() from public, anon, authenticated;

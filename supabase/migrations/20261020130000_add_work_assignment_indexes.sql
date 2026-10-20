-- Indexes for the columns the app filters and joins work_assignments on.
-- Postgres doesn't index foreign keys automatically.

-- Mine timer, resident profiles and task membership (user_uuid = ...).
create index if not exists "work_assignments_user_uuid_idx"
on "public"."work_assignments" using btree ("user_uuid");

-- Task participants (embedded from work_items) and cleanup after deleting a registration.
create index if not exists "work_assignments_work_id_idx"
on "public"."work_assignments" using btree ("work_id");

-- Godkjenning: only the pending rows, which stay few even as history grows.
create index if not exists "work_assignments_pending_idx"
on "public"."work_assignments" using btree ("performed_at" desc, "created_at" desc)
where "approved_state" = 0;

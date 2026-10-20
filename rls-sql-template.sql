-- ============================================================
-- Enable Row Level Security (RLS) on all tables
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- 0. DROP ALL EXISTING RLS POLICIES
-- ============================================================
-- This dynamically finds and drops every policy on our tables,
-- so we start from a clean slate regardless of what was there.
-- ============================================================

DO $$
DECLARE
  _tbl  text;
  _pol  text;
BEGIN
  FOR _tbl, _pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'roles',
        'schools',
        'studies',
        'users',
        'work_categories',
        'work_items',
        'work_tasks',
        'work_assignments',
        'work_misc',
        'semester_settings',
        'vakt_shifts',
        'vakt_unavailability',
        'vakt_swap_log',
        'rooms',
        'room_occupancies',
        'room_reports',
        'romslipp_rounds',
        'romslipp_participants'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _pol, _tbl);
    RAISE NOTICE 'Dropped policy "%" on table "%"', _pol, _tbl;
  END LOOP;
END
$$;

-- ============================================================
-- 1. ROLES TABLE
-- ============================================================
-- Roles are reference data (Admin, Regisjef, Halv/Halv, etc.)
-- Everyone authenticated can read them, but only service_role
-- (edge functions) should insert/update/delete.
-- ============================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2. SCHOOLS AND STUDIES TABLES
-- ============================================================
-- Schools and studies are reference data.
-- Everyone authenticated can read them, but writes are handled
-- through migrations/service-role maintenance.
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE schools TO authenticated;
GRANT SELECT ON TABLE studies TO authenticated;
GRANT SELECT ON TABLE schools TO anon;
GRANT SELECT ON TABLE studies TO anon;
GRANT SELECT ON TABLE schools TO service_role;
GRANT SELECT ON TABLE studies TO service_role;

CREATE POLICY "Authenticated users can read schools"
  ON schools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read studies"
  ON studies FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 3. USERS TABLE
-- ============================================================
-- All authenticated users can read all user profiles (needed
-- for user lists, participant names, etc.)
-- Users can update ONLY their own profile.
-- Inserts/deletes are handled by edge functions using
-- service_role_key, which bypasses RLS entirely.
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins (Data, Regisjef, Romsjef) can update any user profile
-- This uses a subquery to check the caller's role.
CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef', 'Romsjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef', 'Romsjef')
    )
  );

-- INSERT handled by create-user edge function (service_role bypasses RLS)
-- DELETE handled by delete-user edge function (service_role bypasses RLS)

-- Admins/managers can delete non-admin users
-- (Defense-in-depth: edge function also enforces this)
CREATE POLICY "Managers can delete non-admin users"
  ON users FOR DELETE
  TO authenticated
  USING (
    -- Caller must be Admin, Data, or Regisjef
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
    -- Target user must NOT be Admin
    AND NOT EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND r.name = 'Admin'
    )
  );

-- ============================================================
-- 4. WORK_CATEGORIES TABLE
-- ============================================================
-- Everyone authenticated can read categories.
-- Only managers can insert/update (soft-delete via is_active).
-- ============================================================

ALTER TABLE work_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON work_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert categories"
  ON work_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can update categories"
  ON work_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- ============================================================
-- 5. WORK_ITEMS TABLE
-- ============================================================
-- Everyone authenticated can read work items.
-- Managers can create/update/delete work items (tasks + misc).
-- Regular users can insert misc items (regi logs via regiDAO).
-- ============================================================

ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work items"
  ON work_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert work items"
  ON work_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update work items"
  ON work_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can delete work items"
  ON work_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- ============================================================
-- 6. WORK_TASKS TABLE
-- ============================================================
-- Everyone authenticated can read tasks.
-- Managers can create/update/delete tasks.
-- ============================================================

ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tasks"
  ON work_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert tasks"
  ON work_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can update tasks"
  ON work_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can delete tasks"
  ON work_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- ============================================================
-- 7. WORK_ASSIGNMENTS TABLE
-- ============================================================
-- Everyone authenticated can read assignments (needed to show
-- participants, hours, approvals, etc.)
-- Users can insert their own assignments (join task, log regi).
-- Users can delete their own assignments (leave task).
-- Managers can insert/update/delete any assignment.
-- ============================================================

ALTER TABLE work_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assignments"
  ON work_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own assignments (join task, log hours)
CREATE POLICY "Users can insert own assignments"
  ON work_assignments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_uuid);

-- Users can delete their own assignments (leave task)
CREATE POLICY "Users can delete own assignments"
  ON work_assignments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_uuid);

-- Managers can insert assignments for anyone
CREATE POLICY "Managers can insert any assignment"
  ON work_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- Managers can update any assignment (approve/reject)
CREATE POLICY "Managers can update any assignment"
  ON work_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- Managers can delete any assignment
CREATE POLICY "Managers can delete any assignment"
  ON work_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- ============================================================
-- 8. WORK_MISC TABLE
-- ============================================================
-- Simple table with just id, created_at, image.
-- Everyone authenticated can read. Only managers can modify.
-- ============================================================

ALTER TABLE work_misc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work_misc"
  ON work_misc FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert work_misc"
  ON work_misc FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can update work_misc"
  ON work_misc FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

CREATE POLICY "Managers can delete work_misc"
  ON work_misc FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name IN ('Admin', 'Data', 'Regisjef')
    )
  );

-- ============================================================
-- SEMESTER SETTINGS TABLE
-- ============================================================
-- Hours every resident owes per semester. Everyone authenticated
-- can read; only Admin can change it.
-- ============================================================

ALTER TABLE semester_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read semester settings"
  ON semester_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert semester settings"
  ON semester_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can update semester settings"
  ON semester_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Admin'
    )
  );

-- ============================================================
-- VAKT SHIFTS TABLE
-- ============================================================
-- Reception shifts. Residents read published shifts only; Admin
-- and Vaktsjef (public.is_vakt_manager(), created by migration
-- 20261020150000_add_vakt_shifts) read and write everything.
-- ============================================================

ALTER TABLE vakt_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can read published shifts"
  ON vakt_shifts FOR SELECT
  TO authenticated
  USING (status = 'published' OR public.is_vakt_manager());

CREATE POLICY "Vakt managers can insert shifts"
  ON vakt_shifts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_vakt_manager());

CREATE POLICY "Vakt managers can update shifts"
  ON vakt_shifts FOR UPDATE
  TO authenticated
  USING (public.is_vakt_manager())
  WITH CHECK (public.is_vakt_manager());

CREATE POLICY "Vakt managers can delete shifts"
  ON vakt_shifts FOR DELETE
  TO authenticated
  USING (public.is_vakt_manager());

-- ============================================================
-- VAKT UNAVAILABILITY TABLE
-- ============================================================
-- Residents add and remove their own unavailable days. Admin and
-- Vaktsjef can read everyone's (the schedule generator needs them).
-- ============================================================

ALTER TABLE vakt_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can read own unavailability"
  ON vakt_unavailability FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_vakt_manager());

CREATE POLICY "Residents can add own unavailability"
  ON vakt_unavailability FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Residents can delete own unavailability"
  ON vakt_unavailability FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_vakt_manager());

-- ============================================================
-- VAKT SWAP LOG TABLE
-- ============================================================
-- Shifts that changed hands. Written only by the claim_vakt_shift
-- function (migration 20261020170000_add_vakt_swaps); residents
-- read their own swaps, Admin and Vaktsjef read all.
-- ============================================================

ALTER TABLE vakt_swap_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can read their own swaps"
  ON vakt_swap_log FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.is_vakt_manager()
  );

-- ============================================================
-- ROOMS AND ROOM OCCUPANCIES TABLES
-- ============================================================
-- The list of rooms is fixed; Admin, Romsjef and Data (public.is_room_manager(),
-- created by migration 20261020180000_add_rooms) can change a room's type.
-- Occupancies are the history of who lived where. They are readable by all
-- and written only by assign_resident_to_room() and the triggers on users.
-- ============================================================

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_occupancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Room managers can update rooms"
  ON rooms FOR UPDATE
  TO authenticated
  USING (public.is_room_manager())
  WITH CHECK (public.is_room_manager());

CREATE POLICY "Authenticated users can read room occupancies"
  ON room_occupancies FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- ROOM REPORTS TABLE
-- ============================================================
-- Problems in a room. Residents report for the room they live in
-- (public.is_room_occupant); Admin, Data, Regisjef and Romsjef
-- (public.is_room_report_manager) read and handle them. Created by
-- migration 20261020200000_add_room_reports, which also limits the
-- column privileges: only status and work_item_id can be updated.
-- ============================================================

ALTER TABLE room_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents and managers can read room reports"
  ON room_reports FOR SELECT
  TO authenticated
  USING (
    reported_by = auth.uid()
    OR public.is_room_occupant(room_id)
    OR public.is_room_report_manager()
  );

CREATE POLICY "Residents can report problems in their own room"
  ON room_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND status = 'open'
    AND work_item_id IS NULL
    AND public.is_room_occupant(room_id)
  );

CREATE POLICY "Managers can handle room reports"
  ON room_reports FOR UPDATE
  TO authenticated
  USING (public.is_room_report_manager())
  WITH CHECK (public.is_room_report_manager());

CREATE POLICY "Reporters can withdraw open reports"
  ON room_reports FOR DELETE
  TO authenticated
  USING (reported_by = auth.uid() AND status = 'open');

-- ============================================================
-- ROMSLIPP ROUNDS AND PARTICIPANTS TABLES
-- ============================================================
-- The room round each semester. Readable by all; changed only by the
-- functions start_romslipp, romslipp_answer, romslipp_skip,
-- close_romslipp and cancel_romslipp (migration 20261020220000_add_romslipp),
-- which check who is on turn and who may act for someone else.
-- ============================================================

ALTER TABLE romslipp_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE romslipp_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read romslipp rounds"
  ON romslipp_rounds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read romslipp participants"
  ON romslipp_participants FOR SELECT
  TO authenticated
  USING (true);

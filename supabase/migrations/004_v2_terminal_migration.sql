-- Migration 004: Update schema for Admin-operated Branch Face ID Terminal (v2.0)

-- 1. Add recorded_by_admin_id to attendance
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS recorded_by_admin_id UUID REFERENCES employees(id) ON DELETE SET NULL;
COMMENT ON COLUMN attendance.recorded_by_admin_id IS 'Admin who recorded/scanned this check-in/out';

-- 2. Make employee_id nullable in security_alerts
ALTER TABLE security_alerts 
  ALTER COLUMN employee_id DROP NOT NULL;
COMMENT ON COLUMN security_alerts.employee_id IS 'Can be NULL if the face was unmatched';

-- 3. Add branch_id to security_alerts
ALTER TABLE security_alerts 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
COMMENT ON COLUMN security_alerts.branch_id IS 'Branch where the security alert occurred';

-- 4. Add values to security_alert_type enum
ALTER TYPE security_alert_type ADD VALUE IF NOT EXISTS 'yuz_tanilmadi';
ALTER TYPE security_alert_type ADD VALUE IF NOT EXISTS 'liveness_xato';

-- 5. Add index for security_alerts branch_id
CREATE INDEX IF NOT EXISTS idx_security_alerts_branch ON security_alerts(branch_id);

-- 6. Update RLS Policies

-- Drop old policies
DROP POLICY IF EXISTS "User can insert their own attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can view security alerts in their branches" ON security_alerts;

-- Add new policies for attendance (Admin insert & update)
CREATE POLICY "Admin can insert attendance in their branches" ON attendance
  FOR INSERT WITH CHECK (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT ab.branch_id FROM admin_branches ab WHERE ab.admin_id = auth.uid())
  );

CREATE POLICY "Admin can update attendance in their branches" ON attendance
  FOR UPDATE USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT ab.branch_id FROM admin_branches ab WHERE ab.admin_id = auth.uid())
  ) WITH CHECK (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT ab.branch_id FROM admin_branches ab WHERE ab.admin_id = auth.uid())
  );

-- Add new policies for security_alerts (Admin select & insert)
CREATE POLICY "Admin can view security alerts in their branches" ON security_alerts
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT ab.branch_id FROM admin_branches ab WHERE ab.admin_id = auth.uid())
  );

CREATE POLICY "Admin can insert security alerts in their branches" ON security_alerts
  FOR INSERT WITH CHECK (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT ab.branch_id FROM admin_branches ab WHERE ab.admin_id = auth.uid())
  );

-- Add policy for Admin updating employees' face embeddings
CREATE POLICY "Admin can update employees in their branches" ON employees
  FOR UPDATE USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM admin_branches ab
      JOIN schedules s ON s.branch_id = ab.branch_id
      WHERE ab.admin_id = auth.uid() AND s.employee_id = employees.id
    )
  ) WITH CHECK (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM admin_branches ab
      JOIN schedules s ON s.branch_id = ab.branch_id
      WHERE ab.admin_id = auth.uid() AND s.employee_id = employees.id
    )
  );

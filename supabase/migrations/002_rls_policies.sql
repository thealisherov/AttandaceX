-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
-- NOTE: Must live in public schema — Supabase forbids creating functions in the auth schema.
-- SECURITY DEFINER + search_path = public ensures it can read public.employees safely.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol::text FROM public.employees WHERE id = auth.uid() LIMIT 1;
$$;

-- Employees Table Policies
CREATE POLICY "Super admin has full access to employees" ON employees
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view employees in their branches" ON employees
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM admin_branches ab
      JOIN schedules s ON s.branch_id = ab.branch_id
      WHERE ab.admin_id = auth.uid() AND s.employee_id = employees.id
    )
  );

CREATE POLICY "User can view their own profile" ON employees
  FOR SELECT USING (auth.uid() = id);

-- Branches Table Policies
CREATE POLICY "Super admin has full access to branches" ON branches
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view all branches" ON branches
  FOR SELECT USING (public.user_role() = 'admin');

-- Admin Branches Table Policies
CREATE POLICY "Super admin has full access to admin_branches" ON admin_branches
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view their own branch assignments" ON admin_branches
  FOR SELECT USING (auth.uid() = admin_id);

-- Schedules Table Policies
CREATE POLICY "Super admin has full access to schedules" ON schedules
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit schedules in their branches" ON schedules
  FOR ALL USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
  );

CREATE POLICY "User can view their own schedules" ON schedules
  FOR SELECT USING (employee_id = auth.uid());

-- Schedule Overrides Table Policies
CREATE POLICY "Super admin has full access to schedule_overrides" ON schedule_overrides
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit overrides in their branches" ON schedule_overrides
  FOR ALL USING (
    public.user_role() = 'admin' AND
    (
      branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid()) OR
      EXISTS (
        SELECT 1 FROM schedules s
        WHERE s.employee_id = schedule_overrides.employee_id
          AND s.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
      )
    )
  );

CREATE POLICY "User can view their own schedule overrides" ON schedule_overrides
  FOR SELECT USING (employee_id = auth.uid());

-- Attendance Table Policies
CREATE POLICY "Super admin has full access to attendance" ON attendance
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view attendance in their branches" ON attendance
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
  );

CREATE POLICY "User can view their own attendance" ON attendance
  FOR SELECT USING (employee_id = auth.uid());

-- Users can insert their own attendance (usually done via service_role/edge function, but if client does it)
CREATE POLICY "User can insert their own attendance" ON attendance
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Fines Table Policies
CREATE POLICY "Super admin has full access to fines" ON fines
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit fines in their branches" ON fines
  FOR ALL USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.id = fines.attendance_id
        AND a.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
    )
  );

CREATE POLICY "User can view their own fines" ON fines
  FOR SELECT USING (employee_id = auth.uid());

-- Fine Rules Table Policies
CREATE POLICY "Super admin has full access to fine_rules" ON fine_rules
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit fine rules in their branches" ON fine_rules
  FOR ALL USING (
    public.user_role() = 'admin' AND
    (branch_id IS NULL OR branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid()))
  );

CREATE POLICY "User can view fine rules" ON fine_rules
  FOR SELECT USING (true);

-- Security Alerts Table Policies
CREATE POLICY "Super admin has full access to security_alerts" ON security_alerts
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view security alerts in their branches" ON security_alerts
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.employee_id = security_alerts.employee_id
        AND s.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
    )
  );

-- Telegram Auth Sessions
-- RLS enabled but NO policies for anon or authenticated — only service_role can access it.
-- We deliberately add NO CREATE POLICY statements here.

-- Migration 007: Let Admin see every employee, not just those already
-- scheduled at their branch.
--
-- The original "Admin can view employees in their branches" policy required
-- employees.id to already have a schedules row at one of the admin's
-- branches. But schedules are assigned BY the admin (spec: "Admin
-- keyinchalik shu xodimga Branch(lar) va Ish jadvali biriktiradi") — so a
-- newly registered employee has no schedule yet and was invisible to every
-- admin, meaning no admin could ever onboard them. Mirrors the existing
-- "Admin can view all branches" policy (002_rls_policies.sql).
--
-- Branch/schedule/fine mutation endpoints remain scoped to the admin's own
-- branches (admin_branches) server-side — this only widens read access to
-- the employee directory itself.

DROP POLICY IF EXISTS "Admin can view employees in their branches" ON employees;

CREATE POLICY "Admin can view all employees" ON employees
  FOR SELECT USING (public.user_role() = 'admin');

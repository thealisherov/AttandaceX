-- Migration 005: Multi-shift scheduling support
-- Allows multiple work sessions per day per employee (e.g. 08:00-10:00 AND 14:00-18:00)

-- ============================================================
-- 1. schedules table — remove UNIQUE(employee_id, hafta_kuni),
--    add session_index so one employee can have multiple
--    sessions on the same weekday.
-- ============================================================

-- Drop old unique constraint
ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS schedules_employee_id_hafta_kuni_key;

-- Add session_index (1 = first shift, 2 = second shift …)
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS session_index INTEGER NOT NULL DEFAULT 1;

-- New unique constraint: one employee, one weekday, one session index
ALTER TABLE schedules
  ADD CONSTRAINT schedules_employee_id_hafta_kuni_session_key
  UNIQUE (employee_id, hafta_kuni, session_index);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schedules_employee_day
  ON schedules (employee_id, hafta_kuni);

-- ============================================================
-- 2. attendance table — remove UNIQUE(employee_id, sana),
--    add session_index and schedule_id so each shift has
--    its own attendance row.
-- ============================================================

-- Drop old unique constraint
ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_employee_id_sana_key;

-- Add session_index column
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session_index INTEGER NOT NULL DEFAULT 1;

-- Add reference back to the schedule row (nullable for overrides)
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;

-- New unique constraint: one employee, one date, one session
ALTER TABLE attendance
  ADD CONSTRAINT attendance_employee_id_sana_session_key
  UNIQUE (employee_id, sana, session_index);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attendance_employee_sana_session
  ON attendance (employee_id, sana, session_index);

-- ============================================================
-- 3. Comments for clarity
-- ============================================================
COMMENT ON COLUMN schedules.session_index IS
  '1 = first shift of the day, 2 = second shift, etc. Multiple rows per employee+hafta_kuni are allowed.';

COMMENT ON COLUMN attendance.session_index IS
  'Mirrors schedules.session_index — which shift this attendance row belongs to.';

COMMENT ON COLUMN attendance.schedule_id IS
  'FK to the schedules row this attendance was recorded against. NULL for manual/override entries.';

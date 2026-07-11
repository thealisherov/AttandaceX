-- Migration 009: Prevent Supabase's free-tier project auto-pause (occurs
-- after ~7 days with no database activity) by writing a heartbeat row every
-- few days via pg_cron. Unrelated to the mark-absent business job (008) —
-- this exists purely to keep the project alive.
--
-- A real write (not just SELECT 1) is used because it's the most reliable
-- signal of "activity" for Supabase's pause detection.
--
-- RLS is enabled with no policies, per project rule that every table must
-- have RLS on — this table is never queried through PostgREST (anon/
-- authenticated), only touched by pg_cron running as the database owner,
-- so "no policies" correctly means "no client can ever reach it".

CREATE TABLE IF NOT EXISTS _keepalive (
  id INT PRIMARY KEY DEFAULT 1,
  pinged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT _keepalive_singleton CHECK (id = 1)
);

ALTER TABLE _keepalive ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('keepalive-ping')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'keepalive-ping');

-- Every 3 days at 03:00 UTC — comfortably inside the ~7-day pause window.
SELECT cron.schedule(
  'keepalive-ping',
  '0 3 */3 * *',
  $$
  INSERT INTO _keepalive (id, pinged_at) VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET pinged_at = now();
  $$
);

-- Verify it's registered:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'keepalive-ping';

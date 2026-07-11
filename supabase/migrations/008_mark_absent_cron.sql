-- Migration 008: Schedule the daily absent-marking job via Supabase's own
-- pg_cron, instead of relying on an external cron service (Vercel Cron etc.)
-- to hit GET /api/cron/mark-absent (see app/api/cron/mark-absent/route.ts).
--
-- Runs at 18:00 UTC = 23:00 Tashkent (UTC+5) every day, matching the
-- schedule already documented in that route's header comment.
--
-- Prereqs (both are Supabase-managed extensions, safe to enable):
--   pg_cron — runs the schedule
--   pg_net  — lets a cron job make an outbound HTTP call from Postgres
--
-- >>> Before running, replace the two placeholders below: <<<
--   YOUR_APP_URL     e.g. https://attendancex.vercel.app
--   YOUR_CRON_SECRET must match the CRON_SECRET env var used by the app

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop first so re-running this migration doesn't create a duplicate job.
SELECT cron.unschedule('mark-absent-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-absent-daily');

SELECT cron.schedule(
  'mark-absent-daily',
  '0 18 * * *',
  $$
  SELECT net.http_get(
    url := 'YOUR_APP_URL/api/cron/mark-absent',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);

-- Verify it's registered:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'mark-absent-daily';

-- Inspect recent runs:
-- SELECT * FROM cron.job_run_details WHERE jobname = 'mark-absent-daily' ORDER BY start_time DESC LIMIT 10;

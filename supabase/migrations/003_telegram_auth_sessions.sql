-- Migration 003: Indexes and TTL support for telegram_auth_sessions
--
-- The table was already created in 001_initial_schema.sql.
-- Here we add indexes for fast OTP lookups and an expires_at column
-- for server-side TTL enforcement (5-minute OTP window).

-- Add expires_at column for OTP TTL (5 minutes by default)
ALTER TABLE telegram_auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '5 minutes');

-- Index: quickly find a pending session by OTP code + telegram_id
CREATE INDEX IF NOT EXISTS idx_tas_otp_tgid
  ON telegram_auth_sessions (otp_code, telegram_id)
  WHERE status = 'pending';

-- Index: quickly find sessions by telegram_id (for "Get Code" deduplication)
CREATE INDEX IF NOT EXISTS idx_tas_telegram_id
  ON telegram_auth_sessions (telegram_id);

-- Index: quickly find sessions by chat_id
CREATE INDEX IF NOT EXISTS idx_tas_chat_id
  ON telegram_auth_sessions (chat_id);

-- Confirm: no anon/authenticated SELECT policy on telegram_auth_sessions.
-- Only service_role can reach this table (RLS is enabled with zero client policies).
-- This is enforced by the absence of any POLICY in 002_rls_policies.sql for this table.

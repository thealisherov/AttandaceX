-- Migration 006: Add a distinct security_alert_type for "recognized employee
-- scanned at a branch/day they are not scheduled for", so it can be told
-- apart from a genuinely unrecognized face in reports and notifications.

ALTER TYPE security_alert_type ADD VALUE IF NOT EXISTS 'notogri_filial';

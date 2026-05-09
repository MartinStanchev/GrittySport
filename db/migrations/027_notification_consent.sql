-- 027_notification_consent.sql
-- GDPR opt-in for push notifications: enabled must default to FALSE so that
-- a user who has never toggled never receives a notification. The OS-level
-- permission prompt is not GDPR consent on its own — the user has to flip
-- each notification type on deliberately. updated_at gives us the audit trail
-- (we know when a user enabled/disabled a type), in line with how
-- user_consents records other consent events.

ALTER TABLE notification_preferences
  ALTER COLUMN enabled SET DEFAULT FALSE;

ALTER TABLE notification_preferences
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 024_user_consents.sql
-- GDPR/§5 DDG audit trail. One row per acceptance event so we can prove
-- which version each user accepted and when, and so marketing-consent
-- toggles preserve full history (set withdrawn_at, insert a new row on
-- re-opt-in). users.consents_completed_at is a denormalized flag the
-- frontend gates the signup flow on without joining the consent table.

CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'health_data', 'age_16_plus', 'marketing')),
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_user_consents_user_type ON user_consents(user_id, consent_type, accepted_at DESC);

ALTER TABLE users ADD COLUMN consents_completed_at TIMESTAMPTZ;

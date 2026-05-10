-- Security batch 2:
--
-- 1. users.token_version — bumped on RevokeAllRefreshTokens so the access JWT
--    (15-min TTL, otherwise unrevocable) stops validating immediately on
--    "sign out of all devices." Embedded in the JWT and checked on every auth.
--
-- 2. ux_user_consents_active_version — prevents duplicate active acceptances
--    of the same (consent_type, version) per user. Withdrawn rows are excluded
--    so opt-out + re-opt-in flows still work.

ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX ux_user_consents_active_version
    ON user_consents(user_id, consent_type, version)
    WHERE withdrawn_at IS NULL;

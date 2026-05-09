-- Switch refresh tokens to at-rest hashes and add reuse-detection metadata.
-- A DB read is no longer a valid session for any user. Existing tokens are
-- invalidated; the next API call will trigger a fresh OTP login.

TRUNCATE TABLE refresh_tokens;

ALTER TABLE refresh_tokens DROP COLUMN token;

ALTER TABLE refresh_tokens
    ADD COLUMN token_hash TEXT NOT NULL,
    ADD COLUMN family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN consumed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

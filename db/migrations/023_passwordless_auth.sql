-- 023_passwordless_auth.sql
-- Switch authentication from passwords to email OTP (with future SSO/passkey
-- support via auth_identities). Pre-production rip-out: drop password_hash
-- entirely. Each user can have multiple auth_identities (one per provider),
-- so an OTP user who later signs in with the same email via SSO gets the
-- SSO method silently linked to the same user.

ALTER TABLE users DROP COLUMN password_hash;

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('email', 'google', 'apple')),
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_auth_identities_user_id ON auth_identities(user_id);

-- email_otps stores hashed one-time codes. Keyed by email (not user_id) so
-- signup-OTPs can exist before a user row does. attempts is incremented on
-- each wrong guess; the row is locked when attempts >= 5.
CREATE TABLE email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('login', 'add_method')),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_otps_active ON email_otps(email, purpose)
    WHERE consumed_at IS NULL;

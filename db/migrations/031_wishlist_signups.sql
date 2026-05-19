-- Pre-launch wishlist signups from the marketing site.
-- Unauthenticated endpoint, so the table is intentionally minimal: just the
-- email + when it came in. Owner gets notified via Resend on each new signup.
CREATE TABLE wishlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

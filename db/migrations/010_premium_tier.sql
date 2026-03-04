-- Add subscription tier to users
ALTER TABLE users
  ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  ADD COLUMN subscription_started_at TIMESTAMPTZ,
  ADD COLUMN subscription_expires_at TIMESTAMPTZ;

-- Usage tracking table (rolling counters per period)
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('week', 'month')),
  period_start DATE NOT NULL,
  chat_messages_used INTEGER NOT NULL DEFAULT 0,
  programs_created INTEGER NOT NULL DEFAULT 0,
  post_workout_reviews_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX idx_usage_tracking_user_period ON usage_tracking(user_id, period_type, period_start);

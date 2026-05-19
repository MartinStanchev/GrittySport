-- Time-bound reminders the user asks Grit to schedule via the set_reminder tool.
-- The LLM writes `content` once (used verbatim as both push body and chat message)
-- so the scheduler delivers without any LLM call on the hot path.
CREATE TABLE user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_reminders_pending
  ON user_reminders (remind_at)
  WHERE delivered = FALSE;

CREATE INDEX idx_user_reminders_user_pending
  ON user_reminders (user_id, remind_at)
  WHERE delivered = FALSE;

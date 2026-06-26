-- Trophy room: durable record of notable accomplishments minted from recorded
-- workouts. Auto-populated (event completions, personal records, milestones)
-- and user-curated (manual pins). dedupe_key makes minting idempotent so the
-- evaluator can run on every save/link without creating duplicates.
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('event_completion', 'personal_record', 'milestone', 'manual')),
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    activity_type VARCHAR(50),
    metric_value DOUBLE PRECISION,
    metric_unit VARCHAR(20),
    -- Stable identity per (user, achievement) so re-evaluation is a no-op.
    dedupe_key VARCHAR(255) NOT NULL,
    achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, dedupe_key)
);

CREATE INDEX idx_achievements_user_date ON achievements(user_id, achieved_at DESC);

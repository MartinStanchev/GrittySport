-- 017_segment_based_memory.sql
-- Replace single-summary chat_memory with segment-based memory and user facts.

CREATE TABLE chat_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    segment_type VARCHAR(30) NOT NULL CHECK (segment_type IN (
        'program_creation', 'post_workout_review', 'missed_workout_checkin',
        'program_modification', 'general_coaching'
    )),
    status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    start_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    end_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    summary TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_segments_user_status ON chat_segments(user_id, status);
CREATE INDEX idx_chat_segments_user_completed ON chat_segments(user_id, completed_at DESC);

CREATE TABLE chat_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_type VARCHAR(30) NOT NULL CHECK (fact_type IN (
        'injury', 'health_condition', 'preference', 'goal',
        'schedule_constraint', 'equipment', 'sport_focus'
    )),
    content TEXT NOT NULL,
    source_segment_id UUID REFERENCES chat_segments(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_facts_user_active ON chat_facts(user_id, active);

-- Migrate existing memory summaries as completed general_coaching segments.
INSERT INTO chat_segments (user_id, segment_type, status, summary, started_at, completed_at)
SELECT user_id, 'general_coaching', 'completed', summary, created_at, updated_at
FROM chat_memory
WHERE summary IS NOT NULL AND summary != '';

DROP TABLE IF EXISTS chat_memory;

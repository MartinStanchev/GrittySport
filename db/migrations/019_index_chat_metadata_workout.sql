-- Index for efficient lookup of review messages by workout_id in metadata JSONB
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata_workout_id
    ON chat_messages ((metadata->>'workout_id'))
    WHERE metadata->>'workout_id' IS NOT NULL;

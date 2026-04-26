-- 022_segment_headers.sql
-- Add denormalized header to chat_segments so the chat UI can render a
-- segment-grouping cue ("Tuesday 10:45 · Run 8.2km · 45 min") without
-- joining workouts/activities at render time.
--
-- Also adds a 'manual_edit' segment_type for activity/criteria edits that
-- should appear as a header-only entry in the chat timeline.

ALTER TABLE chat_segments ADD COLUMN header JSONB;

ALTER TABLE chat_segments DROP CONSTRAINT IF EXISTS chat_segments_segment_type_check;
ALTER TABLE chat_segments ADD CONSTRAINT chat_segments_segment_type_check
    CHECK (segment_type IN (
        'program_creation', 'post_workout_review', 'missed_workout_checkin',
        'program_modification', 'general_coaching', 'manual_edit'
    ));

-- Index supports GetSegmentsSince(user_id, since) called per chat-history fetch.
CREATE INDEX IF NOT EXISTS idx_chat_segments_user_started
    ON chat_segments(user_id, started_at);

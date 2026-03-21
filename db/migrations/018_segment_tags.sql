-- 018_segment_tags.sql
-- Add tags column to chat_segments for mode-aware memory retrieval.

ALTER TABLE chat_segments ADD COLUMN tags TEXT[];

CREATE INDEX idx_chat_segments_tags ON chat_segments USING GIN(tags);

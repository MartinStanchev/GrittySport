ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS missed_review_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS missed_workout_reviews_used INTEGER NOT NULL DEFAULT 0;

CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_activity_id UUID REFERENCES scheduled_activities(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  recorded_data JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'gps', 'garmin', 'apple_health')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  gps_route JSONB,
  heart_rate_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_workouts_scheduled_activity ON workouts(scheduled_activity_id);
CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at);

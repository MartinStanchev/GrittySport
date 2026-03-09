ALTER TABLE workouts DROP CONSTRAINT workouts_source_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_source_check CHECK (source IN ('manual', 'gps', 'garmin', 'apple_health', 'gpx'));

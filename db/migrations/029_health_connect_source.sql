-- Add 'health_connect' to the workouts.source allowlist so Android imports
-- from Health Connect can be stamped with their own source value (analogous
-- to 'apple_health' on iOS).
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_source_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_source_check
  CHECK (source IN ('manual', 'gps', 'garmin', 'apple_health', 'health_connect', 'gpx', 'tcx', 'fit', 'csv'));

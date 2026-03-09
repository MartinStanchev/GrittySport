-- Extend the source constraint to support additional workout file formats
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_source_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_source_check
  CHECK (source IN ('manual', 'gps', 'garmin', 'apple_health', 'gpx', 'tcx', 'fit', 'csv'));

-- Track paused time for recorded workouts so duration excludes pauses.
-- The frontend elapsed timer already subtracts paused time; without this the
-- backend computed duration as wall-clock (finished_at - started_at), which
-- overstated long/paused workouts and was the figure Grit saw in reviews.
ALTER TABLE workouts
    ADD COLUMN paused_duration_sec DOUBLE PRECISION NOT NULL DEFAULT 0;

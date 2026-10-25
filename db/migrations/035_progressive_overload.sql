-- Progressive overload: each phase keeps its recurring template ("activity
-- series") so weeks can be computed from a base prescription + progression
-- rules, and re-computed when Grit edits the series mid-program.

-- 1-based week numbers within the phase that are deload weeks, and how much
-- volume (distance/duration/reps/sets) those weeks cut.
ALTER TABLE phases
    ADD COLUMN deload_weeks INTEGER[] NOT NULL DEFAULT '{}',
    ADD COLUMN deload_pct INTEGER NOT NULL DEFAULT 0;

CREATE TABLE activity_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    activity_type VARCHAR(50) NOT NULL,
    -- Prescription for week `base_week` of the phase; later weeks apply the
    -- progression rules on top of it.
    prescription JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    progression JSONB NOT NULL DEFAULT '[]',
    base_week INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_series_phase_id ON activity_series(phase_id);

-- series_id links a scheduled activity to the series it was generated from
-- (NULL for one-off additions). is_override marks instances edited
-- individually, which series recomputation must leave alone.
ALTER TABLE scheduled_activities
    ADD COLUMN series_id UUID REFERENCES activity_series(id) ON DELETE SET NULL,
    ADD COLUMN is_override BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_scheduled_activities_series_id ON scheduled_activities(series_id);

package models

import (
	"encoding/json"
	"time"
)

type Workout struct {
	ID                  string          `json:"id"`
	UserID              string          `json:"user_id"`
	ScheduledActivityID *string         `json:"scheduled_activity_id,omitempty"`
	ActivityType        string          `json:"activity_type"`
	RecordedData        json.RawMessage `json:"recorded_data"`
	Source              string          `json:"source"`
	StartedAt           time.Time       `json:"started_at"`
	FinishedAt          *time.Time      `json:"finished_at,omitempty"`
	PausedDurationSec   float64         `json:"paused_duration_sec"`
	GPSRoute            json.RawMessage `json:"gps_route,omitempty"`
	HeartRateData       json.RawMessage `json:"heart_rate_data,omitempty"`
	Notes               *string         `json:"notes,omitempty"`
	EffortScore         *int            `json:"effort_score,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
	CompletionStatus    string          `json:"completion_status,omitempty"`
}

// EffectiveDurationSec is the active workout duration in seconds: wall-clock time
// between StartedAt and FinishedAt minus paused time. Returns 0 when the workout
// has no FinishedAt. This mirrors the elapsed timer the user sees while recording
// (which excludes pauses), keeping the app, the stored figure, and Grit's review
// all consistent.
func (w *Workout) EffectiveDurationSec() float64 {
	if w.FinishedAt == nil {
		return 0
	}
	sec := w.FinishedAt.Sub(w.StartedAt).Seconds() - w.PausedDurationSec
	if sec < 0 {
		return 0
	}
	return sec
}

type WorkoutListFilter struct {
	Limit        int
	Offset       int
	ActivityType string
	StartDate    *time.Time
	EndDate      *time.Time
}

type SaveWorkoutInput struct {
	ScheduledActivityID *string         `json:"scheduled_activity_id,omitempty"`
	ActivityType        string          `json:"activity_type"`
	RecordedData        json.RawMessage `json:"recorded_data"`
	Source              string          `json:"source"`
	StartedAt           string          `json:"started_at"`
	FinishedAt          *string         `json:"finished_at,omitempty"`
	PausedDurationSec   float64         `json:"paused_duration_sec"`
	GPSRoute            json.RawMessage `json:"gps_route,omitempty"`
	HeartRateData       json.RawMessage `json:"heart_rate_data,omitempty"`
	Notes               *string         `json:"notes,omitempty"`
	EffortScore         *int            `json:"-"`
}

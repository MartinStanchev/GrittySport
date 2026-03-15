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
	GPSRoute            json.RawMessage `json:"gps_route,omitempty"`
	HeartRateData       json.RawMessage `json:"heart_rate_data,omitempty"`
	Notes               *string         `json:"notes,omitempty"`
	EffortScore         *int            `json:"effort_score,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
	CompletionStatus    string          `json:"completion_status,omitempty"`
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
	GPSRoute            json.RawMessage `json:"gps_route,omitempty"`
	HeartRateData       json.RawMessage `json:"heart_rate_data,omitempty"`
	Notes               *string         `json:"notes,omitempty"`
	EffortScore         *int            `json:"-"`
}

package models

import "time"

// Achievement types.
const (
	AchievementEventCompletion = "event_completion"
	AchievementPersonalRecord  = "personal_record"
	AchievementMilestone       = "milestone"
	AchievementManual          = "manual"
)

// Achievement is a durable record of a notable accomplishment shown in the
// user's trophy room. It is either auto-minted from a recorded workout
// (event completions, PRs, milestones) or manually pinned by the user.
type Achievement struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Type         string    `json:"type"`
	Title        string    `json:"title"`
	Subtitle     *string   `json:"subtitle,omitempty"`
	WorkoutID    *string   `json:"workout_id,omitempty"`
	ProgramID    *string   `json:"program_id,omitempty"`
	ActivityType *string   `json:"activity_type,omitempty"`
	MetricValue  *float64  `json:"metric_value,omitempty"`
	MetricUnit   *string   `json:"metric_unit,omitempty"`
	AchievedAt   time.Time `json:"achieved_at"`
	CreatedAt    time.Time `json:"created_at"`
}

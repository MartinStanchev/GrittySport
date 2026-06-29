// Package achievements mints and serves the user's trophy room: durable records
// of notable accomplishments derived from recorded workouts (event completions,
// personal records, milestones) plus manually pinned workouts.
package achievements

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/review"
	"github.com/grittyfitness/api/internal/services"
)

const defaultMaxHR = 185

// Service mints and reads achievements.
type Service struct {
	pool           *pgxpool.Pool
	workoutService *services.WorkoutService
}

// NewService creates an achievements service.
func NewService(pool *pgxpool.Pool, workoutService *services.WorkoutService) *Service {
	return &Service{pool: pool, workoutService: workoutService}
}

// candidate is a single achievement to upsert.
type candidate struct {
	dedupeKey    string
	achType      string
	title        string
	subtitle     string
	activityType string
	metricValue  *float64
	metricUnit   string
	workoutID    *string
	programID    *string
}

// Evaluate inspects a recorded workout and mints any achievements it earns:
// event completion (when linked to an `event` scheduled activity), personal
// records, and cumulative milestones. Idempotent — safe to call on every save
// and link via the (user_id, dedupe_key) unique constraint.
func (s *Service) Evaluate(ctx context.Context, userID, workoutID string) error {
	workout, err := s.workoutService.GetByID(ctx, workoutID, userID)
	if err != nil {
		return fmt.Errorf("load workout: %w", err)
	}

	var cands []candidate
	cands = append(cands, s.eventCompletion(ctx, workout)...)
	cands = append(cands, s.personalRecords(ctx, userID, workout)...)
	cands = append(cands, s.milestones(ctx, userID, workout)...)

	for _, c := range cands {
		if err := s.insert(ctx, userID, c); err != nil {
			log.Warn().Err(err).Str("user_id", userID).Str("dedupe_key", c.dedupeKey).Msg("mint achievement failed")
		}
	}
	return nil
}

// eventCompletion mints an event_completion when the workout is linked to a
// scheduled activity of type `event` (the program's goal race/meet).
func (s *Service) eventCompletion(ctx context.Context, workout *models.Workout) []candidate {
	if workout.ScheduledActivityID == nil || *workout.ScheduledActivityID == "" {
		return nil
	}

	var activityType string
	var prescription json.RawMessage
	var programID string
	err := s.pool.QueryRow(ctx,
		`SELECT sa.activity_type, sa.prescription, ph.program_id
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 WHERE sa.id = $1`,
		*workout.ScheduledActivityID,
	).Scan(&activityType, &prescription, &programID)
	if err != nil || activityType != "event" {
		return nil
	}

	eventName := prescriptionString(prescription, "event_name")
	if eventName == "" {
		eventName = "your event"
	}
	subtitle := prescriptionString(prescription, "goal")

	pid := programID
	return []candidate{{
		dedupeKey:    "event:" + *workout.ScheduledActivityID,
		achType:      models.AchievementEventCompletion,
		title:        "Completed " + eventName,
		subtitle:     subtitle,
		activityType: workout.ActivityType,
		workoutID:    &workout.ID,
		programID:    &pid,
	}}
}

// personalRecords mints a personal_record per detected PR for this workout.
func (s *Service) personalRecords(ctx context.Context, userID string, workout *models.Workout) []candidate {
	maxHR := s.userMaxHR(ctx, userID)
	durationSec := workout.EffectiveDurationSec()
	effort := review.ComputeEffortScore(workout.HeartRateData, maxHR, durationSec)

	prs := review.DetectPersonalRecords(ctx, s.pool, workout, maxHR, effort)
	cands := make([]candidate, 0, len(prs))
	for _, pr := range prs {
		v := pr.Value
		cands = append(cands, candidate{
			dedupeKey:    fmt.Sprintf("pr:%s:%s", workout.ID, pr.Category),
			achType:      models.AchievementPersonalRecord,
			title:        pr.Category,
			subtitle:     pr.FormattedValue,
			activityType: workout.ActivityType,
			metricValue:  &v,
			metricUnit:   pr.Unit,
			workoutID:    &workout.ID,
		})
	}
	return cands
}

// milestoneThreshold is a named cumulative target.
type milestoneThreshold struct {
	value float64
	title string
}

var workoutCountMilestones = []milestoneThreshold{
	{1, "First workout logged"},
	{10, "10 workouts logged"},
	{25, "25 workouts logged"},
	{50, "50 workouts logged"},
	{100, "100 workouts logged"},
	{250, "250 workouts logged"},
}

var totalDistanceMilestones = []milestoneThreshold{
	{50, "50 km covered"},
	{100, "100 km covered"},
	{250, "250 km covered"},
	{500, "500 km covered"},
	{1000, "1000 km covered"},
}

// milestones mints cumulative milestones (workout count, total distance) the
// user has just crossed. Only the highest newly-crossed threshold per category
// is emitted to avoid a flood when backfilling.
func (s *Service) milestones(ctx context.Context, userID string, workout *models.Workout) []candidate {
	var cands []candidate

	var count float64
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM workouts WHERE user_id = $1`, userID,
	).Scan(&count); err == nil {
		if c := highestCrossed(count, workoutCountMilestones, "milestone:workout_count:", workout); c != nil {
			cands = append(cands, *c)
		}
	}

	// Total distance in km, summed safely across heterogeneous recorded_data
	// (distance_km or distance_m), ignoring non-numeric values.
	var totalKm float64
	if err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(
		   CASE WHEN recorded_data->>'distance_km' ~ '^[0-9]+(\.[0-9]+)?$'
		        THEN (recorded_data->>'distance_km')::float
		        WHEN recorded_data->>'distance_m' ~ '^[0-9]+(\.[0-9]+)?$'
		        THEN (recorded_data->>'distance_m')::float / 1000.0
		        ELSE 0 END), 0)
		 FROM workouts WHERE user_id = $1`, userID,
	).Scan(&totalKm); err == nil {
		if c := highestCrossed(totalKm, totalDistanceMilestones, "milestone:total_distance:", workout); c != nil {
			cands = append(cands, *c)
		}
	}

	return cands
}

// highestCrossed returns a milestone candidate for the largest threshold that
// total meets, keyed so it's minted at most once per user.
func highestCrossed(total float64, thresholds []milestoneThreshold, keyPrefix string, workout *models.Workout) *candidate {
	var hit *milestoneThreshold
	for i := range thresholds {
		if total >= thresholds[i].value {
			hit = &thresholds[i]
		}
	}
	if hit == nil {
		return nil
	}
	return &candidate{
		dedupeKey: fmt.Sprintf("%s%g", keyPrefix, hit.value),
		achType:   models.AchievementMilestone,
		title:     hit.title,
		workoutID: &workout.ID,
	}
}

// CreateManual pins a workout to the trophy room as a manual achievement.
func (s *Service) CreateManual(ctx context.Context, userID, workoutID, title string) (*models.Achievement, error) {
	workout, err := s.workoutService.GetByID(ctx, workoutID, userID)
	if err != nil {
		return nil, fmt.Errorf("load workout: %w", err)
	}
	if title == "" {
		title = "Memorable " + models.AchievementManual
	}
	c := candidate{
		dedupeKey:    "manual:" + workoutID,
		achType:      models.AchievementManual,
		title:        title,
		activityType: workout.ActivityType,
		workoutID:    &workout.ID,
	}
	if err := s.insert(ctx, userID, c); err != nil {
		return nil, err
	}
	return s.getByDedupe(ctx, userID, c.dedupeKey)
}

// List returns the user's achievements, newest first.
func (s *Service) List(ctx context.Context, userID string) ([]models.Achievement, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, type, title, subtitle, workout_id, program_id,
		        activity_type, metric_value, metric_unit, achieved_at, created_at
		 FROM achievements WHERE user_id = $1 ORDER BY achieved_at DESC, created_at DESC`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAchievements(rows)
}

// Delete removes one of the user's achievements.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM achievements WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Service) insert(ctx context.Context, userID string, c candidate) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO achievements
		   (user_id, type, title, subtitle, workout_id, program_id, activity_type, metric_value, metric_unit, dedupe_key)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
		userID, c.achType, c.title, nilIfEmpty(c.subtitle), c.workoutID, c.programID,
		nilIfEmpty(c.activityType), c.metricValue, nilIfEmpty(c.metricUnit), c.dedupeKey,
	)
	return err
}

func (s *Service) getByDedupe(ctx context.Context, userID, dedupeKey string) (*models.Achievement, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, type, title, subtitle, workout_id, program_id,
		        activity_type, metric_value, metric_unit, achieved_at, created_at
		 FROM achievements WHERE user_id = $1 AND dedupe_key = $2`,
		userID, dedupeKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list, err := scanAchievements(rows)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, pgx.ErrNoRows
	}
	return &list[0], nil
}

func (s *Service) userMaxHR(ctx context.Context, userID string) int {
	var maxHR int
	_ = s.pool.QueryRow(ctx, "SELECT max_heart_rate FROM users WHERE id = $1", userID).Scan(&maxHR)
	if maxHR <= 0 {
		return defaultMaxHR
	}
	return maxHR
}

func scanAchievements(rows pgx.Rows) ([]models.Achievement, error) {
	var out []models.Achievement
	for rows.Next() {
		var a models.Achievement
		if err := rows.Scan(&a.ID, &a.UserID, &a.Type, &a.Title, &a.Subtitle, &a.WorkoutID,
			&a.ProgramID, &a.ActivityType, &a.MetricValue, &a.MetricUnit, &a.AchievedAt, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if out == nil {
		out = []models.Achievement{}
	}
	return out, rows.Err()
}

func prescriptionString(raw json.RawMessage, key string) string {
	if len(raw) == 0 {
		return ""
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

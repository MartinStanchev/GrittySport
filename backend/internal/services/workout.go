package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

type WorkoutService struct {
	pool *pgxpool.Pool
}

func NewWorkoutService(pool *pgxpool.Pool) *WorkoutService {
	return &WorkoutService{pool: pool}
}

const workoutColumns = `id, user_id, scheduled_activity_id, activity_type, recorded_data, source, started_at, finished_at, gps_route, heart_rate_data, notes, created_at, updated_at`

func scanWorkout(row interface{ Scan(...any) error }) (*models.Workout, error) {
	var w models.Workout
	err := row.Scan(
		&w.ID, &w.UserID, &w.ScheduledActivityID, &w.ActivityType, &w.RecordedData,
		&w.Source, &w.StartedAt, &w.FinishedAt, &w.GPSRoute, &w.HeartRateData,
		&w.Notes, &w.CreatedAt, &w.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkoutService) Create(ctx context.Context, userID string, input models.SaveWorkoutInput) (*models.Workout, error) {
	startedAt, err := time.Parse(time.RFC3339, input.StartedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid started_at: %w", err)
	}

	var finishedAt *time.Time
	if input.FinishedAt != nil {
		t, err := time.Parse(time.RFC3339, *input.FinishedAt)
		if err != nil {
			return nil, fmt.Errorf("invalid finished_at: %w", err)
		}
		finishedAt = &t
	}

	source := input.Source
	if source == "" {
		source = "manual"
	}

	recordedData := input.RecordedData
	if len(recordedData) == 0 {
		recordedData = []byte("{}")
	}

	gpsRoute := input.GPSRoute
	if len(gpsRoute) == 0 {
		gpsRoute = nil
	}
	heartRateData := input.HeartRateData
	if len(heartRateData) == 0 {
		heartRateData = nil
	}

	row := s.pool.QueryRow(ctx,
		`INSERT INTO workouts
			(user_id, scheduled_activity_id, activity_type, recorded_data, source, started_at, finished_at, gps_route, heart_rate_data, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING `+workoutColumns,
		userID, input.ScheduledActivityID, input.ActivityType, recordedData, source, startedAt, finishedAt, gpsRoute, heartRateData, input.Notes,
	)
	return scanWorkout(row)
}

func (s *WorkoutService) GetByID(ctx context.Context, workoutID, userID string) (*models.Workout, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+workoutColumns+` FROM workouts WHERE id = $1 AND user_id = $2`,
		workoutID, userID,
	)
	return scanWorkout(row)
}

func (s *WorkoutService) ListByUser(ctx context.Context, userID string, limit, offset int, activityType string) ([]models.Workout, error) {
	query := `SELECT ` + workoutColumns + ` FROM workouts WHERE user_id = $1`
	args := []any{userID}

	if activityType != "" {
		args = append(args, activityType)
		query += fmt.Sprintf(" AND activity_type = $%d", len(args))
	}

	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY started_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query workouts: %w", err)
	}
	defer rows.Close()

	var workouts []models.Workout
	for rows.Next() {
		w, err := scanWorkout(rows)
		if err != nil {
			return nil, fmt.Errorf("scan workout: %w", err)
		}
		workouts = append(workouts, *w)
	}
	if workouts == nil {
		workouts = []models.Workout{}
	}
	return workouts, rows.Err()
}

func (s *WorkoutService) LinkToActivity(ctx context.Context, workoutID, scheduledActivityID, userID string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE workouts SET scheduled_activity_id = $1 WHERE id = $2 AND user_id = $3`,
		scheduledActivityID, workoutID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workout not found")
	}
	return nil
}

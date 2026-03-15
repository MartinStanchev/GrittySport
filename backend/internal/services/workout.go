package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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

const workoutColumns = `id, user_id, scheduled_activity_id, activity_type, recorded_data, source, started_at, finished_at, gps_route, heart_rate_data, notes, effort_score, created_at, updated_at`

func scanWorkout(row interface{ Scan(...any) error }) (*models.Workout, error) {
	var w models.Workout
	err := row.Scan(
		&w.ID, &w.UserID, &w.ScheduledActivityID, &w.ActivityType, &w.RecordedData,
		&w.Source, &w.StartedAt, &w.FinishedAt, &w.GPSRoute, &w.HeartRateData,
		&w.Notes, &w.EffortScore, &w.CreatedAt, &w.UpdatedAt,
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
			(user_id, scheduled_activity_id, activity_type, recorded_data, source, started_at, finished_at, gps_route, heart_rate_data, notes, effort_score)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING `+workoutColumns,
		userID, input.ScheduledActivityID, input.ActivityType, recordedData, source, startedAt, finishedAt, gpsRoute, heartRateData, input.Notes, input.EffortScore,
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

func (s *WorkoutService) ListByUser(ctx context.Context, userID string, filter models.WorkoutListFilter) ([]models.Workout, error) {
	query := `SELECT ` + workoutColumns + ` FROM workouts WHERE user_id = $1`
	args := []any{userID}

	if filter.ActivityType != "" {
		args = append(args, filter.ActivityType)
		query += fmt.Sprintf(" AND activity_type = $%d", len(args))
	}
	if filter.StartDate != nil {
		args = append(args, *filter.StartDate)
		query += fmt.Sprintf(" AND started_at >= $%d", len(args))
	}
	if filter.EndDate != nil {
		args = append(args, *filter.EndDate)
		query += fmt.Sprintf(" AND started_at < $%d", len(args))
	}

	args = append(args, filter.Limit, filter.Offset)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Compute completion status for workouts linked to scheduled activities
	s.populateCompletionStatus(ctx, workouts)

	return workouts, nil
}

// populateCompletionStatus sets CompletionStatus on each workout.
// Workouts not linked to a scheduled activity get "completed".
// Linked workouts compare recorded data against the prescription.
func (s *WorkoutService) populateCompletionStatus(ctx context.Context, workouts []models.Workout) {
	// Collect scheduled_activity_ids
	saIDs := make([]string, 0, len(workouts))
	saMap := make(map[string]json.RawMessage)
	for _, w := range workouts {
		if w.ScheduledActivityID != nil {
			saIDs = append(saIDs, *w.ScheduledActivityID)
		}
	}

	if len(saIDs) > 0 {
		// Fetch prescriptions in one query
		placeholders := make([]string, len(saIDs))
		args := make([]any, len(saIDs))
		for i, id := range saIDs {
			placeholders[i] = fmt.Sprintf("$%d", i+1)
			args[i] = id
		}
		q := `SELECT id, prescription FROM scheduled_activities WHERE id IN (` + strings.Join(placeholders, ",") + `)`
		rows, err := s.pool.Query(ctx, q, args...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id string
				var prescription json.RawMessage
				if err := rows.Scan(&id, &prescription); err == nil {
					saMap[id] = prescription
				}
			}
		}
	}

	for i := range workouts {
		if workouts[i].ScheduledActivityID == nil {
			workouts[i].CompletionStatus = "completed"
			continue
		}
		prescription, ok := saMap[*workouts[i].ScheduledActivityID]
		if !ok {
			workouts[i].CompletionStatus = "completed"
			continue
		}
		workouts[i].CompletionStatus = evaluateCompletion(workouts[i].RecordedData, prescription, workouts[i].ActivityType)
	}
}

// evaluateCompletion compares recorded data against prescription.
// Returns "met_targets" if >= 80% of key metrics met, "below_targets" otherwise.
func evaluateCompletion(recorded, prescription json.RawMessage, activityType string) string {
	var rec map[string]any
	var presc map[string]any
	if err := json.Unmarshal(recorded, &rec); err != nil {
		return "completed"
	}
	if err := json.Unmarshal(prescription, &presc); err != nil {
		return "completed"
	}
	if len(presc) == 0 {
		return "completed"
	}

	t := strings.ToLower(activityType)
	metricKeys := []string{"duration_minutes", "distance_km"}
	if strings.Contains(t, "strength") || strings.Contains(t, "weight") {
		metricKeys = []string{"exercises"}
	} else if strings.Contains(t, "swim") {
		metricKeys = []string{"duration_minutes", "distance_m"}
	}

	checked := 0
	met := 0
	for _, key := range metricKeys {
		pVal, pOk := presc[key]
		rVal, rOk := rec[key]
		if !pOk {
			continue
		}
		checked++
		if !rOk {
			continue
		}
		// Special case: exercises — compare count
		if key == "exercises" {
			pExArr, pIsArr := pVal.([]any)
			rExArr, rIsArr := rVal.([]any)
			if pIsArr && rIsArr && len(pExArr) > 0 {
				ratio := float64(len(rExArr)) / float64(len(pExArr))
				if ratio >= 0.8 {
					met++
				}
			} else {
				met++ // can't compare, assume met
			}
			continue
		}
		pNum, pOkN := toFloat(pVal)
		rNum, rOkN := toFloat(rVal)
		if pOkN && rOkN && pNum > 0 {
			if rNum/pNum >= 0.8 {
				met++
			}
		} else {
			met++ // can't compare numerically, assume met
		}
	}

	if checked == 0 {
		return "completed"
	}
	if float64(met)/float64(checked) >= 0.8 {
		return "met_targets"
	}
	return "below_targets"
}

func toFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	}
	return 0, false
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

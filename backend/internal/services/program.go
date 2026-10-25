package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

type ProgramService struct {
	pool *pgxpool.Pool
}

// ErrInvalidInput wraps validation failures of programs, prescriptions and
// progression rules so handlers can answer 400 instead of 500.
var ErrInvalidInput = errors.New("invalid input")

func invalid(err error) error {
	return fmt.Errorf("%w: %v", ErrInvalidInput, err)
}

func NewProgramService(pool *pgxpool.Pool) *ProgramService {
	return &ProgramService{pool: pool}
}

func (s *ProgramService) ListByUser(ctx context.Context, userID string) ([]models.ProgramResponse, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, sport, goal_description, start_date, end_date, status, created_by, created_at, updated_at
		 FROM programs WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var programs []models.ProgramResponse
	for rows.Next() {
		var p models.Program
		if err := rows.Scan(&p.ID, &p.Name, &p.Sport, &p.GoalDescription, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		programs = append(programs, p.ToResponse())
	}
	if programs == nil {
		programs = []models.ProgramResponse{}
	}
	return programs, rows.Err()
}

func (s *ProgramService) GetByID(ctx context.Context, programID, userID string) (*models.ProgramDetailResponse, error) {
	var p models.Program
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, name, sport, goal_description, start_date, end_date, status, created_by, created_at, updated_at
		 FROM programs WHERE id = $1 AND user_id = $2`, programID, userID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Sport, &p.GoalDescription, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}

	phases, err := s.loadPhases(ctx, programID)
	if err != nil {
		return nil, err
	}
	criteria, err := s.GetCriteria(ctx, programID, userID)
	if err != nil {
		return nil, err
	}
	resp := p.ToDetailResponse(phases, criteria)
	return &resp, nil
}

func (s *ProgramService) GetActiveProgram(ctx context.Context, userID string) (*models.ProgramDetailResponse, error) {
	var programID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM programs WHERE user_id = $1 AND status = 'active' LIMIT 1`, userID,
	).Scan(&programID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, programID, userID)
}

// GetActiveProgramSettings returns the active program's basic info and criteria
// without loading phases/weeks/activities. Used for prompt context injection.
func (s *ProgramService) GetActiveProgramSettings(ctx context.Context, userID string) (*models.Program, []models.ProgramCriterion, error) {
	var p models.Program
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, name, sport, goal_description, start_date, end_date, status, created_by, created_at, updated_at
		 FROM programs WHERE user_id = $1 AND status = 'active' LIMIT 1`, userID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Sport, &p.GoalDescription, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, nil, err
	}

	// Query criteria directly — ownership is already proven by the WHERE user_id clause above.
	rows, err := s.pool.Query(ctx,
		`SELECT id, program_id, key, label, value, value_type, display_order, created_at, updated_at
		 FROM program_criteria WHERE program_id = $1 ORDER BY display_order`, p.ID)
	if err != nil {
		return &p, nil, err
	}
	defer rows.Close()

	var criteria []models.ProgramCriterion
	for rows.Next() {
		var c models.ProgramCriterion
		if err := rows.Scan(&c.ID, &c.ProgramID, &c.Key, &c.Label, &c.Value, &c.ValueType, &c.DisplayOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return &p, nil, err
		}
		criteria = append(criteria, c)
	}
	if err := rows.Err(); err != nil {
		return &p, nil, err
	}
	return &p, criteria, nil
}

func (s *ProgramService) loadPhases(ctx context.Context, programID string) ([]models.Phase, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, program_id, name, order_index, start_date, end_date, deload_weeks, deload_pct, created_at
		 FROM phases WHERE program_id = $1 ORDER BY order_index`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var phases []models.Phase
	for rows.Next() {
		var p models.Phase
		if err := rows.Scan(&p.ID, &p.ProgramID, &p.Name, &p.OrderIndex, &p.StartDate, &p.EndDate, &p.DeloadWeeks, &p.DeloadPct, &p.CreatedAt); err != nil {
			return nil, err
		}
		phases = append(phases, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range phases {
		weeks, err := s.loadWeeks(ctx, phases[i].ID)
		if err != nil {
			return nil, err
		}
		phases[i].Weeks = weeks
	}
	return phases, nil
}

func (s *ProgramService) loadWeeks(ctx context.Context, phaseID string) ([]models.Week, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, phase_id, week_number, start_date, created_at
		 FROM weeks WHERE phase_id = $1 ORDER BY week_number`, phaseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var weeks []models.Week
	for rows.Next() {
		var w models.Week
		if err := rows.Scan(&w.ID, &w.PhaseID, &w.WeekNumber, &w.StartDate, &w.CreatedAt); err != nil {
			return nil, err
		}
		weeks = append(weeks, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range weeks {
		activities, err := s.loadActivities(ctx, weeks[i].ID)
		if err != nil {
			return nil, err
		}
		weeks[i].Activities = activities
	}
	return weeks, nil
}

func (s *ProgramService) loadActivities(ctx context.Context, weekID string) ([]models.ScheduledActivity, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT sa.id, sa.week_id, sa.day_of_week, sa.activity_type, sa.prescription, sa.notes,
		        sa.order_index, sa.created_at, sa.updated_at,
		        (SELECT w.id FROM workouts w WHERE w.scheduled_activity_id = sa.id LIMIT 1) AS linked_workout_id,
		        sa.is_override, CASE WHEN sa.is_override THEN NULL ELSE s.progression END
		 FROM scheduled_activities sa
		 LEFT JOIN activity_series s ON s.id = sa.series_id
		 WHERE sa.week_id = $1
		 ORDER BY sa.day_of_week, sa.order_index`, weekID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []models.ScheduledActivity
	for rows.Next() {
		var a models.ScheduledActivity
		var progression []byte
		if err := rows.Scan(&a.ID, &a.WeekID, &a.DayOfWeek, &a.ActivityType, &a.Prescription, &a.Notes, &a.OrderIndex, &a.CreatedAt, &a.UpdatedAt, &a.LinkedWorkoutID, &a.IsOverride, &progression); err != nil {
			return nil, err
		}
		if len(progression) > 0 {
			if err := json.Unmarshal(progression, &a.Progression); err != nil {
				return nil, fmt.Errorf("unmarshal progression: %w", err)
			}
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

// SaveProgramWithCriteria stores a template program as the user's active
// program: each template activity becomes an activity series, materialized
// into one scheduled activity per week with progression and deloads applied.
// createdBy is "grit" or "user"; a non-empty draftProgramID promotes that draft.
func (s *ProgramService) SaveProgramWithCriteria(ctx context.Context, userID string, programInput models.TemplateProgramInput, createdBy string, criteriaInput []models.SaveCriterionInput, draftProgramID string) (*models.ProgramDetailResponse, error) {
	if err := programInput.Prepare(); err != nil {
		return nil, invalid(err)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Archive any existing active program
	_, err = tx.Exec(ctx,
		`UPDATE programs SET status = 'archived', updated_at = NOW()
		 WHERE user_id = $1 AND status = 'active'`, userID)
	if err != nil {
		return nil, fmt.Errorf("archive active: %w", err)
	}

	// Parse dates
	startDate, err := time.Parse("2006-01-02", programInput.StartDate)
	if err != nil {
		return nil, fmt.Errorf("parse start_date: %w", err)
	}
	var endDate *time.Time
	if programInput.EndDate != "" {
		t, err := time.Parse("2006-01-02", programInput.EndDate)
		if err != nil {
			return nil, fmt.Errorf("parse end_date: %w", err)
		}
		endDate = &t
	}

	var programID string
	if draftProgramID != "" {
		// Verify ownership before any write so an LLM-supplied victim ID can't
		// trigger the unscoped DELETEs below.
		if err := s.verifyProgramOwnershipTx(ctx, tx, draftProgramID, userID); err != nil {
			return nil, err
		}
		// Update existing draft and promote to active
		tag, err := tx.Exec(ctx,
			`UPDATE programs SET name = $3, sport = $4, goal_description = $5, start_date = $6, end_date = $7, status = 'active', updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			draftProgramID, userID, programInput.Name, nilIfEmpty(programInput.Sport), nilIfEmpty(programInput.GoalDescription), startDate, endDate)
		if err != nil {
			return nil, fmt.Errorf("update draft program: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("draft program not found or access denied")
		}
		programID = draftProgramID

		// Delete old phases (CASCADE deletes weeks and activities)
		_, err = tx.Exec(ctx, `DELETE FROM phases WHERE program_id = $1`, programID)
		if err != nil {
			return nil, fmt.Errorf("delete draft phases: %w", err)
		}
		// Delete old criteria so they can be replaced
		_, err = tx.Exec(ctx, `DELETE FROM program_criteria WHERE program_id = $1`, programID)
		if err != nil {
			return nil, fmt.Errorf("delete draft criteria: %w", err)
		}
	} else {
		// Insert new program
		err = tx.QueryRow(ctx,
			`INSERT INTO programs (user_id, name, sport, goal_description, start_date, end_date, status, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
			 RETURNING id`,
			userID, programInput.Name, nilIfEmpty(programInput.Sport), nilIfEmpty(programInput.GoalDescription), startDate, endDate, createdBy,
		).Scan(&programID)
		if err != nil {
			return nil, fmt.Errorf("insert program: %w", err)
		}
	}

	// Insert criteria
	for _, c := range criteriaInput {
		valueType := c.ValueType
		if valueType == "" {
			valueType = "text"
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO program_criteria (program_id, key, label, value, value_type, display_order)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			programID, c.Key, c.Label, c.Value, valueType, c.DisplayOrder)
		if err != nil {
			return nil, fmt.Errorf("insert criterion %s: %w", c.Key, err)
		}
	}

	if err := insertTemplatePhases(ctx, tx, programID, programInput); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.GetByID(ctx, programID, userID)
}

func (s *ProgramService) UpdateProgram(ctx context.Context, programID, userID string, input models.UpdateProgramInput) (*models.ProgramResponse, error) {
	// If setting to active, archive the current active program first
	if input.Status != nil && *input.Status == "active" {
		_, err := s.pool.Exec(ctx,
			`UPDATE programs SET status = 'archived', updated_at = NOW()
			 WHERE user_id = $1 AND status = 'active' AND id != $2`, userID, programID)
		if err != nil {
			return nil, err
		}
	}

	var p models.Program
	err := s.pool.QueryRow(ctx,
		`UPDATE programs SET
			name = COALESCE($3, name),
			status = COALESCE($4, status),
			updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, sport, goal_description, start_date, end_date, status, created_by, created_at, updated_at`,
		programID, userID, input.Name, input.Status,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Sport, &p.GoalDescription, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	resp := p.ToResponse()
	return &resp, nil
}

func (s *ProgramService) GetCriteria(ctx context.Context, programID, userID string) ([]models.ProgramCriterion, error) {
	if err := s.VerifyProgramOwnership(ctx, programID, userID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, program_id, key, label, value, value_type, display_order, created_at, updated_at
		 FROM program_criteria WHERE program_id = $1 ORDER BY display_order`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var criteria []models.ProgramCriterion
	for rows.Next() {
		var c models.ProgramCriterion
		if err := rows.Scan(&c.ID, &c.ProgramID, &c.Key, &c.Label, &c.Value, &c.ValueType, &c.DisplayOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		criteria = append(criteria, c)
	}
	if criteria == nil {
		criteria = []models.ProgramCriterion{}
	}
	return criteria, rows.Err()
}

func (s *ProgramService) UpsertCriteria(ctx context.Context, programID, userID string, criteria []models.SaveCriterionInput) ([]models.ProgramCriterion, error) {
	if err := s.VerifyProgramOwnership(ctx, programID, userID); err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, c := range criteria {
		valueType := c.ValueType
		if valueType == "" {
			valueType = "text"
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO program_criteria (program_id, key, label, value, value_type, display_order)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (program_id, key) DO UPDATE SET
				label = EXCLUDED.label,
				value = EXCLUDED.value,
				value_type = EXCLUDED.value_type,
				display_order = EXCLUDED.display_order,
				updated_at = NOW()`,
			programID, c.Key, c.Label, c.Value, valueType, c.DisplayOrder)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetCriteria(ctx, programID, userID)
}

// ApplyEdits processes a unified set of program edits within a single transaction.
// Returns the number of affected rows.
func (s *ProgramService) ApplyEdits(ctx context.Context, programID, userID string, edits []models.ProgramEdit) (int, error) {
	if err := s.VerifyProgramOwnership(ctx, programID, userID); err != nil {
		return 0, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	affected := 0
	for _, edit := range edits {
		n, err := s.applyOneEdit(ctx, tx, programID, userID, edit)
		if err != nil {
			return 0, err
		}
		affected += n
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return affected, nil
}

func (s *ProgramService) applyOneEdit(ctx context.Context, tx pgx.Tx, programID, userID string, edit models.ProgramEdit) (int, error) {
	switch edit.Action {
	case "update_activity":
		return s.applyUpdateActivity(ctx, tx, programID, userID, edit)
	case "remove_activity":
		return s.applyRemoveActivity(ctx, tx, programID, edit)
	case "add_activity":
		return s.applyAddActivity(ctx, tx, programID, edit)
	case "swap_day":
		return s.applySwapDay(ctx, tx, programID, edit)
	case "update_criteria":
		return s.applyUpdateCriteria(ctx, tx, programID, userID, edit)
	default:
		return 0, fmt.Errorf("unknown edit action: %s", edit.Action)
	}
}

func (s *ProgramService) applyUpdateActivity(ctx context.Context, tx pgx.Tx, programID, userID string, edit models.ProgramEdit) (int, error) {
	// By-ID mode: update a single specific activity.
	if edit.ActivityID != "" {
		n, err := updateInstance(ctx, tx, programID, userID, edit.ActivityID, models.UpdateActivityInput{
			Prescription: edit.Prescription,
			Notes:        edit.Notes,
			DayOfWeek:    edit.DayOfWeek,
			ActivityType: nilIfEmpty(edit.ActivityType),
		})
		if err != nil {
			return 0, fmt.Errorf("activity %s: %w", edit.ActivityID, err)
		}
		return n, nil
	}

	// Bulk mode: update the recurring series on that day.
	if edit.DayOfWeek == nil {
		return 0, fmt.Errorf("update_activity requires activity_id or day_of_week")
	}
	return applyUpdateSeries(ctx, tx, programID, edit)
}

// updateInstance edits one scheduled activity of the user's program and marks
// it as an override, so later series edits leave it alone.
func updateInstance(ctx context.Context, q querier, programID, userID, activityID string, u models.UpdateActivityInput) (int, error) {
	var ownerID, activityType string
	if err := q.QueryRow(ctx,
		`SELECT p.user_id, sa.activity_type FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE sa.id = $1 AND p.id = $2`, activityID, programID,
	).Scan(&ownerID, &activityType); err != nil {
		return 0, fmt.Errorf("not found in program: %w", err)
	}
	if ownerID != userID {
		return 0, fmt.Errorf("access denied")
	}
	if u.ActivityType != nil {
		activityType = *u.ActivityType
	}
	if err := models.ValidatePrescription(activityType, u.Prescription); err != nil {
		return 0, invalid(err)
	}

	tag, err := q.Exec(ctx,
		`UPDATE scheduled_activities SET
			prescription = COALESCE($2, prescription),
			notes = COALESCE($3, notes),
			day_of_week = COALESCE($4, day_of_week),
			activity_type = COALESCE($5, activity_type),
			is_override = TRUE,
			updated_at = NOW()
		 WHERE id = $1`,
		activityID, u.Prescription, u.Notes, u.DayOfWeek, u.ActivityType,
	)
	if err != nil {
		return 0, fmt.Errorf("update: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (s *ProgramService) applyRemoveActivity(ctx context.Context, tx pgx.Tx, programID string, edit models.ProgramEdit) (int, error) {
	// By-ID mode: delete a single specific activity.
	if edit.ActivityID != "" {
		tag, err := tx.Exec(ctx,
			`DELETE FROM scheduled_activities WHERE id = $1 AND week_id IN (
				SELECT w.id FROM weeks w JOIN phases ph ON ph.id = w.phase_id WHERE ph.program_id = $2
			)`,
			edit.ActivityID, programID,
		)
		if err != nil {
			return 0, fmt.Errorf("remove activity %s: %w", edit.ActivityID, err)
		}
		return int(tag.RowsAffected()), nil
	}

	// Bulk mode: remove the recurring series on that day and its upcoming,
	// unrecorded sessions. Past sessions stay as history.
	if edit.DayOfWeek == nil {
		return 0, fmt.Errorf("remove_activity requires activity_id or day_of_week")
	}

	weekFilter, weekFilterArgs, argIdx := buildWeekFilter(programID, edit.PhaseIndex, "week_id")
	dayArgIdx := argIdx
	weekFilterArgs = append(weekFilterArgs, *edit.DayOfWeek)
	argIdx++

	typeFilterClause, weekFilterArgs := appendTypeFilter(edit.ActivityTypeFilter, weekFilterArgs, argIdx)

	tag, err := tx.Exec(ctx,
		fmt.Sprintf(`DELETE FROM scheduled_activities WHERE day_of_week = $%d%s AND %s AND `, dayArgIdx, typeFilterClause, weekFilter)+openInstanceSQL,
		weekFilterArgs...,
	)
	if err != nil {
		return 0, fmt.Errorf("remove_activity bulk: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`DELETE FROM activity_series s USING phases ph
		 WHERE ph.id = s.phase_id AND ph.program_id = $1 AND s.day_of_week = $2
		   AND ($3::int IS NULL OR ph.order_index = $3)
		   AND ($4 = '' OR s.activity_type = $4)`,
		programID, *edit.DayOfWeek, edit.PhaseIndex, edit.ActivityTypeFilter); err != nil {
		return 0, fmt.Errorf("remove series: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (s *ProgramService) applyAddActivity(ctx context.Context, tx pgx.Tx, programID string, edit models.ProgramEdit) (int, error) {
	if edit.ActivityType == "" {
		return 0, fmt.Errorf("add_activity requires activity_type")
	}

	// Single-week mode: add to a specific week.
	if edit.WeekID != "" {
		if edit.DayOfWeek == nil {
			return 0, fmt.Errorf("add_activity with week_id requires day_of_week")
		}
		// Verify week belongs to program.
		var exists bool
		err := tx.QueryRow(ctx,
			`SELECT EXISTS(
				SELECT 1 FROM weeks w JOIN phases ph ON ph.id = w.phase_id
				WHERE w.id = $1 AND ph.program_id = $2
			)`, edit.WeekID, programID).Scan(&exists)
		if err != nil || !exists {
			return 0, fmt.Errorf("week %s does not belong to program %s", edit.WeekID, programID)
		}

		if err := models.ValidatePrescription(edit.ActivityType, edit.Prescription); err != nil {
			return 0, invalid(err)
		}
		if _, err := insertScheduledActivity(ctx, tx, newActivity{
			WeekID: edit.WeekID, Day: *edit.DayOfWeek, ActivityType: edit.ActivityType,
			Prescription: edit.Prescription, Notes: edit.Notes,
		}); err != nil {
			return 0, fmt.Errorf("add_activity insert: %w", err)
		}
		return 1, nil
	}

	// Bulk mode: a new recurring series in every (filtered) phase.
	if edit.DayOfWeek == nil {
		return 0, fmt.Errorf("add_activity requires week_id or day_of_week")
	}
	return applyAddSeries(ctx, tx, programID, edit)
}

// applySwapDay swaps two days for the recurring series and for upcoming,
// unrecorded sessions in weeks where both days are still ahead.
func (s *ProgramService) applySwapDay(ctx context.Context, tx pgx.Tx, programID string, edit models.ProgramEdit) (int, error) {
	if edit.DayOfWeek == nil || edit.NewDay == nil {
		return 0, fmt.Errorf("swap_day requires day_of_week and new_day")
	}
	dayA, dayB := *edit.DayOfWeek, *edit.NewDay
	// Only weeks where the earlier of the two days is still ahead.
	earlier := dayA
	if models.DowOffset(dayB) < models.DowOffset(dayA) {
		earlier = dayB
	}

	weekFilter, args, argIdx := buildWeekFilter(programID, edit.PhaseIndex, "week_id")
	args = append(args, dayA, dayB, earlier)
	tag, err := tx.Exec(ctx,
		fmt.Sprintf(`UPDATE scheduled_activities
		 SET day_of_week = CASE WHEN day_of_week = $%[1]d THEN $%[2]d ELSE $%[1]d END, updated_at = NOW()
		 WHERE day_of_week IN ($%[1]d, $%[2]d) AND %[3]s AND `, argIdx, argIdx+1, weekFilter)+
			notPastSQL(fmt.Sprintf("$%d::int", argIdx+2))+" AND "+unrecordedSQL,
		args...,
	)
	if err != nil {
		return 0, fmt.Errorf("swap_day: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE activity_series SET day_of_week = CASE WHEN day_of_week = $2 THEN $3 ELSE $2 END, updated_at = NOW()
		 WHERE day_of_week IN ($2, $3) AND phase_id IN (
		   SELECT id FROM phases WHERE program_id = $1 AND ($4::int IS NULL OR order_index = $4))`,
		programID, dayA, dayB, edit.PhaseIndex); err != nil {
		return 0, fmt.Errorf("swap_day series: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (s *ProgramService) applyUpdateCriteria(ctx context.Context, tx pgx.Tx, programID, userID string, edit models.ProgramEdit) (int, error) {
	if len(edit.Criteria) == 0 {
		return 0, nil
	}
	count := 0
	for _, c := range edit.Criteria {
		tag, err := tx.Exec(ctx,
			`INSERT INTO program_criteria (program_id, key, label, value, value_type, display_order)
			 VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5,''), 'text'), $6)
			 ON CONFLICT (program_id, key) DO UPDATE SET
				label = EXCLUDED.label, value = EXCLUDED.value,
				value_type = EXCLUDED.value_type, display_order = EXCLUDED.display_order`,
			programID, c.Key, c.Label, c.Value, c.ValueType, c.DisplayOrder,
		)
		if err != nil {
			return 0, fmt.Errorf("upsert criterion %s: %w", c.Key, err)
		}
		count += int(tag.RowsAffected())
	}
	return count, nil
}

// buildWeekFilter constructs a SQL subquery that selects week IDs belonging to
// the given program, optionally filtered to a single phase by order_index.
// It returns the SQL clause, accumulated args, and the next available $N index.
func buildWeekFilter(programID string, phaseIndex *int, weekIDAlias string) (clause string, args []any, nextArg int) {
	clause = fmt.Sprintf(`%s IN (
		SELECT w2.id FROM weeks w2
		JOIN phases ph ON ph.id = w2.phase_id
		WHERE ph.program_id = $1`, weekIDAlias)
	args = []any{programID}
	nextArg = 2

	if phaseIndex != nil {
		clause += fmt.Sprintf(` AND ph.order_index = $%d`, nextArg)
		args = append(args, *phaseIndex)
		nextArg++
	}
	clause += `)`
	return
}

// appendTypeFilter adds an optional `AND activity_type = $N` clause when the
// filter is non-empty, appending the value to args and returning updated values.
func appendTypeFilter(filter string, args []any, argIdx int) (clause string, updatedArgs []any) {
	if filter == "" {
		return "", args
	}
	clause = fmt.Sprintf(` AND activity_type = $%d`, argIdx)
	return clause, append(args, filter)
}

// VerifyProgramOwnership checks that a program exists and belongs to the given user.
func (s *ProgramService) VerifyProgramOwnership(ctx context.Context, programID, userID string) error {
	var ownerID string
	err := s.pool.QueryRow(ctx, `SELECT user_id FROM programs WHERE id = $1`, programID).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("program not found")
	}
	if err != nil {
		return fmt.Errorf("verify program ownership: %w", err)
	}
	if ownerID != userID {
		return fmt.Errorf("access denied")
	}
	return nil
}

// verifyProgramOwnershipTx is the transactional variant used inside a write
// path that must atomically check ownership before mutating related rows.
func (s *ProgramService) verifyProgramOwnershipTx(ctx context.Context, tx pgx.Tx, programID, userID string) error {
	var ownerID string
	err := tx.QueryRow(ctx, `SELECT user_id FROM programs WHERE id = $1`, programID).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("program not found")
	}
	if err != nil {
		return fmt.Errorf("verify program ownership: %w", err)
	}
	if ownerID != userID {
		return fmt.Errorf("access denied")
	}
	return nil
}

func (s *ProgramService) GetUpcomingActivities(ctx context.Context, userID string, limit int) ([]models.UpcomingActivityResponse, error) {
	if limit <= 0 {
		limit = 6
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	rows, err := s.pool.Query(ctx,
		`SELECT sa.id, sa.activity_type, sa.day_of_week, sa.prescription, sa.notes,
		        w.week_number, ph.name, sa.order_index,
		        COALESCE(w.start_date, p.start_date + ((w.week_number - 1) * 7 || ' days')::interval) AS raw_start
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE p.user_id = $1 AND p.status = 'active'
		 ORDER BY raw_start, sa.order_index`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type actWithDate struct {
		act        models.UpcomingActivityResponse
		date       time.Time
		orderIndex int
	}
	var all []actWithDate
	for rows.Next() {
		var a models.UpcomingActivityResponse
		var rawStart time.Time
		var orderIndex int
		if err := rows.Scan(&a.ID, &a.ActivityType, &a.DayOfWeek, &a.Prescription, &a.Notes, &a.WeekNumber, &a.PhaseName, &orderIndex, &rawStart); err != nil {
			return nil, err
		}
		weekMonday := models.MondayOf(rawStart)
		actDate := weekMonday.AddDate(0, 0, models.DowOffset(a.DayOfWeek))
		if actDate.Before(today) {
			continue
		}
		a.Date = actDate.Format("2006-01-02")
		all = append(all, actWithDate{act: a, date: actDate, orderIndex: orderIndex})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(all, func(i, j int) bool {
		if !all[i].date.Equal(all[j].date) {
			return all[i].date.Before(all[j].date)
		}
		return all[i].orderIndex < all[j].orderIndex
	})

	activities := make([]models.UpcomingActivityResponse, 0, limit)
	for _, item := range all {
		activities = append(activities, item.act)
		if len(activities) >= limit {
			break
		}
	}
	return activities, nil
}

// LinkableCandidate carries a linkable activity together with the values
// needed to sort it (date and intra-day order). Exposed for testability.
type LinkableCandidate struct {
	Activity   models.LinkableActivityResponse
	Date       time.Time
	OrderIndex int
}

// linkableDatePriority assigns a sort key for a candidate date relative to
// refDay; lower wins. With the chosen ordering, past days come first
// (-1, -2, -3), then today, then future (+1, +2, +3). windowDays bounds the
// future tail.
func linkableDatePriority(d, refDay time.Time, windowDays int) int {
	diff := int(d.Sub(refDay).Hours() / 24)
	if diff < 0 {
		return -diff - 1
	}
	return windowDays + diff
}

// SortLinkableCandidates orders candidates by: same-type first, then date
// priority around refDay, then intra-day order_index. Mutates in place.
func SortLinkableCandidates(items []LinkableCandidate, refDay time.Time, windowDays int) {
	sort.Slice(items, func(i, j int) bool {
		if items[i].Activity.SameType != items[j].Activity.SameType {
			return items[i].Activity.SameType
		}
		pi := linkableDatePriority(items[i].Date, refDay, windowDays)
		pj := linkableDatePriority(items[j].Date, refDay, windowDays)
		if pi != pj {
			return pi < pj
		}
		return items[i].OrderIndex < items[j].OrderIndex
	})
}

// GetLinkableActivities returns scheduled activities from the user's active
// program, within +/- windowDays of refDate, that are not yet linked to a
// recorded workout. Results are sorted with same-type matches first, then by
// date priority [-1, -2, -3, today, +1, +2, +3] (past days preferred), then by
// order_index within the same day.
func (s *ProgramService) GetLinkableActivities(ctx context.Context, userID, activityType string, refDate time.Time, windowDays int) ([]models.LinkableActivityResponse, error) {
	if windowDays <= 0 {
		windowDays = 3
	}
	refDay := time.Date(refDate.Year(), refDate.Month(), refDate.Day(), 0, 0, 0, 0, time.UTC)
	minDate := refDay.AddDate(0, 0, -windowDays)
	maxDate := refDay.AddDate(0, 0, windowDays)

	rows, err := s.pool.Query(ctx,
		`SELECT sa.id, sa.activity_type, sa.day_of_week, sa.prescription, sa.notes,
		        w.week_number, ph.name, sa.order_index,
		        COALESCE(w.start_date, p.start_date + ((w.week_number - 1) * 7 || ' days')::interval) AS raw_start
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 LEFT JOIN workouts wo ON wo.scheduled_activity_id = sa.id AND wo.user_id = $1
		 WHERE p.user_id = $1 AND p.status = 'active' AND wo.id IS NULL`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []LinkableCandidate
	for rows.Next() {
		var a models.LinkableActivityResponse
		var rawStart time.Time
		var orderIndex int
		if err := rows.Scan(&a.ID, &a.ActivityType, &a.DayOfWeek, &a.Prescription, &a.Notes, &a.WeekNumber, &a.PhaseName, &orderIndex, &rawStart); err != nil {
			return nil, err
		}
		weekMonday := models.MondayOf(rawStart)
		actDate := weekMonday.AddDate(0, 0, models.DowOffset(a.DayOfWeek))
		if actDate.Before(minDate) || actDate.After(maxDate) {
			continue
		}
		a.Date = actDate.Format("2006-01-02")
		a.SameType = strings.EqualFold(a.ActivityType, activityType)
		all = append(all, LinkableCandidate{Activity: a, Date: actDate, OrderIndex: orderIndex})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	SortLinkableCandidates(all, refDay, windowDays)

	out := make([]models.LinkableActivityResponse, 0, len(all))
	for _, it := range all {
		out = append(out, it.Activity)
	}
	return out, nil
}

func (s *ProgramService) GetScheduledActivity(ctx context.Context, activityID, userID string) (*models.ScheduledActivity, error) {
	var a models.ScheduledActivity
	err := s.pool.QueryRow(ctx,
		`SELECT sa.id, sa.week_id, sa.day_of_week, sa.activity_type, sa.prescription, sa.notes, sa.order_index, sa.created_at, sa.updated_at
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE sa.id = $1 AND p.user_id = $2`, activityID, userID,
	).Scan(&a.ID, &a.WeekID, &a.DayOfWeek, &a.ActivityType, &a.Prescription, &a.Notes, &a.OrderIndex, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *ProgramService) CreateDraftProgram(ctx context.Context, userID, name, sport string) (*models.ProgramResponse, error) {
	var p models.Program
	err := s.pool.QueryRow(ctx,
		`INSERT INTO programs (user_id, name, sport, start_date, status, created_by)
		 VALUES ($1, $2, $3, NOW(), 'draft', 'grit')
		 RETURNING id, user_id, name, sport, goal_description, start_date, end_date, status, created_by, created_at, updated_at`,
		userID, name, nilIfEmpty(sport),
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Sport, &p.GoalDescription, &p.StartDate, &p.EndDate, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert draft program: %w", err)
	}
	resp := p.ToResponse()
	return &resp, nil
}

func (s *ProgramService) GetDraftProgram(ctx context.Context, userID string) (*models.ProgramDetailResponse, error) {
	var programID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM programs WHERE user_id = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&programID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, programID, userID)
}

// GetActivityDetail returns the activity only if it belongs to the given user.
// Ownership is enforced at the SQL layer (p.user_id = $2) so no caller can
// accidentally expose another user's activity by omitting an in-memory check.
func (s *ProgramService) GetActivityDetail(ctx context.Context, activityID, userID string) (*models.ActivityDetailResponse, error) {
	var a models.ActivityDetailResponse
	var weekStartDate *time.Time
	var programStartDate time.Time
	var weekNumber int
	err := s.pool.QueryRow(ctx,
		`SELECT sa.id, sa.activity_type, sa.day_of_week, sa.prescription, sa.notes, sa.order_index,
		        w.week_number, ph.name, p.id, p.name, p.user_id, w.start_date, p.start_date,
		        wo.id, wo.started_at, wo.source, wo.gps_route
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 LEFT JOIN workouts wo ON wo.scheduled_activity_id = sa.id AND wo.user_id = p.user_id
		 WHERE sa.id = $1 AND p.user_id = $2
		 LIMIT 1`, activityID, userID,
	).Scan(&a.ID, &a.ActivityType, &a.DayOfWeek, &a.Prescription, &a.Notes, &a.OrderIndex,
		&weekNumber, &a.PhaseName, &a.ProgramID, &a.ProgramName, &a.UserID, &weekStartDate, &programStartDate,
		&a.LinkedWorkoutID, &a.LinkedWorkoutRecordedAt, &a.LinkedWorkoutSource, &a.LinkedGPSRoute)
	if err != nil {
		return nil, err
	}
	a.WeekNumber = weekNumber

	var raw time.Time
	if weekStartDate != nil {
		raw = *weekStartDate
	} else {
		raw = programStartDate.AddDate(0, 0, (weekNumber-1)*7)
	}
	weekMonday := models.MondayOf(raw)
	a.Date = weekMonday.AddDate(0, 0, models.DowOffset(a.DayOfWeek)).Format("2006-01-02")
	return &a, nil
}

func (s *ProgramService) CreateActivity(ctx context.Context, programID, weekID, userID string, input models.SaveActivityInput) (*models.ActivityDetailResponse, error) {
	var ownerID string
	err := s.pool.QueryRow(ctx,
		`SELECT p.user_id FROM weeks w
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE w.id = $1 AND p.id = $2`, weekID, programID,
	).Scan(&ownerID)
	if err != nil {
		return nil, fmt.Errorf("week not found in program: %w", err)
	}
	if ownerID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	if err := models.ValidatePrescription(input.ActivityType, input.Prescription); err != nil {
		return nil, invalid(err)
	}
	activityID, err := insertScheduledActivity(ctx, s.pool, newActivity{
		WeekID: weekID, Day: input.DayOfWeek, ActivityType: input.ActivityType,
		Prescription: input.Prescription, Notes: nilIfEmpty(input.Notes),
	})
	if err != nil {
		return nil, fmt.Errorf("create activity: %w", err)
	}

	return s.GetActivityDetail(ctx, activityID, userID)
}

func (s *ProgramService) UpdateActivity(ctx context.Context, programID, activityID, userID string, input models.UpdateActivityInput) (*models.ActivityDetailResponse, error) {
	if _, err := updateInstance(ctx, s.pool, programID, userID, activityID, input); err != nil {
		return nil, fmt.Errorf("update activity: %w", err)
	}

	return s.GetActivityDetail(ctx, activityID, userID)
}

// SetProgramEvent creates or updates the program's goal event — a single
// scheduled activity of type `event` placed in the program's final week. The
// program's end_date is aligned to the event date. Idempotent: re-calling
// updates the existing event rather than adding a second one.
func (s *ProgramService) SetProgramEvent(ctx context.Context, programID, userID string, in models.SetProgramEventInput) (*models.ActivityDetailResponse, error) {
	if err := s.VerifyProgramOwnership(ctx, programID, userID); err != nil {
		return nil, err
	}
	eventDate, err := time.Parse("2006-01-02", in.Date)
	if err != nil {
		return nil, fmt.Errorf("parse date: %w", err)
	}
	dayOfWeek := int(eventDate.Weekday()) // Sunday=0..Saturday=6, matches schema

	// Store the absolute date in the prescription so the UI shows the real
	// event day regardless of week-grid math, plus the rich event metadata.
	prescription := map[string]any{"date": in.Date}
	for k, v := range map[string]string{
		"event_name":    in.EventName,
		"event_subtype": in.EventSubtype,
		"location":      in.Location,
		"goal":          in.Goal,
		"distance":      in.Distance,
	} {
		if v != "" {
			prescription[k] = v
		}
	}
	prescriptionJSON, err := json.Marshal(prescription)
	if err != nil {
		return nil, fmt.Errorf("marshal prescription: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// The program's last week (latest phase, latest week) anchors the event.
	var lastWeekID string
	err = tx.QueryRow(ctx,
		`SELECT w.id FROM weeks w
		 JOIN phases ph ON ph.id = w.phase_id
		 WHERE ph.program_id = $1
		 ORDER BY ph.order_index DESC, w.week_number DESC
		 LIMIT 1`, programID,
	).Scan(&lastWeekID)
	if err != nil {
		return nil, fmt.Errorf("find last week: %w", err)
	}

	// Reuse an existing event activity if present.
	var activityID string
	err = tx.QueryRow(ctx,
		`SELECT sa.id FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 WHERE ph.program_id = $1 AND sa.activity_type = 'event'
		 LIMIT 1`, programID,
	).Scan(&activityID)
	switch {
	case err == pgx.ErrNoRows:
		err = tx.QueryRow(ctx,
			`INSERT INTO scheduled_activities (week_id, day_of_week, activity_type, prescription, notes, order_index)
			 VALUES ($1, $2, 'event', $3, $4, 0) RETURNING id`,
			lastWeekID, dayOfWeek, prescriptionJSON, nilIfEmpty(in.EventName),
		).Scan(&activityID)
		if err != nil {
			return nil, fmt.Errorf("insert event: %w", err)
		}
	case err != nil:
		return nil, fmt.Errorf("find event: %w", err)
	default:
		_, err = tx.Exec(ctx,
			`UPDATE scheduled_activities
			 SET week_id = $2, day_of_week = $3, prescription = $4, notes = $5, updated_at = NOW()
			 WHERE id = $1`,
			activityID, lastWeekID, dayOfWeek, prescriptionJSON, nilIfEmpty(in.EventName),
		)
		if err != nil {
			return nil, fmt.Errorf("update event: %w", err)
		}
	}

	if _, err = tx.Exec(ctx,
		`UPDATE programs SET end_date = $2, updated_at = NOW() WHERE id = $1`,
		programID, eventDate,
	); err != nil {
		return nil, fmt.Errorf("update end_date: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetActivityDetail(ctx, activityID, userID)
}

func (s *ProgramService) DeleteProgram(ctx context.Context, programID, userID string) error {
	result, err := s.pool.Exec(ctx,
		`DELETE FROM programs WHERE id = $1 AND user_id = $2`, programID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ResolveEditsBefore enriches each edit with its "before" state so the
// frontend can render before→after diffs. Errors per edit are non-fatal;
// the Before field is simply left nil.
func (s *ProgramService) ResolveEditsBefore(ctx context.Context, programID, userID string, edits []models.ProgramEdit) ([]models.EnrichedEdit, error) {
	result := make([]models.EnrichedEdit, len(edits))

	// Pre-fetch criteria and build lookup map once if any edit needs them.
	var criteriaMap map[string]models.ProgramCriterion
	for _, e := range edits {
		if e.Action == "update_criteria" {
			if criteria, err := s.GetCriteria(ctx, programID, userID); err == nil {
				criteriaMap = make(map[string]models.ProgramCriterion, len(criteria))
				for _, c := range criteria {
					criteriaMap[c.Key] = c
				}
			}
			break
		}
	}

	for i, edit := range edits {
		result[i].ProgramEdit = edit

		switch edit.Action {
		case "update_activity", "remove_activity":
			if edit.ActivityID != "" {
				act, err := s.GetScheduledActivity(ctx, edit.ActivityID, userID)
				if err == nil {
					result[i].Before = &models.EditBeforeState{
						Activity: &models.ActivitySnapshot{
							ActivityType: act.ActivityType,
							Prescription: act.Prescription,
							Notes:        act.Notes,
						},
					}
				}
			} else if edit.DayOfWeek != nil {
				snap := s.sampleSeriesByDay(ctx, programID, *edit.DayOfWeek, edit.PhaseIndex, edit.ActivityTypeFilter)
				if snap != nil {
					result[i].Before = &models.EditBeforeState{Activity: snap}
				}
			}

		case "swap_day":
			if edit.DayOfWeek != nil && edit.NewDay != nil {
				dayA := s.sampleActivitiesByDay(ctx, programID, *edit.DayOfWeek, edit.PhaseIndex)
				dayB := s.sampleActivitiesByDay(ctx, programID, *edit.NewDay, edit.PhaseIndex)
				result[i].Before = &models.EditBeforeState{DayA: dayA, DayB: dayB}
			}

		case "update_criteria":
			if criteriaMap != nil && len(edit.Criteria) > 0 {
				var snaps []models.CriterionSnapshot
				for _, c := range edit.Criteria {
					if old, ok := criteriaMap[c.Key]; ok {
						snaps = append(snaps, models.CriterionSnapshot{
							Key: old.Key, Label: old.Label, Value: old.Value,
						})
					}
				}
				if len(snaps) > 0 {
					result[i].Before = &models.EditBeforeState{Criteria: snaps}
				}
			}
		}
	}
	return result, nil
}

// sampleActivitiesByDay returns all activities on a given day from the first
// matching week. Used to populate swap_day before-state.
func (s *ProgramService) sampleActivitiesByDay(ctx context.Context, programID string, dayOfWeek int, phaseIndex *int) []models.ActivitySnapshot {
	weekFilter, args, argIdx := buildWeekFilter(programID, phaseIndex, "sa.week_id")
	args = append(args, dayOfWeek)
	dayArg := argIdx

	// Find the first week that has activities on this day.
	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(`SELECT sa.activity_type, sa.prescription, sa.notes
		 FROM scheduled_activities sa
		 WHERE sa.day_of_week = $%d AND %s
		   AND sa.week_id = (
		       SELECT sa2.week_id FROM scheduled_activities sa2
		       WHERE sa2.day_of_week = $%d AND %s
		       ORDER BY sa2.week_id ASC LIMIT 1
		   )
		 ORDER BY sa.order_index ASC`, dayArg, weekFilter, dayArg, weekFilter),
		args...,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var result []models.ActivitySnapshot
	for rows.Next() {
		var snap models.ActivitySnapshot
		if err := rows.Scan(&snap.ActivityType, &snap.Prescription, &snap.Notes); err != nil {
			return nil
		}
		result = append(result, snap)
	}
	return result
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

package services

import (
	"context"
	"encoding/json"
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
	criteria, err := s.GetCriteria(ctx, programID)
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

func (s *ProgramService) loadPhases(ctx context.Context, programID string) ([]models.Phase, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, program_id, name, order_index, start_date, end_date, created_at
		 FROM phases WHERE program_id = $1 ORDER BY order_index`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var phases []models.Phase
	for rows.Next() {
		var p models.Phase
		if err := rows.Scan(&p.ID, &p.ProgramID, &p.Name, &p.OrderIndex, &p.StartDate, &p.EndDate, &p.CreatedAt); err != nil {
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
		`SELECT id, week_id, day_of_week, activity_type, prescription, notes, order_index, created_at, updated_at
		 FROM scheduled_activities WHERE week_id = $1 ORDER BY day_of_week, order_index`, weekID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []models.ScheduledActivity
	for rows.Next() {
		var a models.ScheduledActivity
		if err := rows.Scan(&a.ID, &a.WeekID, &a.DayOfWeek, &a.ActivityType, &a.Prescription, &a.Notes, &a.OrderIndex, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

func (s *ProgramService) SaveProgramWithCriteria(ctx context.Context, userID string, programInput models.SaveProgramInput, criteriaInput []models.SaveCriterionInput, draftProgramID ...string) (*models.ProgramDetailResponse, error) {
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
	draftID := ""
	if len(draftProgramID) > 0 {
		draftID = draftProgramID[0]
	}

	if draftID != "" {
		// Update existing draft and promote to active
		_, err = tx.Exec(ctx,
			`UPDATE programs SET name = $3, sport = $4, goal_description = $5, start_date = $6, end_date = $7, status = 'active', updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			draftID, userID, programInput.Name, nilIfEmpty(programInput.Sport), nilIfEmpty(programInput.GoalDescription), startDate, endDate)
		if err != nil {
			return nil, fmt.Errorf("update draft program: %w", err)
		}
		programID = draftID

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
		createdBy := programInput.CreatedBy
		if createdBy == "" {
			createdBy = "grit"
		}
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
		_, err = tx.Exec(ctx,
			`INSERT INTO program_criteria (program_id, key, label, value, value_type, display_order)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			programID, c.Key, c.Label, c.Value, c.ValueType, c.DisplayOrder)
		if err != nil {
			return nil, fmt.Errorf("insert criterion %s: %w", c.Key, err)
		}
	}

	// Insert phases, weeks, activities
	for _, phaseInput := range programInput.Phases {
		var phaseStartDate, phaseEndDate *time.Time
		if phaseInput.StartDate != "" {
			t, _ := time.Parse("2006-01-02", phaseInput.StartDate)
			phaseStartDate = &t
		}
		if phaseInput.EndDate != "" {
			t, _ := time.Parse("2006-01-02", phaseInput.EndDate)
			phaseEndDate = &t
		}

		var phaseID string
		err = tx.QueryRow(ctx,
			`INSERT INTO phases (program_id, name, order_index, start_date, end_date)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			programID, phaseInput.Name, phaseInput.OrderIndex, phaseStartDate, phaseEndDate,
		).Scan(&phaseID)
		if err != nil {
			return nil, fmt.Errorf("insert phase %s: %w", phaseInput.Name, err)
		}

		for _, weekInput := range phaseInput.Weeks {
			var weekStartDate *time.Time
			if weekInput.StartDate != "" {
				t, _ := time.Parse("2006-01-02", weekInput.StartDate)
				weekStartDate = &t
			}

			var weekID string
			err = tx.QueryRow(ctx,
				`INSERT INTO weeks (phase_id, week_number, start_date)
				 VALUES ($1, $2, $3) RETURNING id`,
				phaseID, weekInput.WeekNumber, weekStartDate,
			).Scan(&weekID)
			if err != nil {
				return nil, fmt.Errorf("insert week %d: %w", weekInput.WeekNumber, err)
			}

			for _, actInput := range weekInput.Activities {
				prescription := actInput.Prescription
				if prescription == nil {
					prescription = json.RawMessage("{}")
				}
				_, err = tx.Exec(ctx,
					`INSERT INTO scheduled_activities (week_id, day_of_week, activity_type, prescription, notes, order_index)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					weekID, actInput.DayOfWeek, actInput.ActivityType, prescription, nilIfEmpty(actInput.Notes), actInput.OrderIndex)
				if err != nil {
					return nil, fmt.Errorf("insert activity: %w", err)
				}
			}
		}
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

func (s *ProgramService) GetCriteria(ctx context.Context, programID string) ([]models.ProgramCriterion, error) {
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

func (s *ProgramService) UpsertCriteria(ctx context.Context, programID string, criteria []models.SaveCriterionInput) ([]models.ProgramCriterion, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, c := range criteria {
		_, err = tx.Exec(ctx,
			`INSERT INTO program_criteria (program_id, key, label, value, value_type, display_order)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (program_id, key) DO UPDATE SET
				label = EXCLUDED.label,
				value = EXCLUDED.value,
				value_type = EXCLUDED.value_type,
				display_order = EXCLUDED.display_order,
				updated_at = NOW()`,
			programID, c.Key, c.Label, c.Value, c.ValueType, c.DisplayOrder)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetCriteria(ctx, programID)
}

func (s *ProgramService) AdjustActivities(ctx context.Context, adjustments []models.AdjustActivityInput) ([]models.ScheduledActivity, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var updated []models.ScheduledActivity
	for _, adj := range adjustments {
		var a models.ScheduledActivity
		err := tx.QueryRow(ctx,
			`UPDATE scheduled_activities SET prescription = $2, updated_at = NOW()
			 WHERE id = $1
			 RETURNING id, week_id, day_of_week, activity_type, prescription, notes, order_index, created_at, updated_at`,
			adj.ActivityID, adj.Prescription,
		).Scan(&a.ID, &a.WeekID, &a.DayOfWeek, &a.ActivityType, &a.Prescription, &a.Notes, &a.OrderIndex, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("adjust activity %s: %w", adj.ActivityID, err)
		}
		updated = append(updated, a)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return updated, nil
}

// ModifyProgram applies structural modifications to a saved program across all weeks
// (or filtered by phase index). Returns the number of affected rows.
func (s *ProgramService) ModifyProgram(ctx context.Context, programID, userID string, mods []models.ProgramModificationAction) (int, error) {
	// Verify ownership
	var ownerID string
	err := s.pool.QueryRow(ctx, `SELECT user_id FROM programs WHERE id = $1`, programID).Scan(&ownerID)
	if err != nil {
		return 0, fmt.Errorf("program not found: %w", err)
	}
	if ownerID != userID {
		return 0, fmt.Errorf("access denied")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	affected := 0

	for _, mod := range mods {
		switch mod.Action {
		case "swap_day":
			if mod.NewDay == nil {
				return 0, fmt.Errorf("swap_day requires new_day")
			}
			newDay := *mod.NewDay

			// Phase filter subquery
			weekFilter := `w.id IN (
				SELECT w2.id FROM weeks w2
				JOIN phases ph ON ph.id = w2.phase_id
				WHERE ph.program_id = $1`
			weekFilterArgs := []any{programID}
			argIdx := 2

			if mod.PhaseIndex != nil {
				weekFilter += fmt.Sprintf(` AND ph.order_index = $%d`, argIdx)
				weekFilterArgs = append(weekFilterArgs, *mod.PhaseIndex)
				argIdx++
			}
			weekFilter += `)`

			// Temporarily set swapped days to a sentinel (-1) to avoid unique constraint conflicts
			_, err = tx.Exec(ctx,
				fmt.Sprintf(`UPDATE scheduled_activities SET day_of_week = -1, updated_at = NOW()
				 WHERE day_of_week = $%d AND %s`, argIdx, weekFilter),
				append(weekFilterArgs, mod.DayOfWeek)...,
			)
			if err != nil {
				return 0, fmt.Errorf("swap_day step1: %w", err)
			}
			argIdx++

			tag, err := tx.Exec(ctx,
				fmt.Sprintf(`UPDATE scheduled_activities SET day_of_week = $%d, updated_at = NOW()
				 WHERE day_of_week = $%d AND %s`, argIdx, argIdx+1, weekFilter),
				append(weekFilterArgs, mod.DayOfWeek, newDay)...,
			)
			if err != nil {
				return 0, fmt.Errorf("swap_day step2: %w", err)
			}
			affected += int(tag.RowsAffected())

			_, err = tx.Exec(ctx,
				fmt.Sprintf(`UPDATE scheduled_activities SET day_of_week = $%d, updated_at = NOW()
				 WHERE day_of_week = -1 AND %s`, argIdx, weekFilter),
				append(weekFilterArgs, newDay)...,
			)
			if err != nil {
				return 0, fmt.Errorf("swap_day step3: %w", err)
			}

		case "change_activity":
			weekFilter := `w.id IN (
				SELECT w2.id FROM weeks w2
				JOIN phases ph ON ph.id = w2.phase_id
				WHERE ph.program_id = $1`
			weekFilterArgs := []any{programID}
			argIdx := 2

			if mod.PhaseIndex != nil {
				weekFilter += fmt.Sprintf(` AND ph.order_index = $%d`, argIdx)
				weekFilterArgs = append(weekFilterArgs, *mod.PhaseIndex)
				argIdx++
			}
			weekFilter += `)`

			sets := []string{}
			if mod.ActivityType != "" {
				sets = append(sets, fmt.Sprintf(`activity_type = $%d`, argIdx))
				weekFilterArgs = append(weekFilterArgs, mod.ActivityType)
				argIdx++
			}
			if mod.Prescription != nil {
				sets = append(sets, fmt.Sprintf(`prescription = $%d`, argIdx))
				weekFilterArgs = append(weekFilterArgs, mod.Prescription)
				argIdx++
			}
			if mod.Notes != nil {
				sets = append(sets, fmt.Sprintf(`notes = $%d`, argIdx))
				weekFilterArgs = append(weekFilterArgs, *mod.Notes)
				argIdx++
			}
			if len(sets) == 0 {
				continue
			}

			tag, err := tx.Exec(ctx,
				fmt.Sprintf(`UPDATE scheduled_activities SET %s, updated_at = NOW()
				 WHERE day_of_week = $%d AND %s`,
					strings.Join(sets, ", "), argIdx, weekFilter),
				append(weekFilterArgs, mod.DayOfWeek)...,
			)
			if err != nil {
				return 0, fmt.Errorf("change_activity: %w", err)
			}
			affected += int(tag.RowsAffected())

		case "add_activity":
			if mod.ActivityType == "" {
				return 0, fmt.Errorf("add_activity requires activity_type")
			}
			prescription := mod.Prescription
			if prescription == nil {
				prescription = []byte("{}")
			}

			// Get week IDs for the program (optionally filtered by phase)
			phaseFilter := ""
			queryArgs := []any{programID}
			if mod.PhaseIndex != nil {
				phaseFilter = fmt.Sprintf(` AND ph.order_index = $%d`, 2)
				queryArgs = append(queryArgs, *mod.PhaseIndex)
			}

			rows, err := tx.Query(ctx,
				fmt.Sprintf(`SELECT w.id FROM weeks w
				 JOIN phases ph ON ph.id = w.phase_id
				 WHERE ph.program_id = $1%s`, phaseFilter),
				queryArgs...)
			if err != nil {
				return 0, fmt.Errorf("add_activity get weeks: %w", err)
			}
			var weekIDs []string
			for rows.Next() {
				var wid string
				if err := rows.Scan(&wid); err != nil {
					rows.Close()
					return 0, err
				}
				weekIDs = append(weekIDs, wid)
			}
			rows.Close()

			for _, wid := range weekIDs {
				var orderIdx int
				_ = tx.QueryRow(ctx,
					`SELECT COALESCE(MAX(order_index)+1, 0) FROM scheduled_activities WHERE week_id = $1 AND day_of_week = $2`,
					wid, mod.DayOfWeek).Scan(&orderIdx)

				_, err = tx.Exec(ctx,
					`INSERT INTO scheduled_activities (week_id, day_of_week, activity_type, prescription, notes, order_index)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					wid, mod.DayOfWeek, mod.ActivityType, prescription, mod.Notes, orderIdx)
				if err != nil {
					return 0, fmt.Errorf("add_activity insert: %w", err)
				}
				affected++
			}

		case "remove_activity":
			weekFilter := `week_id IN (
				SELECT w.id FROM weeks w
				JOIN phases ph ON ph.id = w.phase_id
				WHERE ph.program_id = $1`
			weekFilterArgs := []any{programID}
			argIdx := 2

			if mod.PhaseIndex != nil {
				weekFilter += fmt.Sprintf(` AND ph.order_index = $%d`, argIdx)
				weekFilterArgs = append(weekFilterArgs, *mod.PhaseIndex)
				argIdx++
			}
			weekFilter += `)`

			tag, err := tx.Exec(ctx,
				fmt.Sprintf(`DELETE FROM scheduled_activities WHERE day_of_week = $%d AND %s`, argIdx, weekFilter),
				append(weekFilterArgs, mod.DayOfWeek)...,
			)
			if err != nil {
				return 0, fmt.Errorf("remove_activity: %w", err)
			}
			affected += int(tag.RowsAffected())
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return affected, nil
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

func (s *ProgramService) GetScheduledActivity(ctx context.Context, activityID string) (*models.ScheduledActivity, error) {
	var a models.ScheduledActivity
	err := s.pool.QueryRow(ctx,
		`SELECT id, week_id, day_of_week, activity_type, prescription, notes, order_index, created_at, updated_at
		 FROM scheduled_activities WHERE id = $1`, activityID,
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

func (s *ProgramService) GetActivityDetail(ctx context.Context, activityID string) (*models.ActivityDetailResponse, error) {
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
		 WHERE sa.id = $1
		 LIMIT 1`, activityID,
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

	var orderIndex int
	_ = s.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(order_index) + 1, 0) FROM scheduled_activities WHERE week_id = $1 AND day_of_week = $2`,
		weekID, input.DayOfWeek,
	).Scan(&orderIndex)

	prescription := input.Prescription
	if prescription == nil {
		prescription = json.RawMessage("{}")
	}

	var activityID string
	if err = s.pool.QueryRow(ctx,
		`INSERT INTO scheduled_activities (week_id, day_of_week, activity_type, prescription, notes, order_index)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		weekID, input.DayOfWeek, input.ActivityType, prescription, nilIfEmpty(input.Notes), orderIndex,
	).Scan(&activityID); err != nil {
		return nil, fmt.Errorf("create activity: %w", err)
	}

	return s.GetActivityDetail(ctx, activityID)
}

func (s *ProgramService) UpdateActivity(ctx context.Context, programID, activityID, userID string, input models.UpdateActivityInput) (*models.ActivityDetailResponse, error) {
	// Verify ownership: activity belongs to program belongs to user
	var ownerID string
	err := s.pool.QueryRow(ctx,
		`SELECT p.user_id
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE sa.id = $1 AND p.id = $2`, activityID, programID,
	).Scan(&ownerID)
	if err != nil {
		return nil, fmt.Errorf("activity not found in program: %w", err)
	}
	if ownerID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	// Build dynamic update
	_, err = s.pool.Exec(ctx,
		`UPDATE scheduled_activities SET
			prescription = COALESCE($2, prescription),
			notes = COALESCE($3, notes),
			day_of_week = COALESCE($4, day_of_week),
			activity_type = COALESCE($5, activity_type),
			updated_at = NOW()
		 WHERE id = $1`,
		activityID, input.Prescription, input.Notes, input.DayOfWeek, input.ActivityType,
	)
	if err != nil {
		return nil, fmt.Errorf("update activity: %w", err)
	}

	return s.GetActivityDetail(ctx, activityID)
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

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/grittyfitness/api/internal/models"
)

// An activity series is a phase's recurring template activity. Its scheduled
// activities (one per week) are computed from the series' base prescription,
// progression rules and the phase's deload weeks. Series edits recompute only
// "open" instances: dated today or later, not linked to a recorded workout,
// and not individually edited (is_override).

// activityDateSQL is the calendar date of a scheduled activity: the Monday of
// its week's start_date plus the day's Monday-based offset (see DowOffset).
func activityDateSQL(weekAlias, dayExpr string) string {
	return weekAlias + ".start_date - (EXTRACT(ISODOW FROM " + weekAlias + ".start_date)::int - 1) + ((" + dayExpr + " + 6) % 7)"
}

// notPastSQL restricts scheduled_activities to rows whose week's `dayExpr`
// falls today or later.
func notPastSQL(dayExpr string) string {
	return `(SELECT ` + activityDateSQL("wf", dayExpr) +
		` FROM weeks wf WHERE wf.id = scheduled_activities.week_id) >= CURRENT_DATE`
}

// unrecordedSQL restricts scheduled_activities to rows without a linked workout.
const unrecordedSQL = `NOT EXISTS (SELECT 1 FROM workouts wo WHERE wo.scheduled_activity_id = scheduled_activities.id)`

// openInstanceSQL restricts scheduled_activities to dated-today-or-later
// activities without a linked workout.
var openInstanceSQL = notPastSQL("scheduled_activities.day_of_week") + " AND " + unrecordedSQL

// querier is satisfied by both pgx.Tx and *pgxpool.Pool.
type querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type activitySeries struct {
	ID           string
	PhaseID      string
	DayOfWeek    int
	ActivityType string
	Prescription json.RawMessage
	Notes        *string
	OrderIndex   int
	Progression  []models.ProgressionRule
	BaseWeek     int
	Load         models.PhaseLoad
}

// prescriptionAt is the series' prescription for a phase week, deload included.
func (s *activitySeries) prescriptionAt(week int) json.RawMessage {
	return models.MaterializePrescription(s.ActivityType, s.Prescription, s.Progression, week, s.BaseWeek, s.Load)
}

// args are the activity_series column values shared by insert and update.
func (s *activitySeries) args() (prescription json.RawMessage, progression []byte, err error) {
	rules := s.Progression
	if rules == nil {
		rules = []models.ProgressionRule{}
	}
	progression, err = json.Marshal(rules)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal progression: %w", err)
	}
	return emptyObjectIfNil(s.Prescription), progression, nil
}

const insertSeriesSQL = `INSERT INTO activity_series (phase_id, day_of_week, activity_type, prescription, notes, order_index, progression, base_week)
	VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(MAX(order_index) + 1, 0) FROM activity_series WHERE phase_id = $1 AND day_of_week = $2)), $7, $8)
	RETURNING id`

// queueInsertSeries queues the series insert; orderIndex nil appends after the
// day's existing series.
func queueInsertSeries(b *pgx.Batch, s *activitySeries, orderIndex *int) error {
	prescription, progression, err := s.args()
	if err != nil {
		return err
	}
	b.Queue(insertSeriesSQL, s.PhaseID, s.DayOfWeek, s.ActivityType, prescription, s.Notes, orderIndex, progression, s.BaseWeek)
	return nil
}

func updateSeries(ctx context.Context, tx pgx.Tx, s *activitySeries) error {
	prescription, progression, err := s.args()
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx,
		`UPDATE activity_series SET activity_type = $2, prescription = $3, notes = $4, progression = $5, base_week = $6, updated_at = NOW()
		 WHERE id = $1`,
		s.ID, s.ActivityType, prescription, s.Notes, progression, s.BaseWeek)
	return err
}

// newActivity is a scheduled activity to insert. OrderIndex nil appends it
// after the day's existing activities.
type newActivity struct {
	WeekID       string
	SeriesID     *string
	Day          int
	ActivityType string
	Prescription json.RawMessage
	Notes        *string
	OrderIndex   *int
}

const insertActivitySQL = `INSERT INTO scheduled_activities (week_id, series_id, day_of_week, activity_type, prescription, notes, order_index)
	VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, (SELECT COALESCE(MAX(order_index) + 1, 0) FROM scheduled_activities WHERE week_id = $1 AND day_of_week = $3)))
	RETURNING id`

func (a newActivity) args() []any {
	return []any{a.WeekID, a.SeriesID, a.Day, a.ActivityType, emptyObjectIfNil(a.Prescription), a.Notes, a.OrderIndex}
}

// insertScheduledActivity inserts one activity and returns its ID.
func insertScheduledActivity(ctx context.Context, q querier, a newActivity) (string, error) {
	var id string
	err := q.QueryRow(ctx, insertActivitySQL, a.args()...).Scan(&id)
	return id, err
}

// sendBatchIDs runs a batch of `RETURNING id` statements and returns the IDs
// in queue order.
func sendBatchIDs(ctx context.Context, tx pgx.Tx, b *pgx.Batch) ([]string, error) {
	br := tx.SendBatch(ctx, b)
	ids := make([]string, b.Len())
	for i := range ids {
		if err := br.QueryRow().Scan(&ids[i]); err != nil {
			_ = br.Close()
			return nil, err
		}
	}
	return ids, br.Close()
}

// matchSeries returns the program's series on a day, optionally limited to
// one phase (by order_index) and one activity type.
func matchSeries(ctx context.Context, q querier, programID string, phaseIndex *int, day int, typeFilter string) ([]*activitySeries, error) {
	rows, err := q.Query(ctx,
		`SELECT s.id, s.phase_id, s.day_of_week, s.activity_type, s.prescription, s.notes, s.order_index,
		        s.progression, s.base_week, ph.deload_weeks, ph.deload_pct
		 FROM activity_series s
		 JOIN phases ph ON ph.id = s.phase_id
		 WHERE ph.program_id = $1 AND s.day_of_week = $2
		   AND ($3::int IS NULL OR ph.order_index = $3)
		   AND ($4 = '' OR s.activity_type = $4)
		 ORDER BY ph.order_index, s.order_index`,
		programID, day, phaseIndex, typeFilter)
	if err != nil {
		return nil, fmt.Errorf("match series: %w", err)
	}
	defer rows.Close()

	var out []*activitySeries
	for rows.Next() {
		var s activitySeries
		var progression []byte
		if err := rows.Scan(&s.ID, &s.PhaseID, &s.DayOfWeek, &s.ActivityType, &s.Prescription, &s.Notes, &s.OrderIndex,
			&progression, &s.BaseWeek, &s.Load.DeloadWeeks, &s.Load.DeloadPct); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(progression, &s.Progression); err != nil {
			return nil, fmt.Errorf("unmarshal progression: %w", err)
		}
		out = append(out, &s)
	}
	return out, rows.Err()
}

// phaseWeek is a week of a phase with its 1-based index within the phase.
type phaseWeek struct {
	ID    string
	Index int
}

// openWeeksForDay returns the phase's weeks whose `day` is today or later.
func openWeeksForDay(ctx context.Context, q querier, phaseID string, day int) ([]phaseWeek, error) {
	rows, err := q.Query(ctx,
		`SELECT id, idx FROM (
		   SELECT w.id, w.start_date, ROW_NUMBER() OVER (ORDER BY w.week_number)::int AS idx
		   FROM weeks w WHERE w.phase_id = $1
		 ) w WHERE `+activityDateSQL("w", "$2::int")+` >= CURRENT_DATE
		 ORDER BY idx`,
		phaseID, day)
	if err != nil {
		return nil, fmt.Errorf("open weeks: %w", err)
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[phaseWeek])
}

// rematerializeSeries rewrites the series' open, non-overridden instances from
// its current definition in one statement. Returns the number of instances
// updated.
func rematerializeSeries(ctx context.Context, tx pgx.Tx, s *activitySeries) (int, error) {
	rows, err := tx.Query(ctx,
		`SELECT scheduled_activities.id, wk.idx
		 FROM scheduled_activities
		 JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY week_number)::int AS idx FROM weeks WHERE phase_id = $2) wk
		   ON wk.id = scheduled_activities.week_id
		 WHERE scheduled_activities.series_id = $1 AND NOT scheduled_activities.is_override AND `+openInstanceSQL,
		s.ID, s.PhaseID)
	if err != nil {
		return 0, fmt.Errorf("load series instances: %w", err)
	}
	instances, err := pgx.CollectRows(rows, pgx.RowToStructByPos[phaseWeek])
	if err != nil {
		return 0, fmt.Errorf("load series instances: %w", err)
	}
	if len(instances) == 0 {
		return 0, nil
	}

	ids := make([]string, len(instances))
	prescriptions := make([]string, len(instances))
	for i, in := range instances {
		ids[i] = in.ID
		prescriptions[i] = string(s.prescriptionAt(in.Index))
	}
	tag, err := tx.Exec(ctx,
		`UPDATE scheduled_activities sa
		 SET activity_type = $3, prescription = v.rx::jsonb, notes = $4, updated_at = NOW()
		 FROM unnest($1::text[], $2::text[]) AS v(id, rx)
		 WHERE sa.id = v.id::uuid`,
		ids, prescriptions, s.ActivityType, s.Notes)
	if err != nil {
		return 0, fmt.Errorf("rematerialize series %s: %w", s.ID, err)
	}
	return int(tag.RowsAffected()), nil
}

// rebaseToNextOpenWeek moves the series' base week to its first open week,
// carrying the progression level reached so far into the new base
// prescription. Returns false when the series has no open week left.
func rebaseToNextOpenWeek(ctx context.Context, q querier, s *activitySeries) (bool, error) {
	weeks, err := openWeeksForDay(ctx, q, s.PhaseID, s.DayOfWeek)
	if err != nil || len(weeks) == 0 {
		return false, err
	}
	next := weeks[0].Index
	s.Prescription = models.ProgressedPrescription(s.ActivityType, s.Prescription, s.Progression, next, s.BaseWeek, s.Load)
	s.BaseWeek = next
	return true, nil
}

// applyUpdateSeries handles update_activity across weeks: it edits each
// matching series and recomputes its open instances. A new prescription is the
// value for the next upcoming week; progression continues from there.
func applyUpdateSeries(ctx context.Context, tx pgx.Tx, programID string, edit models.ProgramEdit) (int, error) {
	series, err := matchSeries(ctx, tx, programID, edit.PhaseIndex, *edit.DayOfWeek, edit.ActivityTypeFilter)
	if err != nil {
		return 0, err
	}
	if len(series) == 0 {
		return 0, fmt.Errorf("no recurring activity on day %d matches the edit", *edit.DayOfWeek)
	}

	total := 0
	for _, s := range series {
		if edit.Prescription != nil || edit.Progression != nil {
			open, err := rebaseToNextOpenWeek(ctx, tx, s)
			if err != nil {
				return 0, err
			}
			if !open {
				continue // phase already over — nothing upcoming to change
			}
		}
		if edit.ActivityType != "" {
			s.ActivityType = edit.ActivityType
		}
		if edit.Notes != nil {
			s.Notes = edit.Notes
		}
		if edit.Prescription != nil {
			s.Prescription = edit.Prescription
		}
		if edit.Progression != nil {
			s.Progression = *edit.Progression
		}
		if err := models.ValidatePrescription(s.ActivityType, s.Prescription); err != nil {
			return 0, err
		}
		if err := models.ValidateProgression(s.Progression, s.Prescription); err != nil {
			return 0, err
		}
		if err := updateSeries(ctx, tx, s); err != nil {
			return 0, fmt.Errorf("update series: %w", err)
		}
		n, err := rematerializeSeries(ctx, tx, s)
		if err != nil {
			return 0, err
		}
		total += n
	}
	return total, nil
}

// applyAddSeries handles add_activity across weeks: one new series per phase,
// materialized into the phase's open weeks.
func applyAddSeries(ctx context.Context, tx pgx.Tx, programID string, edit models.ProgramEdit) (int, error) {
	if err := models.ValidatePrescription(edit.ActivityType, edit.Prescription); err != nil {
		return 0, err
	}
	var progression []models.ProgressionRule
	if edit.Progression != nil {
		progression = *edit.Progression
	}
	if err := models.ValidateProgression(progression, edit.Prescription); err != nil {
		return 0, err
	}

	rows, err := tx.Query(ctx,
		`SELECT id, deload_weeks, deload_pct FROM phases
		 WHERE program_id = $1 AND ($2::int IS NULL OR order_index = $2)
		 ORDER BY order_index`,
		programID, edit.PhaseIndex)
	if err != nil {
		return 0, fmt.Errorf("add_activity phases: %w", err)
	}
	type phaseRow struct {
		ID   string
		Load models.PhaseLoad
	}
	phases, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (phaseRow, error) {
		var p phaseRow
		err := row.Scan(&p.ID, &p.Load.DeloadWeeks, &p.Load.DeloadPct)
		return p, err
	})
	if err != nil {
		return 0, fmt.Errorf("add_activity phases: %w", err)
	}

	count := 0
	for _, ph := range phases {
		weeks, err := openWeeksForDay(ctx, tx, ph.ID, *edit.DayOfWeek)
		if err != nil {
			return 0, err
		}
		if len(weeks) == 0 {
			continue
		}
		s := &activitySeries{
			PhaseID:      ph.ID,
			DayOfWeek:    *edit.DayOfWeek,
			ActivityType: edit.ActivityType,
			Prescription: edit.Prescription,
			Notes:        edit.Notes,
			Progression:  progression,
			BaseWeek:     weeks[0].Index,
			Load:         ph.Load,
		}
		seriesBatch := &pgx.Batch{}
		if err := queueInsertSeries(seriesBatch, s, nil); err != nil {
			return 0, err
		}
		ids, err := sendBatchIDs(ctx, tx, seriesBatch)
		if err != nil {
			return 0, fmt.Errorf("insert series: %w", err)
		}
		s.ID = ids[0]

		instances := &pgx.Batch{}
		for _, w := range weeks {
			instances.Queue(insertActivitySQL, newActivity{
				WeekID: w.ID, SeriesID: &s.ID, Day: s.DayOfWeek, ActivityType: s.ActivityType,
				Prescription: s.prescriptionAt(w.Index), Notes: s.Notes,
			}.args()...)
		}
		if _, err := sendBatchIDs(ctx, tx, instances); err != nil {
			return 0, fmt.Errorf("add_activity insert: %w", err)
		}
		count += len(weeks)
	}
	return count, nil
}

// sampleSeriesByDay snapshots the first matching series as it stands for its
// next open week — the baseline a series edit is compared against.
func (s *ProgramService) sampleSeriesByDay(ctx context.Context, programID string, day int, phaseIndex *int, typeFilter string) *models.ActivitySnapshot {
	series, err := matchSeries(ctx, s.pool, programID, phaseIndex, day, typeFilter)
	if err != nil {
		return nil
	}
	for _, sr := range series {
		if open, err := rebaseToNextOpenWeek(ctx, s.pool, sr); err == nil && open {
			return &models.ActivitySnapshot{
				ActivityType: sr.ActivityType,
				Prescription: sr.Prescription,
				Notes:        sr.Notes,
				Progression:  sr.Progression,
			}
		}
	}
	return nil
}

func emptyObjectIfNil(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}

// insertTemplatePhases stores a template program's phases: each template
// activity becomes a series, and every week gets its materialized instances.
// Each phase takes four round trips: phase, series, weeks, activities.
func insertTemplatePhases(ctx context.Context, tx pgx.Tx, programID string, program models.TemplateProgramInput) error {
	starts := program.PhaseStartDates()
	weekNumber := 1
	for i, phase := range program.Phases {
		phaseStart := starts[i]
		var phaseEnd *time.Time
		if t := models.ParseDate(phase.EndDate); !t.IsZero() {
			phaseEnd = &t
		}

		var phaseID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO phases (program_id, name, order_index, start_date, end_date, deload_weeks, deload_pct)
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			programID, phase.Name, phase.OrderIndex, phaseStart, phaseEnd, phase.DeloadWeeks, phase.DeloadPct,
		).Scan(&phaseID); err != nil {
			return fmt.Errorf("insert phase %s: %w", phase.Name, err)
		}

		series := make([]*activitySeries, len(phase.TemplateWeek.Activities))
		seriesBatch := &pgx.Batch{}
		for j, act := range phase.TemplateWeek.Activities {
			series[j] = &activitySeries{
				PhaseID:      phaseID,
				DayOfWeek:    act.DayOfWeek,
				ActivityType: act.ActivityType,
				Prescription: act.Prescription,
				Notes:        nilIfEmpty(act.Notes),
				OrderIndex:   act.OrderIndex,
				Progression:  act.Progression,
				BaseWeek:     1,
				Load:         phase.PhaseLoad,
			}
			if err := queueInsertSeries(seriesBatch, series[j], &series[j].OrderIndex); err != nil {
				return err
			}
		}
		seriesIDs, err := sendBatchIDs(ctx, tx, seriesBatch)
		if err != nil {
			return fmt.Errorf("insert series: %w", err)
		}
		for j, id := range seriesIDs {
			series[j].ID = id
		}

		weeksBatch := &pgx.Batch{}
		for w := 0; w < phase.DurationWeeks; w++ {
			weeksBatch.Queue(`INSERT INTO weeks (phase_id, week_number, start_date) VALUES ($1, $2, $3) RETURNING id`,
				phaseID, weekNumber+w, phaseStart.AddDate(0, 0, w*7))
		}
		weekIDs, err := sendBatchIDs(ctx, tx, weeksBatch)
		if err != nil {
			return fmt.Errorf("insert weeks: %w", err)
		}
		weekNumber += phase.DurationWeeks

		activities := &pgx.Batch{}
		for w, weekID := range weekIDs {
			for _, sr := range series {
				activities.Queue(insertActivitySQL, newActivity{
					WeekID: weekID, SeriesID: &sr.ID, Day: sr.DayOfWeek, ActivityType: sr.ActivityType,
					Prescription: sr.prescriptionAt(w + 1), Notes: sr.Notes, OrderIndex: &sr.OrderIndex,
				}.args()...)
			}
		}
		if _, err := sendBatchIDs(ctx, tx, activities); err != nil {
			return fmt.Errorf("insert activities: %w", err)
		}
	}
	return nil
}

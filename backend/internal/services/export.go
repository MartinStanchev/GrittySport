// Package services — user data export (GDPR Art. 15 right of access + Art. 20
// portability). Returns every user-scoped row joined into a single JSON
// document. Operational metadata that the user never produced (hashed refresh
// tokens, OTP codes, AI memory facts marked inactive by automated decay) is
// excluded — those are processor-side artefacts, not personal data the user
// contributed.
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ExportService struct {
	pool *pgxpool.Pool
}

func NewExportService(pool *pgxpool.Pool) *ExportService {
	return &ExportService{pool: pool}
}

// ExportPayload is the shape returned to the client. Each section is a list of
// rows from one source table (or a query joining a couple). Empty sections are
// retained so the response shape is predictable.
type ExportPayload struct {
	GeneratedAt            string                   `json:"generated_at"`
	SchemaVersion          int                      `json:"schema_version"`
	User                   map[string]any           `json:"user"`
	Consents               []map[string]any         `json:"consents"`
	Programs               []map[string]any         `json:"programs"`
	Phases                 []map[string]any         `json:"phases"`
	Weeks                  []map[string]any         `json:"weeks"`
	ScheduledActivities    []map[string]any         `json:"scheduled_activities"`
	ProgramCriteria        []map[string]any         `json:"program_criteria"`
	Workouts               []map[string]any         `json:"workouts"`
	ChatMessages           []map[string]any         `json:"chat_messages"`
	ChatSegments           []map[string]any         `json:"chat_segments"`
	ChatFacts              []map[string]any         `json:"chat_facts"`
	NotificationPreferences []map[string]any        `json:"notification_preferences"`
	UsageTracking          []map[string]any         `json:"usage_tracking"`
}

func (s *ExportService) Export(ctx context.Context, userID string) (*ExportPayload, error) {
	user, err := s.queryOne(ctx, `SELECT id, email, name, timezone, units_preference, max_heart_rate,
	                                     weekly_effort_goal, birth_year, height_cm, weight_kg,
	                                     profile_completed, consents_completed_at, subscription_tier,
	                                     subscription_started_at, subscription_expires_at,
	                                     created_at, updated_at
	                              FROM users WHERE id = $1`, userID)
	if err != nil {
		return nil, fmt.Errorf("user: %w", err)
	}

	sections := []struct {
		name string
		dest *[]map[string]any
		sql  string
	}{
		{"consents", new([]map[string]any),
			`SELECT consent_type, version, accepted_at, withdrawn_at, ip_address::text, user_agent
			 FROM user_consents WHERE user_id = $1 ORDER BY accepted_at`},
		{"programs", new([]map[string]any),
			`SELECT id, name, sport, goal_description, status, start_date, end_date,
			        created_by, created_at, updated_at
			 FROM programs WHERE user_id = $1 ORDER BY created_at`},
		{"phases", new([]map[string]any),
			`SELECT ph.id, ph.program_id, ph.order_index, ph.name, ph.start_date, ph.end_date, ph.created_at
			 FROM phases ph JOIN programs p ON p.id = ph.program_id
			 WHERE p.user_id = $1 ORDER BY ph.program_id, ph.order_index`},
		{"weeks", new([]map[string]any),
			`SELECT w.id, w.phase_id, w.week_number, w.start_date, w.created_at
			 FROM weeks w
			 JOIN phases ph ON ph.id = w.phase_id
			 JOIN programs p ON p.id = ph.program_id
			 WHERE p.user_id = $1 ORDER BY ph.program_id, w.week_number`},
		{"scheduled_activities", new([]map[string]any),
			`SELECT sa.id, sa.week_id, sa.day_of_week, sa.activity_type, sa.notes,
			        sa.prescription, sa.order_index, sa.created_at, sa.updated_at
			 FROM scheduled_activities sa
			 JOIN weeks w ON w.id = sa.week_id
			 JOIN phases ph ON ph.id = w.phase_id
			 JOIN programs p ON p.id = ph.program_id
			 WHERE p.user_id = $1 ORDER BY sa.created_at`},
		{"program_criteria", new([]map[string]any),
			`SELECT pc.* FROM program_criteria pc
			 JOIN programs p ON p.id = pc.program_id
			 WHERE p.user_id = $1`},
		{"workouts", new([]map[string]any),
			`SELECT id, scheduled_activity_id, activity_type, source, started_at, finished_at,
			        recorded_data, gps_route, heart_rate_data, notes, created_at, updated_at
			 FROM workouts WHERE user_id = $1 ORDER BY started_at`},
		{"chat_messages", new([]map[string]any),
			`SELECT id, role, content, program_id, metadata, created_at
			 FROM chat_messages WHERE user_id = $1 ORDER BY created_at`},
		{"chat_segments", new([]map[string]any),
			`SELECT id, segment_type, status, summary, started_at, completed_at
			 FROM chat_segments WHERE user_id = $1 ORDER BY started_at`},
		{"chat_facts", new([]map[string]any),
			`SELECT fact_type, content, active, created_at, updated_at
			 FROM chat_facts WHERE user_id = $1 ORDER BY created_at`},
		{"notification_preferences", new([]map[string]any),
			`SELECT notif_type, enabled, updated_at
			 FROM notification_preferences WHERE user_id = $1`},
		{"usage_tracking", new([]map[string]any),
			`SELECT period_type, period_start, chat_messages_used, programs_created,
			        post_workout_reviews_used, missed_workout_reviews_used, created_at, updated_at
			 FROM usage_tracking WHERE user_id = $1 ORDER BY period_start`},
	}

	for _, sec := range sections {
		rows, err := s.queryMany(ctx, sec.sql, userID)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", sec.name, err)
		}
		*sec.dest = rows
	}

	return &ExportPayload{
		GeneratedAt:             nowISO(),
		SchemaVersion:           1,
		User:                    user,
		Consents:                *sections[0].dest,
		Programs:                *sections[1].dest,
		Phases:                  *sections[2].dest,
		Weeks:                   *sections[3].dest,
		ScheduledActivities:     *sections[4].dest,
		ProgramCriteria:         *sections[5].dest,
		Workouts:                *sections[6].dest,
		ChatMessages:            *sections[7].dest,
		ChatSegments:            *sections[8].dest,
		ChatFacts:               *sections[9].dest,
		NotificationPreferences: *sections[10].dest,
		UsageTracking:           *sections[11].dest,
	}, nil
}

func (s *ExportService) queryOne(ctx context.Context, sql string, args ...any) (map[string]any, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectOneRow(rows, pgx.RowToMap)
}

func (s *ExportService) queryMany(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, pgx.RowToMap)
	if err != nil {
		return nil, err
	}
	if out == nil {
		return []map[string]any{}, nil
	}
	return out, nil
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

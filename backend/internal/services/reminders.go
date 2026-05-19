package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Reminder is a single user-scheduled reminder. `Content` is the LLM-authored
// string that gets used verbatim as both the push body and the chat message —
// no LLM call on the delivery path. We never read `delivered` after Scan
// because every query already filters `delivered = false`, so it's omitted.
type Reminder struct {
	ID        string    `json:"id"`
	UserID    string    `json:"-"`
	Content   string    `json:"content"`
	RemindAt  time.Time `json:"remind_at"`
	CreatedAt time.Time `json:"created_at"`
}

type ReminderService struct {
	pool *pgxpool.Pool
}

func NewReminderService(pool *pgxpool.Pool) *ReminderService {
	return &ReminderService{pool: pool}
}

// Create inserts a new reminder. The caller is expected to have already
// validated that remindAt is in the future and that content is non-empty.
func (s *ReminderService) Create(ctx context.Context, userID, content string, remindAt time.Time) (*Reminder, error) {
	var r Reminder
	err := s.pool.QueryRow(ctx,
		`INSERT INTO user_reminders (user_id, content, remind_at)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, content, remind_at, created_at`,
		userID, content, remindAt.UTC(),
	).Scan(&r.ID, &r.UserID, &r.Content, &r.RemindAt, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert reminder: %w", err)
	}
	return &r, nil
}

// ListActive returns the user's undelivered reminders ordered by next-fire.
func (s *ReminderService) ListActive(ctx context.Context, userID string) ([]Reminder, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, content, remind_at, created_at
		 FROM user_reminders
		 WHERE user_id = $1 AND delivered = false
		 ORDER BY remind_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list reminders: %w", err)
	}
	defer rows.Close()

	var out []Reminder
	for rows.Next() {
		var r Reminder
		if err := rows.Scan(&r.ID, &r.UserID, &r.Content, &r.RemindAt, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan reminder: %w", err)
		}
		out = append(out, r)
	}
	return out, nil
}

// Cancel deletes an undelivered reminder belonging to userID. Returns (true,
// nil) on success, (false, nil) if no row matched (already delivered, wrong
// user, or doesn't exist — all collapse to "not_found" for the LLM).
func (s *ReminderService) Cancel(ctx context.Context, userID, reminderID string) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM user_reminders
		 WHERE id = $1 AND user_id = $2 AND delivered = false`,
		reminderID, userID,
	)
	if err != nil {
		return false, fmt.Errorf("delete reminder: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// ListDue returns every pending reminder whose remind_at has passed. The
// scheduler calls this on each tick; the partial index makes it cheap even
// with many delivered rows in the table.
func (s *ReminderService) ListDue(ctx context.Context, now time.Time) ([]Reminder, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, content, remind_at, created_at
		 FROM user_reminders
		 WHERE delivered = false AND remind_at <= $1
		 ORDER BY remind_at ASC
		 LIMIT 500`,
		now.UTC(),
	)
	if err != nil {
		return nil, fmt.Errorf("list due reminders: %w", err)
	}
	defer rows.Close()

	var out []Reminder
	for rows.Next() {
		var r Reminder
		if err := rows.Scan(&r.ID, &r.UserID, &r.Content, &r.RemindAt, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan due reminder: %w", err)
		}
		out = append(out, r)
	}
	return out, nil
}

// MarkDelivered flips the delivered flag after a successful chat-message save.
// We keep the row so users can audit past reminders via export; the partial
// index drops it from the pending working set.
func (s *ReminderService) MarkDelivered(ctx context.Context, reminderID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE user_reminders SET delivered = true WHERE id = $1`,
		reminderID,
	)
	if err != nil {
		return fmt.Errorf("mark delivered: %w", err)
	}
	return nil
}

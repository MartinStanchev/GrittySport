package review

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/notifications"
)

// ReminderScheduler sends morning workout reminders to users with scheduled activities.
// Available to all users (free and premium).
type ReminderScheduler struct {
	pool         *pgxpool.Pool
	notifService *notifications.Service
}

// NewReminderScheduler creates a new reminder scheduler.
func NewReminderScheduler(pool *pgxpool.Pool, notifService *notifications.Service) *ReminderScheduler {
	return &ReminderScheduler{pool: pool, notifService: notifService}
}

// Run starts the hourly check loop. Blocks until context is cancelled.
func (s *ReminderScheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Info().Msg("Workout reminder scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Workout reminder scheduler stopped")
			return
		case <-ticker.C:
			s.check(ctx)
		}
	}
}

func (s *ReminderScheduler) check(ctx context.Context) {
	// Find users with active programs and a timezone set
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT u.id, u.timezone
		 FROM users u
		 JOIN programs p ON p.user_id = u.id AND p.status = 'active'
		 WHERE u.timezone IS NOT NULL`,
	)
	if err != nil {
		log.Error().Err(err).Msg("Reminder scheduler: failed to query users")
		return
	}
	defer rows.Close()

	now := time.Now().UTC()
	var sent int

	for rows.Next() {
		var userID, tz string
		if err := rows.Scan(&userID, &tz); err != nil {
			continue
		}

		loc, err := time.LoadLocation(tz)
		if err != nil {
			continue
		}

		localNow := now.In(loc)
		// Send reminders between 7-9 AM local time
		if localNow.Hour() < 7 || localNow.Hour() >= 9 {
			continue
		}

		if s.sendReminder(ctx, userID, localNow) {
			sent++
		}
	}

	if sent > 0 {
		log.Debug().Int("reminders_sent", sent).Msg("Reminder scheduler: cycle complete")
	}
}

func (s *ReminderScheduler) sendReminder(ctx context.Context, userID string, localNow time.Time) bool {
	today := localNow.Format("2006-01-02")
	// Convert Go's Sunday=0 to ISO Monday=1..Sunday=7
	dayOfWeek := int(localNow.Weekday())
	if dayOfWeek == 0 {
		dayOfWeek = 7
	}

	// Find scheduled activities for today that haven't had a reminder sent
	var activityType string
	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT sa.activity_type, COUNT(*) OVER() AS total
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE p.user_id = $1
		   AND p.status = 'active'
		   AND sa.day_of_week = $2
		   AND (sa.reminder_sent_date IS NULL OR sa.reminder_sent_date < $3::date)
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date <= $3::date
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date + 6 >= $3::date
		 LIMIT 1`,
		userID, dayOfWeek, today,
	).Scan(&activityType, &count)
	if err != nil {
		return false // no activities today or already reminded
	}

	label := notifications.FormatActivityLabel(activityType)
	var title, body string
	if count > 1 {
		title = fmt.Sprintf("%d workouts today", count)
		body = fmt.Sprintf("Starting with %s — let's get after it.", label)
	} else {
		title = label + " today"
		body = "On the plan for today — tap to see the details."
	}

	err = s.notifService.SendToUser(ctx, userID, "workout_reminder", notifications.Payload{
		Title: title,
		Body:  body,
	})
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to send workout reminder")
		return false
	}

	// Mark all today's activities as reminded
	_, _ = s.pool.Exec(ctx,
		`UPDATE scheduled_activities sa
		 SET reminder_sent_date = $3::date
		 FROM weeks w
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE sa.week_id = w.id
		   AND p.user_id = $1
		   AND p.status = 'active'
		   AND sa.day_of_week = $2
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date <= $3::date
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date + 6 >= $3::date`,
		userID, dayOfWeek, today,
	)

	return true
}

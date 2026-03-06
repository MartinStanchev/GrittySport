package review

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/usage"
)

// MissedWorkoutChecker runs periodically to detect missed workouts and trigger reviews.
type MissedWorkoutChecker struct {
	pool      *pgxpool.Pool
	reviewSvc *Service
	usageSvc  *usage.Service
}

// NewMissedWorkoutChecker creates a new checker.
func NewMissedWorkoutChecker(pool *pgxpool.Pool, reviewSvc *Service, usageSvc *usage.Service) *MissedWorkoutChecker {
	return &MissedWorkoutChecker{
		pool:      pool,
		reviewSvc: reviewSvc,
		usageSvc:  usageSvc,
	}
}

// Run starts the hourly check loop. Blocks until context is cancelled.
func (c *MissedWorkoutChecker) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Info().Msg("Missed workout checker started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Missed workout checker stopped")
			return
		case <-ticker.C:
			c.check(ctx)
		}
	}
}

func (c *MissedWorkoutChecker) check(ctx context.Context) {
	// Find all users with active programs and a timezone set
	rows, err := c.pool.Query(ctx,
		`SELECT DISTINCT u.id, u.timezone
		 FROM users u
		 JOIN programs p ON p.user_id = u.id AND p.status = 'active'
		 WHERE u.timezone IS NOT NULL`,
	)
	if err != nil {
		log.Error().Err(err).Msg("Missed workout checker: failed to query users")
		return
	}
	defer rows.Close()

	now := time.Now().UTC()
	var checked int

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
		if localNow.Hour() < 21 {
			continue
		}

		c.checkUser(ctx, userID, localNow)
		checked++
	}

	if checked > 0 {
		log.Debug().Int("users_checked", checked).Msg("Missed workout checker: cycle complete")
	}
}

func (c *MissedWorkoutChecker) checkUser(ctx context.Context, userID string, localNow time.Time) {
	// Find today's date in user timezone
	today := localNow.Format("2006-01-02")
	dayOfWeek := int(localNow.Weekday())
	if dayOfWeek == 0 {
		dayOfWeek = 7 // Sunday = 7
	}

	// Find scheduled activities for today that have no linked workout and no review sent
	rows, err := c.pool.Query(ctx,
		`SELECT sa.id
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases ph ON ph.id = w.phase_id
		 JOIN programs p ON p.id = ph.program_id
		 WHERE p.user_id = $1
		   AND p.status = 'active'
		   AND sa.day_of_week = $2
		   AND sa.missed_review_sent = false
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date <= $3::date
		   AND COALESCE(w.start_date, p.start_date + ((w.week_number-1)*7 || ' days')::interval)::date + 6 >= $3::date
		   AND NOT EXISTS (
		     SELECT 1 FROM workouts wo
		     WHERE wo.scheduled_activity_id = sa.id
		   )`,
		userID, dayOfWeek, today,
	)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to query missed activities")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var activityID string
		if err := rows.Scan(&activityID); err != nil {
			continue
		}

		// Check usage — free users get 3 missed workout reviews per month
		allowed, _, _ := c.usageSvc.CheckAndIncrement(ctx, userID, "missed_workout_review")
		if !allowed {
			log.Debug().Str("user_id", userID).Msg("Missed workout review skipped: free tier limit reached")
			return // stop processing further activities for this user
		}

		if err := c.reviewSvc.TriggerMissedReview(ctx, userID, activityID); err != nil {
			log.Error().Err(err).
				Str("user_id", userID).
				Str("activity_id", activityID).
				Msg("Failed to trigger missed review")
		}
	}
}

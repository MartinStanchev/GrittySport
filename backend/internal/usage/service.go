package usage

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/models"
)

const (
	TierPremium = "premium"
	TierFree    = "free"

	FreeChatMessagesPerWeek            = 50
	FreeProgramCreationsPerMonth       = 2
	FreePostWorkoutReviewsPerMonth     = 3
	FreeMissedWorkoutReviewsPerMonth   = 3
	FreeProgramsTotal                  = 1
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// GetTier returns "free" or "premium". Expired premium is treated as free.
func (s *Service) GetTier(ctx context.Context, userID string) (string, error) {
	var tier string
	var expiresAt *time.Time
	err := s.pool.QueryRow(ctx,
		"SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1",
		userID,
	).Scan(&tier, &expiresAt)
	if err != nil {
		return "free", err
	}
	if tier == TierPremium && expiresAt != nil && time.Now().After(*expiresAt) {
		return TierFree, nil
	}
	return tier, nil
}

// CheckAndIncrement checks the usage limit for a resource and increments if allowed.
// Returns (allowed, remaining, error). Fails open on DB errors.
func (s *Service) CheckAndIncrement(ctx context.Context, userID, resource string) (bool, int, error) {
	tier, err := s.GetTier(ctx, userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get tier, failing open")
		return true, -1, nil
	}

	if tier == TierPremium {
		return true, -1, nil
	}

	var periodType string
	var limit int
	var column string

	switch resource {
	case "chat_message":
		periodType = "week"
		limit = FreeChatMessagesPerWeek
		column = "chat_messages_used"
	case "program_creation":
		periodType = "month"
		limit = FreeProgramCreationsPerMonth
		column = "programs_created"
	case "post_workout_review":
		periodType = "month"
		limit = FreePostWorkoutReviewsPerMonth
		column = "post_workout_reviews_used"
	case "missed_workout_review":
		periodType = "month"
		limit = FreeMissedWorkoutReviewsPerMonth
		column = "missed_workout_reviews_used"
	default:
		return true, -1, nil
	}

	periodStart := computePeriodStart(periodType)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin usage tx, failing open")
		return true, -1, nil
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Upsert the row and lock it
	_, err = tx.Exec(ctx,
		`INSERT INTO usage_tracking (user_id, period_type, period_start)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, period_type, period_start) DO NOTHING`,
		userID, periodType, periodStart,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upsert usage row, failing open")
		return true, -1, nil
	}

	var current int
	err = tx.QueryRow(ctx,
		`SELECT `+column+` FROM usage_tracking
		 WHERE user_id = $1 AND period_type = $2 AND period_start = $3
		 FOR UPDATE`,
		userID, periodType, periodStart,
	).Scan(&current)
	if err != nil {
		log.Error().Err(err).Msg("Failed to read usage count, failing open")
		return true, -1, nil
	}

	if current >= limit {
		_ = tx.Rollback(ctx)
		return false, 0, nil
	}

	_, err = tx.Exec(ctx,
		`UPDATE usage_tracking SET `+column+` = `+column+` + 1, updated_at = NOW()
		 WHERE user_id = $1 AND period_type = $2 AND period_start = $3`,
		userID, periodType, periodStart,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to increment usage, failing open")
		return true, -1, nil
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to commit usage tx, failing open")
		return true, -1, nil
	}

	return true, limit - current - 1, nil
}

// ResourceUsage represents usage stats for a single resource.
type ResourceUsage struct {
	Used     int    `json:"used"`
	Limit    int    `json:"limit"`
	Period   string `json:"period"`
	ResetsAt string `json:"resets_at"`
}

// ProgramUsage represents program count stats.
type ProgramUsage struct {
	CurrentCount int `json:"current_count"`
	Limit        int `json:"limit"`
}

// UsageSummary is the full usage response.
type UsageSummary struct {
	Tier                  string        `json:"tier"`
	ChatMessages          ResourceUsage `json:"chat_messages"`
	ProgramCreations      ResourceUsage `json:"program_creations"`
	PostWorkoutReviews    ResourceUsage `json:"post_workout_reviews"`
	MissedWorkoutReviews  ResourceUsage `json:"missed_workout_reviews"`
	Programs              ProgramUsage  `json:"programs"`
}

// GetUsage returns the current usage summary for a user.
func (s *Service) GetUsage(ctx context.Context, userID string) (*UsageSummary, error) {
	tier, err := s.GetTier(ctx, userID)
	if err != nil {
		return nil, err
	}

	weekStart := computePeriodStart("week")
	monthStart := computePeriodStart("month")

	var chatUsed, programsCreated, reviewsUsed, missedReviewsUsed int

	// Weekly usage
	_ = s.pool.QueryRow(ctx,
		`SELECT chat_messages_used FROM usage_tracking
		 WHERE user_id = $1 AND period_type = 'week' AND period_start = $2`,
		userID, weekStart,
	).Scan(&chatUsed)

	// Monthly usage
	_ = s.pool.QueryRow(ctx,
		`SELECT programs_created, post_workout_reviews_used, missed_workout_reviews_used FROM usage_tracking
		 WHERE user_id = $1 AND period_type = 'month' AND period_start = $2`,
		userID, monthStart,
	).Scan(&programsCreated, &reviewsUsed, &missedReviewsUsed)

	// Program count
	var programCount int
	_ = s.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM programs WHERE user_id = $1",
		userID,
	).Scan(&programCount)

	chatLimit := FreeChatMessagesPerWeek
	programCreationLimit := FreeProgramCreationsPerMonth
	reviewLimit := FreePostWorkoutReviewsPerMonth
	missedReviewLimit := FreeMissedWorkoutReviewsPerMonth
	programTotalLimit := FreeProgramsTotal
	if tier == TierPremium {
		chatLimit = -1
		programCreationLimit = -1
		reviewLimit = -1
		missedReviewLimit = -1
		programTotalLimit = -1
	}

	nextWeek := weekStart.AddDate(0, 0, 7)
	nextMonth := time.Date(monthStart.Year(), monthStart.Month()+1, 1, 0, 0, 0, 0, time.UTC)

	return &UsageSummary{
		Tier: tier,
		ChatMessages: ResourceUsage{
			Used:     chatUsed,
			Limit:    chatLimit,
			Period:   "week",
			ResetsAt: nextWeek.Format(time.RFC3339),
		},
		ProgramCreations: ResourceUsage{
			Used:     programsCreated,
			Limit:    programCreationLimit,
			Period:   "month",
			ResetsAt: nextMonth.Format(time.RFC3339),
		},
		PostWorkoutReviews: ResourceUsage{
			Used:     reviewsUsed,
			Limit:    reviewLimit,
			Period:   "month",
			ResetsAt: nextMonth.Format(time.RFC3339),
		},
		MissedWorkoutReviews: ResourceUsage{
			Used:     missedReviewsUsed,
			Limit:    missedReviewLimit,
			Period:   "month",
			ResetsAt: nextMonth.Format(time.RFC3339),
		},
		Programs: ProgramUsage{
			CurrentCount: programCount,
			Limit:        programTotalLimit,
		},
	}, nil
}

// CountUserPrograms returns the number of programs a user has.
func (s *Service) CountUserPrograms(ctx context.Context, userID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM programs WHERE user_id = $1",
		userID,
	).Scan(&count)
	return count, err
}

// CanCreateProgram checks if the user is allowed to create a new program.
// Returns (allowed, error). Free users are limited to FreeProgramsTotal programs.
func (s *Service) CanCreateProgram(ctx context.Context, userID string) (bool, error) {
	tier, err := s.GetTier(ctx, userID)
	if err != nil {
		// Fail open
		return true, nil
	}
	if tier == TierPremium {
		return true, nil
	}
	count, err := s.CountUserPrograms(ctx, userID)
	if err != nil {
		return true, nil
	}
	return count < FreeProgramsTotal, nil
}

// computePeriodStart returns the start of the current period.
// Weekly: Monday of the current week (reuses models.MondayOf). Monthly: 1st of the current month.
func computePeriodStart(periodType string) time.Time {
	now := time.Now().UTC()
	switch periodType {
	case "week":
		monday := models.MondayOf(now)
		return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC)
	case "month":
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	default:
		return now
	}
}

// WeekResetTime returns the next Monday at midnight UTC.
func WeekResetTime() time.Time {
	return computePeriodStart("week").AddDate(0, 0, 7)
}

package usage

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

const (
	TierPremium = "premium"
	TierFree    = "free"

	FreeChatMessagesPerMonth           = 60
	FreeProgramCreationsPerMonth       = 2
	FreePostWorkoutReviewsPerMonth     = 5
	FreeMissedWorkoutReviewsPerMonth   = 5
	FreeProgramsTotal                  = 1
	FreeDraftsTotal                    = 3
	FreeExplicitPreferencesTotal       = 5
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
// Returns (allowed, remaining, error). Fails closed: any DB error returns
// (false, 0, err) so the caller denies the paid resource rather than handing
// the user unlimited LLM calls during a database hiccup.
func (s *Service) CheckAndIncrement(ctx context.Context, userID, resource string) (bool, int, error) {
	tier, err := s.GetTier(ctx, userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("usage: tier lookup failed, denying")
		return false, 0, err
	}

	if tier == TierPremium {
		return true, -1, nil
	}

	var periodType string
	var limit int
	var column string

	switch resource {
	case "chat_message":
		periodType = "month"
		limit = FreeChatMessagesPerMonth
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

	periodStart := computePeriodStart()

	// Ensure the row exists. The check-and-increment below relies on a row
	// being present so the predicate WHERE count < limit can succeed.
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO usage_tracking (user_id, period_type, period_start)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, period_type, period_start) DO NOTHING`,
		userID, periodType, periodStart,
	); err != nil {
		log.Error().Err(err).Msg("usage: upsert row failed, denying")
		return false, 0, err
	}

	// Atomic check-then-increment: the predicate is evaluated under the row
	// lock acquired by UPDATE, so N parallel callers can't all read count<limit
	// and all increment past it. RETURNING gives us the post-increment count
	// to compute remaining without a second round-trip.
	var newCount int
	err = s.pool.QueryRow(ctx,
		`UPDATE usage_tracking
		 SET `+column+` = `+column+` + 1, updated_at = NOW()
		 WHERE user_id = $1 AND period_type = $2 AND period_start = $3 AND `+column+` < $4
		 RETURNING `+column,
		userID, periodType, periodStart, limit,
	).Scan(&newCount)
	if err != nil {
		// No rows updated — the cap was already reached. Distinguish from a
		// real DB error so callers can show the rate-limit UI instead of a
		// generic 500.
		if errors.Is(err, pgx.ErrNoRows) {
			return false, 0, nil
		}
		log.Error().Err(err).Msg("usage: increment failed, denying")
		return false, 0, err
	}

	return true, limit - newCount, nil
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

	monthStart := computePeriodStart()

	var chatUsed, programsCreated, reviewsUsed, missedReviewsUsed int

	_ = s.pool.QueryRow(ctx,
		`SELECT chat_messages_used, programs_created, post_workout_reviews_used, missed_workout_reviews_used
		 FROM usage_tracking
		 WHERE user_id = $1 AND period_type = 'month' AND period_start = $2`,
		userID, monthStart,
	).Scan(&chatUsed, &programsCreated, &reviewsUsed, &missedReviewsUsed)

	// Program count (active only, drafts don't count toward limit)
	programCount, _ := s.CountUserPrograms(ctx, userID)

	chatLimit := FreeChatMessagesPerMonth
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

	nextMonth := time.Date(monthStart.Year(), monthStart.Month()+1, 1, 0, 0, 0, 0, time.UTC)

	return &UsageSummary{
		Tier: tier,
		ChatMessages: ResourceUsage{
			Used:     chatUsed,
			Limit:    chatLimit,
			Period:   "month",
			ResetsAt: nextMonth.Format(time.RFC3339),
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

// CountUserPrograms returns the number of active programs a user has (excludes drafts).
func (s *Service) CountUserPrograms(ctx context.Context, userID string) (int, error) {
	return s.countProgramsByStatus(ctx, userID, "!=", "draft")
}

// CountUserDrafts returns the number of draft programs a user has.
func (s *Service) CountUserDrafts(ctx context.Context, userID string) (int, error) {
	return s.countProgramsByStatus(ctx, userID, "=", "draft")
}

func (s *Service) countProgramsByStatus(ctx context.Context, userID, op, status string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM programs WHERE user_id = $1 AND status "+op+" $2",
		userID, status,
	).Scan(&count)
	return count, err
}

// CanCreateProgram checks if the user is allowed to have another active program.
// Free users are limited to FreeProgramsTotal active programs. Fails closed on
// DB errors so callers don't accidentally grant unlimited paid resources.
func (s *Service) CanCreateProgram(ctx context.Context, userID string) (bool, error) {
	return s.canCreate(ctx, userID, s.CountUserPrograms, FreeProgramsTotal)
}

// CanCreateDraft checks if the user is allowed to create another draft program.
// Free users are limited to FreeDraftsTotal drafts. Fails closed on DB errors.
func (s *Service) CanCreateDraft(ctx context.Context, userID string) (bool, error) {
	return s.canCreate(ctx, userID, s.CountUserDrafts, FreeDraftsTotal)
}

func (s *Service) canCreate(ctx context.Context, userID string, count func(context.Context, string) (int, error), limit int) (bool, error) {
	tier, err := s.GetTier(ctx, userID)
	if err != nil {
		return false, err
	}
	if tier == TierPremium {
		return true, nil
	}
	n, err := count(ctx, userID)
	if err != nil {
		return false, err
	}
	return n < limit, nil
}

// computePeriodStart returns the 1st of the current month at midnight UTC.
func computePeriodStart() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// MonthResetTime returns the 1st of next month at midnight UTC.
func MonthResetTime() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
}

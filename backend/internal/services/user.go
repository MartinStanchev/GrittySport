package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

type UserService struct {
	pool *pgxpool.Pool
}

func NewUserService(pool *pgxpool.Pool) *UserService {
	return &UserService{pool: pool}
}

// HasCompletedConsents reports whether the user has finished the GDPR consent
// flow. Used by middleware to gate every authenticated route except consent
// management itself, so a freshly-verified account can't issue any data-bearing
// API calls before agreeing to terms/privacy/health-data/age-16.
func (s *UserService) HasCompletedConsents(ctx context.Context, userID string) (bool, error) {
	var completed *time.Time
	err := s.pool.QueryRow(ctx, `SELECT consents_completed_at FROM users WHERE id = $1`, userID).Scan(&completed)
	if err != nil {
		return false, err
	}
	return completed != nil, nil
}

func (s *UserService) GetByID(ctx context.Context, userID string) (*models.UserResponse, error) {
	var user models.UserResponse
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		        birth_year, height_cm, weight_kg, profile_completed, consents_completed_at,
		        subscription_tier, subscription_expires_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted, &user.ConsentsCompletedAt,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
}

func (s *UserService) Delete(ctx context.Context, userID string) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// email_otps is keyed by email (no FK to users) so the user's row deletion
	// won't cascade to it. Without this, a still-valid OTP issued seconds before
	// deletion can be redeemed by VerifyOTP, which then re-creates a fresh user
	// row for the same email — defeating GDPR Art. 17 erasure.
	var email string
	if err := tx.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&email); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pgx.ErrNoRows
		}
		return fmt.Errorf("lookup user email: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE user_consents SET ip_address = NULL, user_agent = NULL WHERE user_id = $1`,
		userID,
	); err != nil {
		return fmt.Errorf("anonymize consents: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM email_otps WHERE email = $1`, email); err != nil {
		return fmt.Errorf("purge otps: %w", err)
	}

	result, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return tx.Commit(ctx)
}

type UpdateUserInput struct {
	Name             *string  `json:"name"`
	Timezone         *string  `json:"timezone"`
	UnitsPreference  *string  `json:"units_preference"`
	MaxHeartRate     *int     `json:"max_heart_rate"`
	WeeklyEffortGoal *int    `json:"weekly_effort_goal"`
	BirthYear        *int     `json:"birth_year"`
	HeightCm         *float64 `json:"height_cm"`
	WeightKg         *float64 `json:"weight_kg"`
	ProfileCompleted *bool    `json:"profile_completed"`
}

func (s *UserService) Update(ctx context.Context, userID string, input UpdateUserInput) (*models.UserResponse, error) {
	var user models.UserResponse
	err := s.pool.QueryRow(ctx,
		`UPDATE users SET
			name = COALESCE($2, name),
			timezone = COALESCE($3, timezone),
			units_preference = COALESCE($4, units_preference),
			max_heart_rate = COALESCE($5, max_heart_rate),
			weekly_effort_goal = COALESCE($6, weekly_effort_goal),
			birth_year = COALESCE($7, birth_year),
			height_cm = COALESCE($8, height_cm),
			weight_kg = COALESCE($9, weight_kg),
			profile_completed = COALESCE($10, profile_completed),
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		           birth_year, height_cm, weight_kg, profile_completed, consents_completed_at,
		           subscription_tier, subscription_expires_at`,
		userID, input.Name, input.Timezone, input.UnitsPreference, input.MaxHeartRate, input.WeeklyEffortGoal,
		input.BirthYear, input.HeightCm, input.WeightKg, input.ProfileCompleted,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted, &user.ConsentsCompletedAt,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
}

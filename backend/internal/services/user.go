package services

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

type UserService struct {
	pool *pgxpool.Pool
}

func NewUserService(pool *pgxpool.Pool) *UserService {
	return &UserService{pool: pool}
}

func (s *UserService) GetByID(ctx context.Context, userID string) (*models.UserResponse, error) {
	var user models.UserResponse
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		        birth_year, height_cm, weight_kg, profile_completed,
		        subscription_tier, subscription_expires_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
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
		           birth_year, height_cm, weight_kg, profile_completed,
		           subscription_tier, subscription_expires_at`,
		userID, input.Name, input.Timezone, input.UnitsPreference, input.MaxHeartRate, input.WeeklyEffortGoal,
		input.BirthYear, input.HeightCm, input.WeightKg, input.ProfileCompleted,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
}

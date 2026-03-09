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
		"SELECT id, email, name, timezone, units_preference, max_heart_rate, subscription_tier, subscription_expires_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
}

type UpdateUserInput struct {
	Name            *string `json:"name"`
	Timezone        *string `json:"timezone"`
	UnitsPreference *string `json:"units_preference"`
	MaxHeartRate    *int    `json:"max_heart_rate"`
}

func (s *UserService) Update(ctx context.Context, userID string, input UpdateUserInput) (*models.UserResponse, error) {
	var user models.UserResponse
	err := s.pool.QueryRow(ctx,
		`UPDATE users SET
			name = COALESCE($2, name),
			timezone = COALESCE($3, timezone),
			units_preference = COALESCE($4, units_preference),
			max_heart_rate = COALESCE($5, max_heart_rate),
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, email, name, timezone, units_preference, max_heart_rate, subscription_tier, subscription_expires_at`,
		userID, input.Name, input.Timezone, input.UnitsPreference, input.MaxHeartRate,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return nil, err
	}
	user.ApplyEffectiveTier()
	return &user, nil
}

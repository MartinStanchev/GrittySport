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
		"SELECT id, email, name, timezone, units_preference FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

type UpdateUserInput struct {
	Name            *string `json:"name"`
	Timezone        *string `json:"timezone"`
	UnitsPreference *string `json:"units_preference"`
}

func (s *UserService) Update(ctx context.Context, userID string, input UpdateUserInput) (*models.UserResponse, error) {
	var user models.UserResponse
	err := s.pool.QueryRow(ctx,
		`UPDATE users SET
			name = COALESCE($2, name),
			timezone = COALESCE($3, timezone),
			units_preference = COALESCE($4, units_preference),
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, email, name, timezone, units_preference`,
		userID, input.Name, input.Timezone, input.UnitsPreference,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

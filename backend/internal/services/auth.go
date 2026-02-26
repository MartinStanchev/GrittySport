package services

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/grittyfitness/api/internal/models"
)

var (
	ErrEmailExists        = errors.New("email already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

func (e *ValidationErrors) Error() string {
	return "validation failed"
}

type AuthService struct {
	pool      *pgxpool.Pool
	jwtSecret []byte
}

func NewAuthService(pool *pgxpool.Pool, jwtSecret string) *AuthService {
	return &AuthService{
		pool:      pool,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *AuthService) Register(ctx context.Context, email, password, name string) (*models.AuthResponse, error) {
	if errs := validateRegister(email, password, name); len(errs) > 0 {
		return nil, &ValidationErrors{Errors: errs}
	}

	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	var user models.UserResponse
	err = s.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
		 RETURNING id, email, name, timezone, units_preference, max_heart_rate`,
		email, string(hash), name,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrEmailExists
		}
		return nil, err
	}

	accessToken, refreshToken, err := s.generateTokenPair(ctx, user)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.AuthResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var user models.User
	err := s.pool.QueryRow(ctx,
		"SELECT id, email, password_hash, name, timezone, units_preference, max_heart_rate FROM users WHERE email = $1",
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	userResp := user.ToResponse()
	accessToken, refreshToken, err := s.generateTokenPair(ctx, userResp)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User:         userResp,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, token string) (*models.AuthResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userResp models.UserResponse
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.timezone, u.units_preference, u.max_heart_rate, rt.expires_at
		 FROM refresh_tokens rt
		 JOIN users u ON rt.user_id = u.id
		 WHERE rt.token = $1`,
		token,
	).Scan(&userResp.ID, &userResp.Email, &userResp.Name, &userResp.Timezone, &userResp.UnitsPreference, &userResp.MaxHeartRate, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(ctx, "DELETE FROM refresh_tokens WHERE token = $1", token)
		_ = tx.Commit(ctx)
		return nil, ErrInvalidToken
	}

	_, err = tx.Exec(ctx, "DELETE FROM refresh_tokens WHERE token = $1", token)
	if err != nil {
		return nil, err
	}

	var newRefreshToken string
	err = tx.QueryRow(ctx,
		`INSERT INTO refresh_tokens (user_id, expires_at) VALUES ($1, $2) RETURNING token`,
		userResp.ID, time.Now().Add(30*24*time.Hour),
	).Scan(&newRefreshToken)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	accessToken, err := s.generateAccessToken(userResp)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User:         userResp,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (s *AuthService) ValidateAccessToken(tokenString string) (userID, email string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return "", "", ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", "", ErrInvalidToken
	}

	sub, _ := claims["sub"].(string)
	em, _ := claims["email"].(string)
	if sub == "" || em == "" {
		return "", "", ErrInvalidToken
	}

	return sub, em, nil
}

func (s *AuthService) generateTokenPair(ctx context.Context, user models.UserResponse) (string, string, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", err
	}

	var refreshToken string
	err = s.pool.QueryRow(ctx,
		`INSERT INTO refresh_tokens (user_id, expires_at) VALUES ($1, $2) RETURNING token`,
		user.ID, time.Now().Add(30*24*time.Hour),
	).Scan(&refreshToken)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func (s *AuthService) generateAccessToken(user models.UserResponse) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"name":  user.Name,
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func validateRegister(email, password, name string) []ValidationError {
	var errs []ValidationError

	email = strings.TrimSpace(email)
	if _, err := mail.ParseAddress(email); err != nil || email == "" {
		errs = append(errs, ValidationError{Field: "email", Message: "invalid email address"})
	}

	if len(password) < 8 {
		errs = append(errs, ValidationError{Field: "password", Message: "password must be at least 8 characters"})
	}

	if strings.TrimSpace(name) == "" {
		errs = append(errs, ValidationError{Field: "name", Message: "name is required"})
	}

	return errs
}

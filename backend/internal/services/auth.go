package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/models"
)

const (
	accessTokenTTL  = 15 * time.Minute
	otpTTL          = 10 * time.Minute
	otpResendWindow = 60 * time.Second
	otpHourlyMax    = 5
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
	ErrInvalidOTP   = errors.New("invalid or expired code")
	ErrOTPLocked    = errors.New("too many attempts; request a new code")
	ErrRateLimited  = errors.New("too many requests; please wait before trying again")
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
	pool       *pgxpool.Pool
	jwtSecret  []byte
	mailer     email.Sender
	refreshTTL time.Duration

	limiterMu sync.Mutex
	recent    map[string][]time.Time
}

func NewAuthService(pool *pgxpool.Pool, jwtSecret string, mailer email.Sender, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		pool:       pool,
		jwtSecret:  []byte(jwtSecret),
		mailer:     mailer,
		refreshTTL: refreshTTL,
		recent:     make(map[string][]time.Time),
	}
}

// RequestOTP processes the same way regardless of whether the email exists — no enumeration.
func (s *AuthService) RequestOTP(ctx context.Context, rawEmail string) error {
	addr, err := normalizeEmail(rawEmail)
	if err != nil {
		return &ValidationErrors{Errors: []ValidationError{{Field: "email", Message: "invalid email address"}}}
	}

	if err := s.checkRateLimit(addr); err != nil {
		return err
	}

	code, err := generateNumericCode(6)
	if err != nil {
		return fmt.Errorf("generate code: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(code), 10)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO email_otps (email, code_hash, purpose, expires_at)
		 VALUES ($1, $2, 'login', $3)`,
		addr, string(hash), time.Now().Add(otpTTL),
	)
	if err != nil {
		return fmt.Errorf("insert otp: %w", err)
	}

	if err := s.mailer.SendOTP(ctx, addr, code); err != nil {
		return fmt.Errorf("send otp: %w", err)
	}
	s.recordSend(addr)
	return nil
}

func (s *AuthService) VerifyOTP(ctx context.Context, rawEmail, code string) (*models.AuthResponse, error) {
	addr, err := normalizeEmail(rawEmail)
	if err != nil {
		return nil, ErrInvalidOTP
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var otpID, codeHash string
	var attempts int
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT id, code_hash, attempts, expires_at
		 FROM email_otps
		 WHERE email = $1 AND purpose = 'login' AND consumed_at IS NULL
		 ORDER BY created_at DESC LIMIT 1`,
		addr,
	).Scan(&otpID, &codeHash, &attempts, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOTP
		}
		return nil, err
	}

	if attempts >= models.OTPMaxAttempts {
		return nil, ErrOTPLocked
	}
	if time.Now().After(expiresAt) {
		return nil, ErrInvalidOTP
	}

	if err := bcrypt.CompareHashAndPassword([]byte(codeHash), []byte(code)); err != nil {
		// Persist the bumped attempt counter even though we'll roll back the rest.
		_, _ = tx.Exec(ctx, `UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`, otpID)
		_ = tx.Commit(ctx)
		return nil, ErrInvalidOTP
	}

	if _, err := tx.Exec(ctx, `UPDATE email_otps SET consumed_at = now() WHERE id = $1`, otpID); err != nil {
		return nil, err
	}

	user, err := s.findOrCreateUserByEmail(ctx, tx, addr)
	if err != nil {
		return nil, err
	}

	accessToken, refreshToken, err := s.issueTokens(ctx, tx, user)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User:         user,
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
		`SELECT u.id, u.email, u.name, u.timezone, u.units_preference, u.max_heart_rate, u.weekly_effort_goal,
		        u.birth_year, u.height_cm, u.weight_kg, u.profile_completed,
		        u.subscription_tier, u.subscription_expires_at, rt.expires_at
		 FROM refresh_tokens rt
		 JOIN users u ON rt.user_id = u.id
		 WHERE rt.token = $1`,
		token,
	).Scan(&userResp.ID, &userResp.Email, &userResp.Name, &userResp.Timezone, &userResp.UnitsPreference, &userResp.MaxHeartRate, &userResp.WeeklyEffortGoal,
		&userResp.BirthYear, &userResp.HeightCm, &userResp.WeightKg, &userResp.ProfileCompleted,
		&userResp.SubscriptionTier, &userResp.SubscriptionExpiresAt, &expiresAt)
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

	if _, err := tx.Exec(ctx, "DELETE FROM refresh_tokens WHERE token = $1", token); err != nil {
		return nil, err
	}

	userResp.ApplyEffectiveTier()
	accessToken, refreshToken, err := s.issueTokens(ctx, tx, userResp)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		User:         userResp,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
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

// findOrCreateUserByEmail handles three cases: (a) email identity exists; (b) user
// exists without an email identity — silently link it (SSO user adding OTP); (c) no
// user yet — create one with profile_completed=false so the frontend shows ProfileSetupScreen.
func (s *AuthService) findOrCreateUserByEmail(ctx context.Context, tx pgx.Tx, addr string) (models.UserResponse, error) {
	var user models.UserResponse

	err := tx.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.timezone, u.units_preference, u.max_heart_rate, u.weekly_effort_goal,
		        u.birth_year, u.height_cm, u.weight_kg, u.profile_completed,
		        u.subscription_tier, u.subscription_expires_at
		 FROM auth_identities ai
		 JOIN users u ON ai.user_id = u.id
		 WHERE ai.provider = $1 AND ai.provider_user_id = $2`,
		models.AuthProviderEmail, addr,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err == nil {
		_, _ = tx.Exec(ctx,
			`UPDATE auth_identities SET last_used_at = now()
			 WHERE provider = $1 AND provider_user_id = $2`,
			models.AuthProviderEmail, addr)
		user.ApplyEffectiveTier()
		return user, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, err
	}

	err = tx.QueryRow(ctx,
		`SELECT id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		        birth_year, height_cm, weight_kg, profile_completed,
		        subscription_tier, subscription_expires_at
		 FROM users WHERE email = $1`,
		addr,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err == nil {
		if _, err := tx.Exec(ctx,
			`INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
			user.ID, models.AuthProviderEmail, addr); err != nil {
			return user, err
		}
		user.ApplyEffectiveTier()
		return user, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, err
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, name, profile_completed) VALUES ($1, $2, false)
		 RETURNING id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		           birth_year, height_cm, weight_kg, profile_completed,
		           subscription_tier, subscription_expires_at`,
		addr, emailLocalPart(addr),
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return user, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
		user.ID, models.AuthProviderEmail, addr); err != nil {
		return user, err
	}
	user.ApplyEffectiveTier()
	return user, nil
}

func (s *AuthService) issueTokens(ctx context.Context, tx pgx.Tx, user models.UserResponse) (string, string, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", err
	}
	var refreshToken string
	err = tx.QueryRow(ctx,
		`INSERT INTO refresh_tokens (user_id, expires_at) VALUES ($1, $2) RETURNING token`,
		user.ID, time.Now().Add(s.refreshTTL),
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
		"exp":   time.Now().Add(accessTokenTTL).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// checkRateLimit is in-process only — resets on restart, acceptable at current scale.
func (s *AuthService) checkRateLimit(addr string) error {
	s.limiterMu.Lock()
	defer s.limiterMu.Unlock()

	now := time.Now()
	hourAgo := now.Add(-time.Hour)
	pruned := s.recent[addr][:0]
	for _, t := range s.recent[addr] {
		if t.After(hourAgo) {
			pruned = append(pruned, t)
		}
	}
	s.recent[addr] = pruned

	if len(pruned) >= otpHourlyMax {
		return ErrRateLimited
	}
	if len(pruned) > 0 && now.Sub(pruned[len(pruned)-1]) < otpResendWindow {
		return ErrRateLimited
	}
	return nil
}

func (s *AuthService) recordSend(addr string) {
	s.limiterMu.Lock()
	s.recent[addr] = append(s.recent[addr], time.Now())
	s.limiterMu.Unlock()
}

func normalizeEmail(raw string) (string, error) {
	addr := strings.ToLower(strings.TrimSpace(raw))
	if addr == "" {
		return "", errors.New("empty email")
	}
	if _, err := mail.ParseAddress(addr); err != nil {
		return "", err
	}
	return addr, nil
}

func emailLocalPart(addr string) string {
	if i := strings.IndexByte(addr, '@'); i > 0 {
		return addr[:i]
	}
	return addr
}

func generateNumericCode(digits int) (string, error) {
	max := big.NewInt(1)
	for i := 0; i < digits; i++ {
		max.Mul(max, big.NewInt(10))
	}
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", digits, n.Int64()), nil
}

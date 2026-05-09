package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
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

	// dummyOTPHash is compared against the supplied code when no OTP row exists,
	// so VerifyOTP's no-row branch takes the same ~50 ms as the bcrypt success
	// path. Without this, response timing leaks "is there a pending OTP for this
	// email" — narrow but cheap to close.
	dummyOTPHash []byte

	limiterMu sync.Mutex
	recent    map[string][]time.Time
}

func NewAuthService(pool *pgxpool.Pool, jwtSecret string, mailer email.Sender, refreshTTL time.Duration) *AuthService {
	dummy, err := bcrypt.GenerateFromPassword([]byte("dummy-otp-for-timing"), 10)
	if err != nil {
		panic(fmt.Sprintf("auth: precompute dummy bcrypt: %v", err))
	}
	return &AuthService{
		pool:         pool,
		jwtSecret:    []byte(jwtSecret),
		mailer:       mailer,
		refreshTTL:   refreshTTL,
		dummyOTPHash: dummy,
		recent:       make(map[string][]time.Time),
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

	// Invalidate any prior unconsumed OTPs for this email/purpose first.
	// Without this, multiple unconsumed rows coexist and VerifyOTP reads only
	// the newest, so the per-row attempts counter is effectively reset on each
	// new send — combined with the hourly send limit, an attacker would still
	// get otpHourlyMax * OTPMaxAttempts guesses instead of OTPMaxAttempts total.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin otp tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		`UPDATE email_otps SET consumed_at = now()
		 WHERE email = $1 AND purpose = 'login' AND consumed_at IS NULL`,
		addr,
	); err != nil {
		return fmt.Errorf("invalidate prior otps: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO email_otps (email, code_hash, purpose, expires_at)
		 VALUES ($1, $2, 'login', $3)`,
		addr, string(hash), time.Now().Add(otpTTL),
	); err != nil {
		return fmt.Errorf("insert otp: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit otp tx: %w", err)
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
			// Burn the same ~50 ms a real bcrypt check would, so timing doesn't
			// disclose whether a pending OTP exists for this email.
			_ = bcrypt.CompareHashAndPassword(s.dummyOTPHash, []byte(code))
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

	user, isNew, err := s.findOrCreateUserByEmail(ctx, tx, addr)
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
		IsNewUser:    isNew,
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, token string) (*models.AuthResponse, error) {
	tokenHash := hashRefreshToken(token)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userResp models.UserResponse
	var expiresAt time.Time
	var consumedAt *time.Time
	var familyID string
	err = tx.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.timezone, u.units_preference, u.max_heart_rate, u.weekly_effort_goal,
		        u.birth_year, u.height_cm, u.weight_kg, u.profile_completed, u.consents_completed_at,
		        u.subscription_tier, u.subscription_expires_at, rt.expires_at, rt.consumed_at, rt.family_id
		 FROM refresh_tokens rt
		 JOIN users u ON rt.user_id = u.id
		 WHERE rt.token_hash = $1`,
		tokenHash,
	).Scan(&userResp.ID, &userResp.Email, &userResp.Name, &userResp.Timezone, &userResp.UnitsPreference, &userResp.MaxHeartRate, &userResp.WeeklyEffortGoal,
		&userResp.BirthYear, &userResp.HeightCm, &userResp.WeightKg, &userResp.ProfileCompleted, &userResp.ConsentsCompletedAt,
		&userResp.SubscriptionTier, &userResp.SubscriptionExpiresAt, &expiresAt, &consumedAt, &familyID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	// Reuse detection: a previously-consumed token being replayed means either
	// the legitimate client lost a race or the token was stolen. Either way the
	// safe response is to revoke the entire family so the attacker can't keep
	// rotating it.
	if consumedAt != nil {
		_, _ = tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE family_id = $1`, familyID)
		_ = tx.Commit(ctx)
		return nil, ErrInvalidToken
	}

	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash)
		_ = tx.Commit(ctx)
		return nil, ErrInvalidToken
	}

	if _, err := tx.Exec(ctx,
		`UPDATE refresh_tokens SET consumed_at = now() WHERE token_hash = $1`,
		tokenHash,
	); err != nil {
		return nil, err
	}

	userResp.ApplyEffectiveTier()
	accessToken, refreshToken, err := s.issueTokensInFamily(ctx, tx, userResp, familyID)
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

// RevokeAllRefreshTokens deletes every refresh token for the given user. The
// caller's access token (a stateless JWT) remains valid until it expires —
// 15-minute TTL — but no further sessions can be issued from any device. Used
// by the "sign out of all devices" Settings action.
func (s *AuthService) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

// ValidateAccessToken parses and verifies a JWT and checks that the referenced
// user still exists. The user-existence check ensures that deleted accounts
// can't keep using API access for the remainder of the access-token TTL.
func (s *AuthService) ValidateAccessToken(ctx context.Context, tokenString string) (userID, email string, err error) {
	// Pin to HS256 specifically — accepting any HMAC variant lets a forger
	// downgrade to HS384/512 with a different key shape. We only ever sign HS256.
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
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

	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, sub).Scan(&exists); err != nil {
		return "", "", ErrInvalidToken
	}
	if !exists {
		return "", "", ErrInvalidToken
	}

	return sub, em, nil
}

// findOrCreateUserByEmail handles three cases: (a) email identity exists; (b) user
// exists without an email identity — silently link it (SSO user adding OTP); (c) no
// user yet — create one with profile_completed=false so the frontend shows ProfileSetupScreen.
// Returns isNew=true only in case (c).
func (s *AuthService) findOrCreateUserByEmail(ctx context.Context, tx pgx.Tx, addr string) (models.UserResponse, bool, error) {
	var user models.UserResponse

	err := tx.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.timezone, u.units_preference, u.max_heart_rate, u.weekly_effort_goal,
		        u.birth_year, u.height_cm, u.weight_kg, u.profile_completed, u.consents_completed_at,
		        u.subscription_tier, u.subscription_expires_at
		 FROM auth_identities ai
		 JOIN users u ON ai.user_id = u.id
		 WHERE ai.provider = $1 AND ai.provider_user_id = $2`,
		models.AuthProviderEmail, addr,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted, &user.ConsentsCompletedAt,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err == nil {
		_, _ = tx.Exec(ctx,
			`UPDATE auth_identities SET last_used_at = now()
			 WHERE provider = $1 AND provider_user_id = $2`,
			models.AuthProviderEmail, addr)
		user.ApplyEffectiveTier()
		return user, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, false, err
	}

	err = tx.QueryRow(ctx,
		`SELECT id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		        birth_year, height_cm, weight_kg, profile_completed, consents_completed_at,
		        subscription_tier, subscription_expires_at
		 FROM users WHERE email = $1`,
		addr,
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted, &user.ConsentsCompletedAt,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err == nil {
		if _, err := tx.Exec(ctx,
			`INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
			user.ID, models.AuthProviderEmail, addr); err != nil {
			return user, false, err
		}
		user.ApplyEffectiveTier()
		return user, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, false, err
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, name, profile_completed) VALUES ($1, $2, false)
		 RETURNING id, email, name, timezone, units_preference, max_heart_rate, weekly_effort_goal,
		           birth_year, height_cm, weight_kg, profile_completed, consents_completed_at,
		           subscription_tier, subscription_expires_at`,
		addr, emailLocalPart(addr),
	).Scan(&user.ID, &user.Email, &user.Name, &user.Timezone, &user.UnitsPreference, &user.MaxHeartRate, &user.WeeklyEffortGoal,
		&user.BirthYear, &user.HeightCm, &user.WeightKg, &user.ProfileCompleted, &user.ConsentsCompletedAt,
		&user.SubscriptionTier, &user.SubscriptionExpiresAt)
	if err != nil {
		return user, false, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
		user.ID, models.AuthProviderEmail, addr); err != nil {
		return user, false, err
	}
	user.ApplyEffectiveTier()
	return user, true, nil
}

// issueTokens mints a new access JWT and a fresh refresh token in a brand-new
// family. Use this on initial login (post-OTP).
func (s *AuthService) issueTokens(ctx context.Context, tx pgx.Tx, user models.UserResponse) (string, string, error) {
	return s.issueTokensInFamily(ctx, tx, user, "")
}

// issueTokensInFamily mints tokens, attaching the new refresh token to the
// supplied family (empty string means "start a new family"). Refresh-rotation
// callers pass the previous token's family so the chain stays linked for
// reuse-detection.
func (s *AuthService) issueTokensInFamily(ctx context.Context, tx pgx.Tx, user models.UserResponse, familyID string) (string, string, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := generateRefreshToken()
	if err != nil {
		return "", "", err
	}
	tokenHash := hashRefreshToken(refreshToken)

	if familyID == "" {
		_, err = tx.Exec(ctx,
			`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
			user.ID, tokenHash, time.Now().Add(s.refreshTTL),
		)
	} else {
		_, err = tx.Exec(ctx,
			`INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)`,
			user.ID, tokenHash, familyID, time.Now().Add(s.refreshTTL),
		)
	}
	if err != nil {
		return "", "", err
	}
	return accessToken, refreshToken, nil
}

// generateRefreshToken returns a 32-byte cryptographically random token,
// hex-encoded (64 chars). High entropy means SHA-256 at rest is sufficient —
// brute-forcing the hash is infeasible without storing user-distinguishing
// info, so bcrypt's slowness isn't needed here.
func generateRefreshToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
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

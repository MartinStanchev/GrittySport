package services_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/services"
)

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

var testPool *pgxpool.Pool

const (
	testJWTSecret  = "test-secret-key-for-integration-tests"
	testRefreshTTL = 180 * 24 * time.Hour
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL != "" {
		var err error
		testPool, err = db.Connect(ctx, dbURL)
		if err != nil {
			panic("failed to connect to test database: " + err.Error())
		}
		defer testPool.Close()

		migrationsPath := os.Getenv("MIGRATIONS_PATH")
		if migrationsPath == "" {
			migrationsPath = "../../../../db/migrations"
		}
		if err := db.RunMigrations(ctx, testPool, migrationsPath); err != nil {
			panic("failed to run migrations: " + err.Error())
		}
	}

	code := m.Run()

	if testPool != nil {
		ctx := context.Background()
		_, _ = testPool.Exec(ctx, "DELETE FROM email_otps")
		_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
		_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
		_, _ = testPool.Exec(ctx, "DELETE FROM user_consents")
		_, _ = testPool.Exec(ctx, "DELETE FROM users")
	}
	os.Exit(code)
}

func cleanTables(t *testing.T) {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM email_otps")
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM user_consents")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func newService(mailer email.Sender) *services.AuthService {
	return services.NewAuthService(testPool, testJWTSecret, mailer, testRefreshTTL)
}

// requestAndExtractCode triggers an OTP send through the service and returns
// the most recent code that the MockSender captured.
func requestAndExtractCode(t *testing.T, svc *services.AuthService, mock *email.MockSender, addr string) string {
	t.Helper()
	if err := svc.RequestOTP(context.Background(), addr); err != nil {
		t.Fatalf("RequestOTP(%s) failed: %v", addr, err)
	}
	sent := mock.Sent()
	if len(sent) == 0 {
		t.Fatalf("expected MockSender to have a sent OTP")
	}
	return sent[len(sent)-1].Code
}

func TestRequestOTP_SendsCodeAndPersistsRow(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)

	if err := svc.RequestOTP(context.Background(), "Otp@Example.com"); err != nil {
		t.Fatalf("RequestOTP failed: %v", err)
	}

	sent := mock.Sent()
	if len(sent) != 1 {
		t.Fatalf("expected 1 email sent, got %d", len(sent))
	}
	if sent[0].Email != "otp@example.com" {
		t.Errorf("expected normalized lowercase email, got %q", sent[0].Email)
	}
	if len(sent[0].Code) != 6 {
		t.Errorf("expected 6-digit code, got %q", sent[0].Code)
	}

	var count int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM email_otps WHERE email = $1 AND consumed_at IS NULL`,
		"otp@example.com").Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 unconsumed OTP row, got %d", count)
	}
}

func TestRequestOTP_InvalidEmail(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)

	err := svc.RequestOTP(context.Background(), "not-an-email")
	if err == nil {
		t.Fatal("expected validation error")
	}
	var valErrs *services.ValidationErrors
	if !errors.As(err, &valErrs) {
		t.Fatalf("expected ValidationErrors, got %T", err)
	}
}

func TestRequestOTP_ResendCooldown(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)

	if err := svc.RequestOTP(context.Background(), "rl@example.com"); err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	err := svc.RequestOTP(context.Background(), "rl@example.com")
	if !errors.Is(err, services.ErrRateLimited) {
		t.Errorf("expected ErrRateLimited on immediate retry, got %v", err)
	}
}

func TestReviewAccount_StaticOTPWithoutEmail(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	if err := svc.SetReviewAccount("Review@Example.com", "246810"); err != nil {
		t.Fatalf("SetReviewAccount failed: %v", err)
	}
	ctx := context.Background()

	if err := svc.RequestOTP(ctx, "review@example.com"); err != nil {
		t.Fatalf("RequestOTP failed: %v", err)
	}
	if sent := mock.Sent(); len(sent) != 0 {
		t.Fatalf("expected no email for review account, got %d", len(sent))
	}

	if _, err := svc.VerifyOTP(ctx, "review@example.com", "111111"); !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP for wrong code, got %v", err)
	}

	resp, err := svc.VerifyOTP(ctx, "review@example.com", "246810")
	if err != nil {
		t.Fatalf("VerifyOTP with static code failed: %v", err)
	}
	if resp.User.Email != "review@example.com" {
		t.Errorf("unexpected user email %q", resp.User.Email)
	}

	// Consumed on use like any OTP: the same code needs a fresh request.
	if _, err := svc.VerifyOTP(ctx, "review@example.com", "246810"); !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP after consumption, got %v", err)
	}
}

func TestReviewAccount_OtherEmailsStillGetRandomCodes(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	if err := svc.SetReviewAccount("review@example.com", "246810"); err != nil {
		t.Fatalf("SetReviewAccount failed: %v", err)
	}

	code := requestAndExtractCode(t, svc, mock, "normal@example.com")
	if code == "246810" {
		t.Error("normal account received the review account's static code")
	}
}

func TestSetReviewAccount_RejectsBadConfig(t *testing.T) {
	svc := newService(&email.MockSender{})
	if err := svc.SetReviewAccount("not-an-email", "246810"); err == nil {
		t.Error("expected error for invalid email")
	}
	if err := svc.SetReviewAccount("review@example.com", "1234"); err == nil {
		t.Error("expected error for short code")
	}
	if err := svc.SetReviewAccount("review@example.com", "abc123"); err == nil {
		t.Error("expected error for non-numeric code")
	}
}

func TestVerifyOTP_NewUser_CreatesUserAndIdentity(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "new@example.com")

	resp, err := svc.VerifyOTP(ctx, "new@example.com", code)
	if err != nil {
		t.Fatalf("VerifyOTP failed: %v", err)
	}
	if resp.User.Email != "new@example.com" {
		t.Errorf("expected email new@example.com, got %s", resp.User.Email)
	}
	if resp.User.ProfileCompleted {
		t.Error("expected new user profile_completed=false")
	}
	if !resp.IsNewUser {
		t.Error("expected IsNewUser=true on first verify")
	}
	if resp.User.ConsentsCompletedAt != nil {
		t.Error("expected new user consents_completed_at=nil")
	}
	if resp.User.Name == "" {
		t.Error("expected derived name (email local-part) on new user")
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens to be non-empty")
	}

	var provider string
	if err := testPool.QueryRow(ctx,
		`SELECT provider FROM auth_identities WHERE user_id = $1`,
		resp.User.ID).Scan(&provider); err != nil {
		t.Fatalf("auth_identities lookup failed: %v", err)
	}
	if provider != "email" {
		t.Errorf("expected email auth_identity, got %s", provider)
	}
}

func TestVerifyOTP_ExistingIdentity_ReusesUser(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	first := requestAndExtractCode(t, svc, mock, "loyal@example.com")
	firstResp, err := svc.VerifyOTP(ctx, "loyal@example.com", first)
	if err != nil {
		t.Fatalf("first verify failed: %v", err)
	}

	mock.Reset()
	// Bypass the 60s cooldown by clearing the in-memory limiter via a fresh service.
	svc2 := newService(mock)
	second := requestAndExtractCode(t, svc2, mock, "loyal@example.com")
	secondResp, err := svc2.VerifyOTP(ctx, "loyal@example.com", second)
	if err != nil {
		t.Fatalf("second verify failed: %v", err)
	}

	if firstResp.User.ID != secondResp.User.ID {
		t.Errorf("expected same user ID across logins; got %s and %s", firstResp.User.ID, secondResp.User.ID)
	}
	if !firstResp.IsNewUser {
		t.Error("expected IsNewUser=true on initial signup")
	}
	if secondResp.IsNewUser {
		t.Error("expected IsNewUser=false on second login")
	}
}

func TestVerifyOTP_LinksEmailIdentityForExistingUser(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	// Pre-existing user without an email auth_identity (simulates a user
	// signed up via SSO with the same email — feature isn't built yet but the
	// linking path should already work).
	var existingID string
	if err := testPool.QueryRow(ctx,
		`INSERT INTO users (email, name, profile_completed) VALUES ($1, $2, true)
		 RETURNING id`,
		"sso@example.com", "Existing User").Scan(&existingID); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	code := requestAndExtractCode(t, svc, mock, "sso@example.com")
	resp, err := svc.VerifyOTP(ctx, "sso@example.com", code)
	if err != nil {
		t.Fatalf("VerifyOTP failed: %v", err)
	}
	if resp.User.ID != existingID {
		t.Errorf("expected existing user ID, got %s", resp.User.ID)
	}
	if resp.User.Name != "Existing User" {
		t.Errorf("expected existing user name preserved, got %s", resp.User.Name)
	}

	var count int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM auth_identities WHERE user_id = $1 AND provider = 'email'`,
		existingID).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected email identity linked exactly once, got %d", count)
	}
}

func TestVerifyOTP_WrongCodeIncrementsAttempts(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	_ = requestAndExtractCode(t, svc, mock, "wrong@example.com")

	_, err := svc.VerifyOTP(ctx, "wrong@example.com", "000000")
	if !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP, got %v", err)
	}

	var attempts int
	if err := testPool.QueryRow(ctx,
		`SELECT attempts FROM email_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
		"wrong@example.com").Scan(&attempts); err != nil {
		t.Fatalf("query attempts: %v", err)
	}
	if attempts != 1 {
		t.Errorf("expected attempts=1, got %d", attempts)
	}
}

func TestVerifyOTP_LocksAfterMaxAttempts(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	_ = requestAndExtractCode(t, svc, mock, "lock@example.com")

	for i := 0; i < 5; i++ {
		_, _ = svc.VerifyOTP(ctx, "lock@example.com", "000000")
	}

	_, err := svc.VerifyOTP(ctx, "lock@example.com", "000000")
	if !errors.Is(err, services.ErrOTPLocked) {
		t.Errorf("expected ErrOTPLocked after max attempts, got %v", err)
	}
}

func TestVerifyOTP_ExpiredCode(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "exp@example.com")

	_, err := testPool.Exec(ctx,
		`UPDATE email_otps SET expires_at = $1 WHERE email = $2`,
		time.Now().Add(-1*time.Hour), "exp@example.com")
	if err != nil {
		t.Fatalf("expire: %v", err)
	}

	_, err = svc.VerifyOTP(ctx, "exp@example.com", code)
	if !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP for expired code, got %v", err)
	}
}

func TestVerifyOTP_NoOutstandingCode(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)

	_, err := svc.VerifyOTP(context.Background(), "ghost@example.com", "123456")
	if !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP, got %v", err)
	}
}

func TestVerifyOTP_ConsumedCodeCannotBeReused(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "once@example.com")

	if _, err := svc.VerifyOTP(ctx, "once@example.com", code); err != nil {
		t.Fatalf("first verify failed: %v", err)
	}
	_, err := svc.VerifyOTP(ctx, "once@example.com", code)
	if !errors.Is(err, services.ErrInvalidOTP) {
		t.Errorf("expected ErrInvalidOTP for reuse, got %v", err)
	}
}

func TestRefreshToken_Success(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "refresh@example.com")
	verifyResp, err := svc.VerifyOTP(ctx, "refresh@example.com", code)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	resp, err := svc.RefreshToken(ctx, verifyResp.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if resp.User.Email != "refresh@example.com" {
		t.Errorf("expected email preserved, got %s", resp.User.Email)
	}
	if resp.RefreshToken == verifyResp.RefreshToken {
		t.Error("expected rotated refresh token")
	}
}

func TestRefreshToken_RotatedTokenInvalidated(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "rotate@example.com")
	verifyResp, _ := svc.VerifyOTP(ctx, "rotate@example.com", code)

	old := verifyResp.RefreshToken
	if _, err := svc.RefreshToken(ctx, old); err != nil {
		t.Fatalf("first refresh failed: %v", err)
	}
	_, err := svc.RefreshToken(ctx, old)
	if !errors.Is(err, services.ErrInvalidToken) {
		t.Errorf("expected ErrInvalidToken on reused token, got %v", err)
	}
}

func TestRefreshToken_Invalid(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)

	_, err := svc.RefreshToken(context.Background(), "00000000-0000-0000-0000-000000000000")
	if !errors.Is(err, services.ErrInvalidToken) {
		t.Errorf("expected ErrInvalidToken, got %v", err)
	}
}

func TestRefreshToken_Expired(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "stale@example.com")
	verifyResp, _ := svc.VerifyOTP(ctx, "stale@example.com", code)

	tokenHash := sha256Hex(verifyResp.RefreshToken)
	if _, err := testPool.Exec(ctx,
		`UPDATE refresh_tokens SET expires_at = $1 WHERE token_hash = $2`,
		time.Now().Add(-1*time.Hour), tokenHash); err != nil {
		t.Fatalf("expire: %v", err)
	}

	_, err := svc.RefreshToken(ctx, verifyResp.RefreshToken)
	if !errors.Is(err, services.ErrInvalidToken) {
		t.Errorf("expected ErrInvalidToken, got %v", err)
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	cleanTables(t)
	mock := &email.MockSender{}
	svc := newService(mock)
	ctx := context.Background()

	code := requestAndExtractCode(t, svc, mock, "v@example.com")
	verifyResp, _ := svc.VerifyOTP(ctx, "v@example.com", code)

	userID, em, err := svc.ValidateAccessToken(ctx, verifyResp.AccessToken)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if userID != verifyResp.User.ID {
		t.Errorf("user ID mismatch")
	}
	if em != "v@example.com" {
		t.Errorf("expected email v@example.com, got %s", em)
	}
}

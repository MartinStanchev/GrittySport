package services_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/services"
)

var testPool *pgxpool.Pool

const testJWTSecret = "test-secret-key-for-integration-tests"

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		os.Exit(0) // skip all tests silently
	}

	ctx := context.Background()
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

	code := m.Run()

	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
	os.Exit(code)
}

func cleanTables(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func newService() *services.AuthService {
	return services.NewAuthService(testPool, testJWTSecret)
}

func TestRegister_Success(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	resp, err := svc.Register(ctx, "test@example.com", "password123", "Test User")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.User.Email != "test@example.com" {
		t.Errorf("expected email 'test@example.com', got '%s'", resp.User.Email)
	}
	if resp.User.Name != "Test User" {
		t.Errorf("expected name 'Test User', got '%s'", resp.User.Name)
	}
	if resp.User.ID == "" {
		t.Error("expected non-empty user ID")
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "dup@example.com", "password123", "User One")
	if err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	_, err = svc.Register(ctx, "dup@example.com", "password456", "User Two")
	if err != services.ErrEmailExists {
		t.Errorf("expected ErrEmailExists, got: %v", err)
	}
}

func TestRegister_DuplicateEmailCaseInsensitive(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "Test@Example.com", "password123", "User One")
	if err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	_, err = svc.Register(ctx, "test@example.com", "password456", "User Two")
	if err != services.ErrEmailExists {
		t.Errorf("expected ErrEmailExists, got: %v", err)
	}
}

func TestRegister_InvalidEmail(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "not-an-email", "password123", "User")
	if err == nil {
		t.Fatal("expected validation error")
	}
	var valErrs *services.ValidationErrors
	if !isValidationError(err, &valErrs) {
		t.Fatalf("expected ValidationErrors, got: %T", err)
	}
	if valErrs.Errors[0].Field != "email" {
		t.Errorf("expected email field error, got: %s", valErrs.Errors[0].Field)
	}
}

func TestRegister_ShortPassword(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "test@example.com", "short", "User")
	if err == nil {
		t.Fatal("expected validation error")
	}
	var valErrs *services.ValidationErrors
	if !isValidationError(err, &valErrs) {
		t.Fatalf("expected ValidationErrors, got: %T", err)
	}
	if valErrs.Errors[0].Field != "password" {
		t.Errorf("expected password field error, got: %s", valErrs.Errors[0].Field)
	}
}

func TestRegister_EmptyName(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "test@example.com", "password123", "")
	if err == nil {
		t.Fatal("expected validation error")
	}
	var valErrs *services.ValidationErrors
	if !isValidationError(err, &valErrs) {
		t.Fatalf("expected ValidationErrors, got: %T", err)
	}
}

func TestLogin_Success(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "login@example.com", "password123", "Login User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	resp, err := svc.Login(ctx, "login@example.com", "password123")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if resp.User.Email != "login@example.com" {
		t.Errorf("expected email 'login@example.com', got '%s'", resp.User.Email)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens to be non-empty")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Register(ctx, "user@example.com", "password123", "User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	_, err = svc.Login(ctx, "user@example.com", "wrongpassword")
	if err != services.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestLogin_NonexistentEmail(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.Login(ctx, "nobody@example.com", "password123")
	if err != services.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestRefreshToken_Success(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	regResp, err := svc.Register(ctx, "refresh@example.com", "password123", "Refresh User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	resp, err := svc.RefreshToken(ctx, regResp.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}

	if resp.User.Email != "refresh@example.com" {
		t.Errorf("expected email 'refresh@example.com', got '%s'", resp.User.Email)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens to be non-empty")
	}
	if resp.RefreshToken == regResp.RefreshToken {
		t.Error("expected new refresh token to differ from old one")
	}
}

func TestRefreshToken_OldTokenDeleted(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	regResp, err := svc.Register(ctx, "rotate@example.com", "password123", "Rotate User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	oldToken := regResp.RefreshToken

	_, err = svc.RefreshToken(ctx, oldToken)
	if err != nil {
		t.Fatalf("first refresh failed: %v", err)
	}

	_, err = svc.RefreshToken(ctx, oldToken)
	if err != services.ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken for rotated token, got: %v", err)
	}
}

func TestRefreshToken_Invalid(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	_, err := svc.RefreshToken(ctx, "00000000-0000-0000-0000-000000000000")
	if err != services.ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken, got: %v", err)
	}
}

func TestRefreshToken_Expired(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	regResp, err := svc.Register(ctx, "expired@example.com", "password123", "Expired User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	_, err = testPool.Exec(ctx,
		"UPDATE refresh_tokens SET expires_at = $1 WHERE token = $2",
		time.Now().Add(-1*time.Hour), regResp.RefreshToken,
	)
	if err != nil {
		t.Fatalf("failed to expire token: %v", err)
	}

	_, err = svc.RefreshToken(ctx, regResp.RefreshToken)
	if err != services.ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken for expired token, got: %v", err)
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	cleanTables(t)
	svc := newService()
	ctx := context.Background()

	regResp, err := svc.Register(ctx, "validate@example.com", "password123", "Validate User")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	userID, email, err := svc.ValidateAccessToken(regResp.AccessToken)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if userID != regResp.User.ID {
		t.Errorf("expected user ID '%s', got '%s'", regResp.User.ID, userID)
	}
	if email != "validate@example.com" {
		t.Errorf("expected email 'validate@example.com', got '%s'", email)
	}
}

func isValidationError(err error, target **services.ValidationErrors) bool {
	return errors.As(err, target)
}

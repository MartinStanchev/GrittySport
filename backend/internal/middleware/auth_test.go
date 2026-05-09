package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
)

const testJWTSecret = "test-secret-key-for-unit-tests"

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	ctx := context.Background()
	if dbURL := os.Getenv("TEST_DATABASE_URL"); dbURL != "" {
		var err error
		testPool, err = db.Connect(ctx, dbURL)
		if err != nil {
			panic("failed to connect to test database: " + err.Error())
		}
		defer testPool.Close()

		migrationsPath := os.Getenv("MIGRATIONS_PATH")
		if migrationsPath == "" {
			migrationsPath = "../../../db/migrations"
		}
		if err := db.RunMigrations(ctx, testPool, migrationsPath); err != nil {
			panic("failed to run migrations: " + err.Error())
		}
	}
	os.Exit(m.Run())
}

func generateTestToken(t *testing.T, userID, email string, exp time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"name":  "Test User",
		"exp":   exp.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

// setupMiddleware builds a JWTAuth middleware bound to a stub AuthService.
// Negative-path tests don't need the DB because validation fails before the
// user-existence check. The valid-token test uses setupMiddlewareWithPool.
func setupMiddleware() func(http.Handler) http.Handler {
	authService := services.NewAuthService(nil, testJWTSecret, nil, 0)
	return middleware.JWTAuth(authService)
}

func setupMiddlewareWithPool(t *testing.T) func(http.Handler) http.Handler {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set")
	}
	authService := services.NewAuthService(testPool, testJWTSecret, nil, 0)
	return middleware.JWTAuth(authService)
}

func TestJWTAuth_ValidToken(t *testing.T) {
	mw := setupMiddlewareWithPool(t)
	ctx := context.Background()

	var userID string
	if err := testPool.QueryRow(ctx,
		`INSERT INTO users (email, name, profile_completed) VALUES ($1, $2, true) RETURNING id`,
		"jwtauth-valid@example.com", "JWT Auth Test",
	).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = testPool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := generateTestToken(t, userID, "jwtauth-valid@example.com", time.Now().Add(15*time.Minute))

	var capturedUserID, capturedEmail string
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUserID = middleware.GetUserID(r.Context())
		capturedEmail = middleware.GetUserEmail(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if capturedUserID != userID {
		t.Errorf("expected user_id %q, got %q", userID, capturedUserID)
	}
	if capturedEmail != "jwtauth-valid@example.com" {
		t.Errorf("expected email 'jwtauth-valid@example.com', got %q", capturedEmail)
	}
}

func TestJWTAuth_DeletedUserRejected(t *testing.T) {
	mw := setupMiddlewareWithPool(t)
	ctx := context.Background()

	var userID string
	if err := testPool.QueryRow(ctx,
		`INSERT INTO users (email, name, profile_completed) VALUES ($1, $2, true) RETURNING id`,
		"jwtauth-deleted@example.com", "Deleted",
	).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	token := generateTestToken(t, userID, "jwtauth-deleted@example.com", time.Now().Add(15*time.Minute))

	if _, err := testPool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for deleted user")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for deleted user with otherwise-valid JWT, got %d", rec.Code)
	}
}

func TestJWTAuth_MissingHeader(t *testing.T) {
	mw := setupMiddleware()
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	mw := setupMiddleware()
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	mw := setupMiddleware()
	token := generateTestToken(t, "user-123", "test@test.com", time.Now().Add(-1*time.Hour))

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestJWTAuth_MalformedHeader(t *testing.T) {
	mw := setupMiddleware()
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "NotBearer some-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestJWTAuth_WrongSigningKey(t *testing.T) {
	mw := setupMiddleware()

	claims := jwt.MapClaims{
		"sub":   "user-123",
		"email": "test@test.com",
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte("wrong-secret"))

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/handlers"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

var testPool *pgxpool.Pool

const (
	testJWTSecret  = "test-secret-key-for-handler-tests"
	testRefreshTTL = 180 * 24 * time.Hour
)

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		os.Exit(0)
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
	_, _ = testPool.Exec(ctx, "DELETE FROM email_otps")
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
	os.Exit(code)
}

func cleanTables(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM email_otps")
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func setupRouter() (*chi.Mux, *email.MockSender) {
	mock := &email.MockSender{}
	authService := services.NewAuthService(testPool, testJWTSecret, mock, testRefreshTTL)
	authHandler := handlers.NewAuthHandler(authService)

	r := chi.NewRouter()
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/otp/request", authHandler.RequestOTP)
		r.Post("/otp/verify", authHandler.VerifyOTP)
		r.Post("/refresh", authHandler.Refresh)
	})
	return r, mock
}

func postJSON(r *chi.Mux, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestRequestOTP_204(t *testing.T) {
	cleanTables(t)
	r, mock := setupRouter()

	rec := postJSON(r, "/api/auth/otp/request", `{"email":"otp@example.com"}`)
	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mock.Sent()) != 1 {
		t.Errorf("expected 1 OTP sent, got %d", len(mock.Sent()))
	}
}

func TestRequestOTP_422_InvalidEmail(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	rec := postJSON(r, "/api/auth/otp/request", `{"email":"not-an-email"}`)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRequestOTP_429_RateLimited(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	if rec := postJSON(r, "/api/auth/otp/request", `{"email":"rl@example.com"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("first request expected 204, got %d", rec.Code)
	}
	rec := postJSON(r, "/api/auth/otp/request", `{"email":"rl@example.com"}`)
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 on immediate retry, got %d", rec.Code)
	}
}

func TestVerifyOTP_200(t *testing.T) {
	cleanTables(t)
	r, mock := setupRouter()

	if rec := postJSON(r, "/api/auth/otp/request", `{"email":"v@example.com"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("OTP request failed: %d", rec.Code)
	}
	code := mock.Sent()[0].Code

	rec := postJSON(r, "/api/auth/otp/verify",
		`{"email":"v@example.com","code":"`+code+`"}`)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.User.Email != "v@example.com" {
		t.Errorf("unexpected email: %s", resp.User.Email)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens in response")
	}
}

func TestVerifyOTP_401_WrongCode(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	if rec := postJSON(r, "/api/auth/otp/request", `{"email":"w@example.com"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("OTP request failed: %d", rec.Code)
	}

	rec := postJSON(r, "/api/auth/otp/verify", `{"email":"w@example.com","code":"000000"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRefreshEndpoint_200(t *testing.T) {
	cleanTables(t)
	r, mock := setupRouter()

	postJSON(r, "/api/auth/otp/request", `{"email":"r@example.com"}`)
	code := mock.Sent()[0].Code
	rec := postJSON(r, "/api/auth/otp/verify", `{"email":"r@example.com","code":"`+code+`"}`)

	var verifyResp models.AuthResponse
	_ = json.NewDecoder(rec.Body).Decode(&verifyResp)

	rec = postJSON(r, "/api/auth/refresh", `{"refresh_token":"`+verifyResp.RefreshToken+`"}`)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if resp.RefreshToken == verifyResp.RefreshToken {
		t.Error("expected rotated refresh token")
	}
}

func TestRefreshEndpoint_401(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	rec := postJSON(r, "/api/auth/refresh", `{"refresh_token":"00000000-0000-0000-0000-000000000000"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

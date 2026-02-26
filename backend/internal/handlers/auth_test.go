package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/handlers"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

var testPool *pgxpool.Pool

const testJWTSecret = "test-secret-key-for-handler-tests"

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
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
	os.Exit(code)
}

func cleanTables(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func setupRouter() (*chi.Mux, *services.AuthService) {
	authService := services.NewAuthService(testPool, testJWTSecret)
	authHandler := handlers.NewAuthHandler(authService)

	r := chi.NewRouter()
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
	})
	return r, authService
}

func TestRegisterEndpoint_201(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	body := `{"email":"handler@example.com","password":"password123","name":"Handler User"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.User.Email != "handler@example.com" {
		t.Errorf("expected email 'handler@example.com', got '%s'", resp.User.Email)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens in response")
	}
}

func TestRegisterEndpoint_409_DuplicateEmail(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	body := `{"email":"dup@example.com","password":"password123","name":"User One"}`

	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("first register expected 201, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRegisterEndpoint_422_Validation(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	body := `{"email":"bad","password":"short","name":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestLoginEndpoint_200(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	regBody := `{"email":"login@example.com","password":"password123","name":"Login User"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(regBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	loginBody := `{"email":"login@example.com","password":"password123"}`
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(loginBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected tokens in response")
	}
}

func TestLoginEndpoint_401(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	body := `{"email":"nobody@example.com","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRefreshEndpoint_200(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	regBody := `{"email":"refresh@example.com","password":"password123","name":"Refresh User"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(regBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var regResp models.AuthResponse
	_ = json.NewDecoder(rec.Body).Decode(&regResp)

	refreshBody := `{"refresh_token":"` + regResp.RefreshToken + `"}`
	req = httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewBufferString(refreshBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if resp.RefreshToken == regResp.RefreshToken {
		t.Error("expected rotated refresh token")
	}
}

func TestRefreshEndpoint_401(t *testing.T) {
	cleanTables(t)
	r, _ := setupRouter()

	body := `{"refresh_token":"00000000-0000-0000-0000-000000000000"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

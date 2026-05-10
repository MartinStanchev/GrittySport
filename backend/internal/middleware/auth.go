package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/grittyfitness/api/internal/services"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
)

func JWTAuth(authService *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeUnauthorized(w)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				writeUnauthorized(w)
				return
			}

			userID, email, err := authService.ValidateAccessToken(r.Context(), parts[1])
			if err != nil {
				writeUnauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, UserEmailKey, email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) string {
	id, _ := ctx.Value(UserIDKey).(string)
	return id
}

func GetUserEmail(ctx context.Context) string {
	email, _ := ctx.Value(UserEmailKey).(string)
	return email
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
}

// RequireConsents blocks requests from users who haven't completed the GDPR
// consent flow. The frontend uses the `consents_required` error code to route
// the user back to the consent screen. Mount under JWTAuth on every route
// group that processes user data — explicitly NOT on consent-management
// endpoints (POST /consents, GET/PUT/DELETE /users/me).
func RequireConsents(svc consentChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := GetUserID(r.Context())
			ok, err := svc.HasCompletedConsents(r.Context(), userID)
			if err != nil || !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "consents required",
					"code":  "consents_required",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// consentChecker is the slice of UserService that the middleware needs.
// Defined here as an interface so the middleware doesn't have to import
// services (which avoids package cycles in tests).
type consentChecker interface {
	HasCompletedConsents(ctx context.Context, userID string) (bool, error)
}

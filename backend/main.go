package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/handlers"
	"github.com/grittyfitness/api/internal/memory"
	appmw "github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/notifications"
	"github.com/grittyfitness/api/internal/retention"
	"github.com/grittyfitness/api/internal/review"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
)

// defaultCORSDevOrigins covers Expo web (8081/19006), Next dev (3000), and the
// API itself (8080) so local development works without setting env vars. These
// origins are unreachable from external attackers regardless of deployment.
var defaultCORSDevOrigins = []string{
	"http://localhost:8081",
	"http://localhost:19006",
	"http://localhost:19000",
	"http://localhost:3000",
	"http://localhost:8080",
	"http://127.0.0.1:8081",
	"http://127.0.0.1:19006",
	"http://127.0.0.1:3000",
}

// corsMiddleware echoes back only origins on the allowlist. Wildcard `*` is
// safe today (we use Bearer tokens, no cookies) but would become catastrophic
// if cookie auth were ever added — so we close that door now.
func corsMiddleware(allowed map[string]struct{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				}
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func parseCORSOrigins(raw string) map[string]struct{} {
	allowed := make(map[string]struct{})
	if raw == "" {
		for _, o := range defaultCORSDevOrigins {
			allowed[o] = struct{}{}
		}
		return allowed
	}
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			allowed[o] = struct{}{}
		}
	}
	return allowed
}

// weakJWTSecrets are placeholders shipped in .env.example or commonly copy-pasted
// from tutorials. Refusing them at startup prevents an operator from accidentally
// running production with a publicly-known signing key.
var weakJWTSecrets = map[string]struct{}{
	"your-secret-key-here":                          {},
	"changeme":                                      {},
	"change-me":                                     {},
	"secret":                                        {},
	"jwt-secret":                                    {},
	"please-change-in-prod":                         {},
	"replace-me-with-openssl-rand-hex-32-output":    {},
}

func validateJWTSecret(secret string) error {
	if secret == "" {
		return errJWTSecretMissing
	}
	if _, bad := weakJWTSecrets[strings.ToLower(strings.TrimSpace(secret))]; bad {
		return errJWTSecretWeak
	}
	if len(secret) < 32 {
		return errJWTSecretTooShort
	}
	return nil
}

var (
	errJWTSecretMissing  = errors.New("JWT_SECRET environment variable is required")
	errJWTSecretTooShort = errors.New("JWT_SECRET must be at least 32 characters of high-entropy random data")
	errJWTSecretWeak     = errors.New("JWT_SECRET matches a known placeholder value — generate a fresh secret (e.g. `openssl rand -hex 32`)")
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if err := validateJWTSecret(jwtSecret); err != nil {
		log.Fatal().Err(err).Msg("invalid JWT_SECRET")
	}

	corsAllowed := parseCORSOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	if geminiAPIKey == "" {
		log.Fatal().Msg("GEMINI_API_KEY environment variable is required")
	}

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "../db/migrations"
	}

	promptsPath := os.Getenv("PROMPTS_PATH")
	if promptsPath == "" {
		promptsPath = "./prompts"
	}

	ctx := context.Background()

	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer pool.Close()

	if err := db.RunMigrations(ctx, pool, migrationsPath); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}

	geminiClient, err := ai.NewGeminiClient(ctx, geminiAPIKey)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize Gemini client")
	}

	promptLoader, err := ai.LoadPrompts(promptsPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load prompts")
	}

	skillLoader, err := ai.LoadSkills(promptsPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load skills")
	}

	mailer, err := email.New(email.Config{
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		From:         envOrDefault("EMAIL_FROM", "Gritty Fitness <noreply@grittyfitness.app>"),
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize email sender")
	}
	refreshTTL := time.Duration(envInt("REFRESH_TOKEN_TTL_DAYS", 180)) * 24 * time.Hour

	authService := services.NewAuthService(pool, jwtSecret, mailer, refreshTTL)
	authHandler := handlers.NewAuthHandler(authService)

	userService := services.NewUserService(pool)
	exportService := services.NewExportService(pool)
	usageService := usage.NewService(pool)
	userHandler := handlers.NewUserHandler(userService, usageService, exportService)

	consentService := services.NewConsentService(pool)
	consentHandler := handlers.NewConsentHandler(consentService)

	wishlistService := services.NewWishlistService(pool, mailer, os.Getenv("WISHLIST_NOTIFY_TO"))
	wishlistHandler := handlers.NewWishlistHandler(wishlistService)

	chatService := services.NewChatService(pool)
	memoryService := memory.NewService(pool, geminiClient)
	reminderService := services.NewReminderService(pool)

	programService := services.NewProgramService(pool)
	programHandler := handlers.NewProgramHandler(programService, chatService, memoryService, usageService)
	chatHandler := handlers.NewChatHandler(chatService, geminiClient, userService, authService, programService, promptLoader, skillLoader, memoryService, usageService, reminderService, corsAllowed)

	workoutService := services.NewWorkoutService(pool)

	notifService := notifications.NewService(pool, usageService)
	notifHandler := handlers.NewNotificationHandler(notifService, usageService)

	reviewService := review.NewService(pool, chatService, workoutService, programService, geminiClient, memoryService, notifService, promptLoader.ReviewPrompt(), promptLoader.MissedPrompt())

	// Start missed workout checker
	missedChecker := review.NewMissedWorkoutChecker(pool, reviewService, usageService)
	go missedChecker.Run(ctx)

	// Start workout reminder scheduler
	reminderScheduler := review.NewReminderScheduler(pool, notifService)
	go reminderScheduler.Run(ctx)

	// Start user-scheduled reminder checker (set_reminder tool)
	userReminderChecker := review.NewUserReminderChecker(chatService, reminderService, notifService, memoryService)
	go userReminderChecker.Run(ctx)

	factDecay := memory.NewFactDecayScheduler(memoryService)
	go factDecay.Run(ctx)

	retentionScheduler := retention.NewScheduler(pool)
	go retentionScheduler.Run(ctx)

	workoutHandler := handlers.NewWorkoutHandler(workoutService, reviewService, usageService, pool)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(appmw.RequestLogger)
	r.Use(chimw.Recoverer)
	r.Use(appmw.SecurityHeaders)
	r.Use(appmw.BodyLimit(8 << 20))
	r.Use(corsMiddleware(corsAllowed))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Per-IP token bucket: 30-req burst, then 1 every 2s. Stops the OTP
	// mail-bomb (per-email limiter is bypassed by cycling fresh emails) and
	// brute-force against /verify and /refresh.
	authLimiter := appmw.NewIPRateLimiter(0.5, 30)
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(authLimiter.Middleware)
		r.Post("/otp/request", authHandler.RequestOTP)
		r.Post("/otp/verify", authHandler.VerifyOTP)
		r.Post("/refresh", authHandler.Refresh)
	})

	// Public wishlist endpoint — heavily rate-limited since each call can
	// trigger a Resend email to the operator. 5-req burst, then 1 every 30s
	// is plenty for legitimate users (each one signs up at most once).
	wishlistLimiter := appmw.NewIPRateLimiter(1.0/30.0, 5)
	r.With(wishlistLimiter.Middleware).Post("/api/wishlist", wishlistHandler.Subscribe)

	// WebSocket endpoint — auth via query param, outside JWT middleware
	r.Get("/api/ws/chat", chatHandler.WebSocket)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(appmw.JWTAuth(authService))

		// Consent-exempt endpoints: a freshly-verified user must be able to
		// fetch their own profile, accept consents, or delete the account
		// before any data-bearing routes unlock.
		r.Get("/users/me", userHandler.GetMe)
		r.Put("/users/me", userHandler.UpdateMe)
		r.Delete("/users/me", userHandler.DeleteMe)
		r.Post("/consents", consentHandler.Record)

		// Everything else requires consents_completed_at IS NOT NULL.
		r.Group(func(r chi.Router) {
			r.Use(appmw.RequireConsents(userService))

			r.Get("/users/me/usage", userHandler.GetUsage)
			r.Get("/users/me/export", userHandler.ExportData)
			r.Post("/auth/revoke-all", authHandler.RevokeAll)
			r.Get("/chat/history", chatHandler.History)
			r.Delete("/chat/history", chatHandler.DeleteChat)
			r.Delete("/chat/memory", chatHandler.DeleteMemory)

			r.Post("/programs", programHandler.Create)
			r.Get("/programs", programHandler.List)
			r.Get("/programs/{id}", programHandler.Get)
			r.Put("/programs/{id}", programHandler.Update)
			r.Delete("/programs/{id}", programHandler.Delete)
			r.Get("/programs/{id}/criteria", programHandler.GetCriteria)
			r.Put("/programs/{id}/criteria", programHandler.UpdateCriteria)
			r.Get("/activities/upcoming", programHandler.GetUpcoming)
			r.Get("/activities/linkable", programHandler.GetLinkable)
			r.Get("/activities/{activityId}", programHandler.GetActivity)
			r.Post("/programs/{id}/weeks/{weekId}/activities", programHandler.CreateActivity)
			r.Put("/programs/{id}/activities/{activityId}", programHandler.UpdateActivity)

			r.Post("/devices/push-token", notifHandler.RegisterToken)
			r.Delete("/devices/push-token", notifHandler.DeleteToken)
			r.Get("/notifications/types", notifHandler.ListTypes)
			r.Put("/notifications/preferences/{type}", notifHandler.UpdatePreference)

			r.Post("/workouts", workoutHandler.Create)
			r.Get("/workouts", workoutHandler.List)
			r.Get("/workouts/weekly-effort", workoutHandler.WeeklyEffort)
			r.Get("/workouts/{workoutId}", workoutHandler.Get)
			r.Delete("/workouts/{workoutId}", workoutHandler.Delete)
			r.Put("/workouts/{workoutId}/link", workoutHandler.Link)
			r.Get("/workouts/{workoutId}/analytics", workoutHandler.Analytics)
			r.Get("/workouts/{workoutId}/review", workoutHandler.GetReview)
			r.Post("/workouts/{workoutId}/review/trigger", workoutHandler.TriggerReview)
		})
	})

	// ReadHeaderTimeout defends against Slowloris (clients dribbling headers).
	// ReadTimeout / WriteTimeout are bounded but generous enough for large
	// workout uploads and GDPR export responses. IdleTimeout caps keep-alive
	// sockets. Timeouts do not apply to a WebSocket connection after the
	// hijack, so chat sessions are unaffected.
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Info().Str("port", port).Msg("Starting server")
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal().Err(err).Msg("Server failed to start")
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

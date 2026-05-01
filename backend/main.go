package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/handlers"
	"github.com/grittyfitness/api/internal/memory"
	appmw "github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/notifications"
	"github.com/grittyfitness/api/internal/review"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal().Msg("JWT_SECRET environment variable is required")
	}

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

	authService := services.NewAuthService(pool, jwtSecret)
	authHandler := handlers.NewAuthHandler(authService)

	userService := services.NewUserService(pool)
	usageService := usage.NewService(pool)
	userHandler := handlers.NewUserHandler(userService, usageService)

	chatService := services.NewChatService(pool)
	memoryService := memory.NewService(pool, geminiClient)

	programService := services.NewProgramService(pool)
	programHandler := handlers.NewProgramHandler(programService, chatService, memoryService, usageService)
	chatHandler := handlers.NewChatHandler(chatService, geminiClient, userService, authService, programService, promptLoader, skillLoader, memoryService, usageService)

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

	factDecay := memory.NewFactDecayScheduler(memoryService)
	go factDecay.Run(ctx)

	workoutHandler := handlers.NewWorkoutHandler(workoutService, reviewService, usageService, pool)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
	})

	// WebSocket endpoint — auth via query param, outside JWT middleware
	r.Get("/api/ws/chat", chatHandler.WebSocket)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(appmw.JWTAuth(authService))
		r.Get("/users/me", userHandler.GetMe)
		r.Put("/users/me", userHandler.UpdateMe)
		r.Get("/users/me/usage", userHandler.GetUsage)
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

	log.Info().Str("port", port).Msg("Starting server")
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal().Err(err).Msg("Server failed to start")
	}
}

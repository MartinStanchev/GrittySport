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
	appmw "github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
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

	authService := services.NewAuthService(pool, jwtSecret)
	authHandler := handlers.NewAuthHandler(authService)

	userService := services.NewUserService(pool)
	userHandler := handlers.NewUserHandler(userService)

	chatMemoryEnabled := os.Getenv("ENABLE_CHAT_MEMORY") == "true"
	log.Info().Bool("chat_memory", chatMemoryEnabled).Msg("Feature flags")

	chatService := services.NewChatService(pool)

	programService := services.NewProgramService(pool)
	programHandler := handlers.NewProgramHandler(programService, chatService)
	chatHandler := handlers.NewChatHandler(chatService, geminiClient, userService, authService, programService, promptLoader, chatMemoryEnabled)

	workoutService := services.NewWorkoutService(pool)
	workoutHandler := handlers.NewWorkoutHandler(workoutService)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
		r.Get("/chat/history", chatHandler.History)
		r.Delete("/chat/memory", chatHandler.ClearMemory)

		r.Get("/programs", programHandler.List)
		r.Get("/programs/{id}", programHandler.Get)
		r.Put("/programs/{id}", programHandler.Update)
		r.Delete("/programs/{id}", programHandler.Delete)
		r.Get("/programs/{id}/criteria", programHandler.GetCriteria)
		r.Put("/programs/{id}/criteria", programHandler.UpdateCriteria)
		r.Get("/activities/upcoming", programHandler.GetUpcoming)
		r.Get("/activities/{activityId}", programHandler.GetActivity)
		r.Post("/programs/{id}/weeks/{weekId}/activities", programHandler.CreateActivity)
		r.Put("/programs/{id}/activities/{activityId}", programHandler.UpdateActivity)

		r.Post("/workouts", workoutHandler.Create)
		r.Get("/workouts", workoutHandler.List)
		r.Get("/workouts/{workoutId}", workoutHandler.Get)
		r.Put("/workouts/{workoutId}/link", workoutHandler.Link)
	})

	log.Info().Str("port", port).Msg("Starting server")
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal().Err(err).Msg("Server failed to start")
	}
}

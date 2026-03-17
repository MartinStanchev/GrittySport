package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/review"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
)

type WorkoutHandler struct {
	workoutService *services.WorkoutService
	reviewService  *review.Service
	usageService   *usage.Service
	pool           *pgxpool.Pool
}

func NewWorkoutHandler(
	workoutService *services.WorkoutService,
	reviewService *review.Service,
	usageService *usage.Service,
	pool *pgxpool.Pool,
) *WorkoutHandler {
	return &WorkoutHandler{
		workoutService: workoutService,
		reviewService:  reviewService,
		usageService:   usageService,
		pool:           pool,
	}
}

func (h *WorkoutHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input models.SaveWorkoutInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.ActivityType == "" {
		writeError(w, http.StatusBadRequest, "activity_type is required")
		return
	}
	if input.StartedAt == "" {
		writeError(w, http.StatusBadRequest, "started_at is required")
		return
	}

	// Compute effort score if HR data and finished_at are available
	if len(input.HeartRateData) > 0 && input.FinishedAt != nil {
		startedAt, err1 := time.Parse(time.RFC3339, input.StartedAt)
		finishedAt, err2 := time.Parse(time.RFC3339, *input.FinishedAt)
		if err1 == nil && err2 == nil {
			durationSec := finishedAt.Sub(startedAt).Seconds()
			if durationSec > 0 {
				maxHR := h.getUserMaxHR(r.Context(), userID)
				score := review.ComputeEffortScore(input.HeartRateData, maxHR, durationSec)
				input.EffortScore = &score
			}
		}
	}

	workout, err := h.workoutService.Create(r.Context(), userID, input)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Str("source", input.Source).Msg("failed to save workout")
		writeError(w, http.StatusInternalServerError, "failed to save workout")
		return
	}

	// Trigger post-workout review async (non-blocking).
	// Use a detached context — the HTTP request context is cancelled after response.
	if h.reviewService != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			allowed, _, _ := h.usageService.CheckAndIncrement(ctx, userID, "post_workout_review")
			if !allowed {
				log.Debug().Str("user_id", userID).Msg("Post-workout review skipped: free tier limit reached")
				return
			}
			if err := h.reviewService.TriggerReview(ctx, userID, workout.ID); err != nil {
				log.Error().Err(err).Str("workout_id", workout.ID).Msg("Post-workout review failed")
			}
		}()
	}

	writeJSON(w, http.StatusCreated, workout)
}

func (h *WorkoutHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	filter := models.WorkoutListFilter{
		Limit:  20,
		Offset: 0,
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			filter.Limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			filter.Offset = v
		}
	}
	filter.ActivityType = r.URL.Query().Get("activity_type")

	if sd := r.URL.Query().Get("start_date"); sd != "" {
		if t, err := time.Parse("2006-01-02", sd); err == nil {
			filter.StartDate = &t
		}
	}
	if ed := r.URL.Query().Get("end_date"); ed != "" {
		if t, err := time.Parse("2006-01-02", ed); err == nil {
			endOfDay := t.AddDate(0, 0, 1) // exclusive upper bound
			filter.EndDate = &endOfDay
		}
	}

	workouts, err := h.workoutService.ListByUser(r.Context(), userID, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list workouts")
		return
	}

	writeJSON(w, http.StatusOK, workouts)
}

func (h *WorkoutHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	workoutID := chi.URLParam(r, "workoutId")

	workout, err := h.workoutService.GetByID(r.Context(), workoutID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "workout not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get workout")
		return
	}

	writeJSON(w, http.StatusOK, workout)
}

func (h *WorkoutHandler) Link(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	workoutID := chi.URLParam(r, "workoutId")

	var body struct {
		ScheduledActivityID string `json:"scheduled_activity_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ScheduledActivityID == "" {
		writeError(w, http.StatusBadRequest, "scheduled_activity_id is required")
		return
	}

	if err := h.workoutService.LinkToActivity(r.Context(), workoutID, body.ScheduledActivityID, userID); err != nil {
		if err.Error() == "workout not found" {
			writeError(w, http.StatusNotFound, "workout not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to link workout")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

const defaultMaxHR = 185

func (h *WorkoutHandler) getUserMaxHR(ctx context.Context, userID string) int {
	var maxHR int
	_ = h.pool.QueryRow(ctx, "SELECT max_heart_rate FROM users WHERE id = $1", userID).Scan(&maxHR)
	if maxHR <= 0 {
		return defaultMaxHR
	}
	return maxHR
}

// WeeklyEffort returns aggregated effort score for the current week.
func (h *WorkoutHandler) WeeklyEffort(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var totalEffort int
	var workoutCount int
	var goal int
	err := h.pool.QueryRow(r.Context(),
		`SELECT
		   (SELECT COALESCE(SUM(effort_score), 0) FROM workouts WHERE user_id = $1 AND started_at >= date_trunc('week', NOW()) AND effort_score IS NOT NULL),
		   (SELECT COUNT(*) FROM workouts WHERE user_id = $1 AND started_at >= date_trunc('week', NOW()) AND effort_score IS NOT NULL),
		   weekly_effort_goal
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&totalEffort, &workoutCount, &goal)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query weekly effort")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{
		"total_effort":  totalEffort,
		"workout_count": workoutCount,
		"goal":          goal,
	})
}

// Analytics returns computed premium analytics for a workout.
func (h *WorkoutHandler) Analytics(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	workoutID := chi.URLParam(r, "workoutId")

	// Tier check — free users get 403
	tier, err := h.usageService.GetTier(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check tier")
		return
	}
	if tier != usage.TierPremium {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":            "upgrade_required",
			"message":          "Premium subscription required for workout analytics",
			"upgrade_required": true,
		})
		return
	}

	workout, err := h.workoutService.GetByID(r.Context(), workoutID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "workout not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get workout")
		return
	}

	maxHR := h.getUserMaxHR(r.Context(), userID)
	analytics, err := review.ComputeAnalytics(r.Context(), h.pool, workout, maxHR)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to compute analytics")
		return
	}

	writeJSON(w, http.StatusOK, analytics)
}

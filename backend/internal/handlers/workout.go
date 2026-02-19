package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

type WorkoutHandler struct {
	workoutService *services.WorkoutService
}

func NewWorkoutHandler(workoutService *services.WorkoutService) *WorkoutHandler {
	return &WorkoutHandler{workoutService: workoutService}
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

	workout, err := h.workoutService.Create(r.Context(), userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save workout")
		return
	}

	writeJSON(w, http.StatusCreated, workout)
}

func (h *WorkoutHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}
	activityType := r.URL.Query().Get("activity_type")

	workouts, err := h.workoutService.ListByUser(r.Context(), userID, limit, offset, activityType)
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

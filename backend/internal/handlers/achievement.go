package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/grittyfitness/api/internal/achievements"
	"github.com/grittyfitness/api/internal/middleware"
)

type AchievementHandler struct {
	service *achievements.Service
}

func NewAchievementHandler(service *achievements.Service) *AchievementHandler {
	return &AchievementHandler{service: service}
}

// List returns the user's trophy room, newest first.
func (h *AchievementHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	list, err := h.service.List(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list achievements")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// Create pins a workout to the trophy room as a manual achievement.
func (h *AchievementHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var body struct {
		WorkoutID string `json:"workout_id"`
		Title     string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.WorkoutID == "" {
		writeError(w, http.StatusBadRequest, "workout_id is required")
		return
	}

	achievement, err := h.service.CreateManual(r.Context(), userID, body.WorkoutID, body.Title)
	if err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "workout not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to pin achievement")
		return
	}
	writeJSON(w, http.StatusCreated, achievement)
}

// Delete removes an achievement from the trophy room.
func (h *AchievementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	if err := h.service.Delete(r.Context(), userID, id); err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "achievement not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete achievement")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

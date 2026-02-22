package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

type ProgramHandler struct {
	programService *services.ProgramService
	chatService    *services.ChatService
}

func NewProgramHandler(programService *services.ProgramService, chatService *services.ChatService) *ProgramHandler {
	return &ProgramHandler{programService: programService, chatService: chatService}
}

func (h *ProgramHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programs, err := h.programService.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list programs")
		return
	}
	writeJSON(w, http.StatusOK, programs)
}

func (h *ProgramHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")

	program, err := h.programService.GetByID(r.Context(), programID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "program not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get program")
		return
	}
	writeJSON(w, http.StatusOK, program)
}

func (h *ProgramHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")

	var input models.UpdateProgramInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.Status != nil {
		valid := map[string]bool{"active": true, "archived": true, "draft": true}
		if !valid[*input.Status] {
			writeError(w, http.StatusBadRequest, "invalid status")
			return
		}
	}

	program, err := h.programService.UpdateProgram(r.Context(), programID, userID, input)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "program not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update program")
		return
	}
	writeJSON(w, http.StatusOK, program)
}

func (h *ProgramHandler) GetCriteria(w http.ResponseWriter, r *http.Request) {
	programID := chi.URLParam(r, "id")

	criteria, err := h.programService.GetCriteria(r.Context(), programID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get criteria")
		return
	}

	responses := make([]models.ProgramCriterionResponse, len(criteria))
	for i, c := range criteria {
		responses[i] = c.ToResponse()
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *ProgramHandler) UpdateCriteria(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")

	// Fetch old criteria for diff before update
	oldCriteria, _ := h.programService.GetCriteria(r.Context(), programID)

	var input []models.SaveCriterionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	criteria, err := h.programService.UpsertCriteria(r.Context(), programID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update criteria")
		return
	}

	// Notify Grit of settings changes
	if diff := buildCriteriaDiff(oldCriteria, input); diff != "" {
		content := fmt.Sprintf(
			"The user manually updated their program settings. Changes: %s. Take this into account in future coaching.",
			diff,
		)
		_, _ = h.chatService.SaveMessage(r.Context(), userID, "system", content, "free_chat", nil, nil)
	}

	responses := make([]models.ProgramCriterionResponse, len(criteria))
	for i, c := range criteria {
		responses[i] = c.ToResponse()
	}
	writeJSON(w, http.StatusOK, responses)
}

func buildCriteriaDiff(old []models.ProgramCriterion, updated []models.SaveCriterionInput) string {
	oldMap := make(map[string]string, len(old))
	for _, c := range old {
		oldMap[c.Key] = c.Value
	}
	var changes []string
	for _, c := range updated {
		if prev, ok := oldMap[c.Key]; ok && prev != c.Value {
			changes = append(changes, fmt.Sprintf("%s changed from '%s' to '%s' manually by the user", c.Label, prev, c.Value))
		}
	}
	return strings.Join(changes, ", ")
}

func (h *ProgramHandler) GetUpcoming(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	activities, err := h.programService.GetUpcomingActivities(r.Context(), userID, 5)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get upcoming activities")
		return
	}
	writeJSON(w, http.StatusOK, activities)
}

func (h *ProgramHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	activityID := chi.URLParam(r, "activityId")

	activity, err := h.programService.GetActivityDetail(r.Context(), activityID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity")
		return
	}
	if activity.UserID != userID {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}
	writeJSON(w, http.StatusOK, activity)
}

func (h *ProgramHandler) CreateActivity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")
	weekID := chi.URLParam(r, "weekId")

	var input models.SaveActivityInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.ActivityType == "" {
		writeError(w, http.StatusBadRequest, "activity_type is required")
		return
	}
	if input.DayOfWeek < 0 || input.DayOfWeek > 6 {
		writeError(w, http.StatusBadRequest, "day_of_week must be 0-6")
		return
	}

	activity, err := h.programService.CreateActivity(r.Context(), programID, weekID, userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create activity")
		return
	}
	writeJSON(w, http.StatusCreated, activity)
}

func (h *ProgramHandler) UpdateActivity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")
	activityID := chi.URLParam(r, "activityId")

	// Fetch old state for diff
	oldActivity, err := h.programService.GetActivityDetail(r.Context(), activityID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity")
		return
	}
	if oldActivity.UserID != userID || oldActivity.ProgramID != programID {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}

	var input models.UpdateActivityInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.DayOfWeek != nil && (*input.DayOfWeek < 0 || *input.DayOfWeek > 6) {
		writeError(w, http.StatusBadRequest, "day_of_week must be 0-6")
		return
	}

	updated, err := h.programService.UpdateActivity(r.Context(), programID, activityID, userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update activity")
		return
	}

	// Build diff and insert system message for Grit
	diff := buildActivityDiff(oldActivity, input)
	if diff != "" {
		content := fmt.Sprintf(
			"The user manually edited the activity '%s' on %s. Changes: %s. Take this into account in future conversations.",
			updated.ActivityType, updated.Date, diff,
		)
		_, _ = h.chatService.SaveMessage(r.Context(), userID, "system", content, "free_chat", nil, nil)
	}

	writeJSON(w, http.StatusOK, updated)
}

func buildActivityDiff(old *models.ActivityDetailResponse, input models.UpdateActivityInput) string {
	var changes []string
	if input.Prescription != nil {
		changes = append(changes, "prescription updated")
	}
	if input.Notes != nil {
		changes = append(changes, "notes updated")
	}
	if input.DayOfWeek != nil && *input.DayOfWeek != old.DayOfWeek {
		changes = append(changes, fmt.Sprintf("day changed from %s to %s", dayName(old.DayOfWeek), dayName(*input.DayOfWeek)))
	}
	if input.ActivityType != nil && *input.ActivityType != old.ActivityType {
		changes = append(changes, fmt.Sprintf("type changed from '%s' to '%s'", old.ActivityType, *input.ActivityType))
	}
	return strings.Join(changes, ", ")
}

func (h *ProgramHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")
	err := h.programService.DeleteProgram(r.Context(), programID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "program not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete program")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func dayName(d int) string {
	days := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	if d >= 0 && d < len(days) {
		return days[d]
	}
	return fmt.Sprintf("day %d", d)
}

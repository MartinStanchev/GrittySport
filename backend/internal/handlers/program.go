package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/memory"
	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
	"github.com/grittyfitness/api/internal/validate"
)

type ProgramHandler struct {
	programService *services.ProgramService
	chatService    *services.ChatService
	memoryService  *memory.Service
	usageService   *usage.Service
}

func NewProgramHandler(programService *services.ProgramService, chatService *services.ChatService, memoryService *memory.Service, usageSvc *usage.Service) *ProgramHandler {
	return &ProgramHandler{
		programService: programService,
		chatService:    chatService,
		memoryService:  memoryService,
		usageService:   usageSvc,
	}
}

func (h *ProgramHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	// No active program limit check here — SaveProgramWithCriteria archives
	// the existing active program, so this always results in at most 1 active program.

	var input models.TemplateProgramInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validate.String("name", input.Name, validate.MaxNameLen); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if input.StartDate == "" {
		writeError(w, http.StatusBadRequest, "start_date is required")
		return
	}
	if err := validate.OptionalString("goal_description", input.GoalDescription, validate.MaxNotesLen); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(input.Phases) == 0 {
		writeError(w, http.StatusBadRequest, "at least one phase is required")
		return
	}
	if len(input.Phases) > 12 {
		writeError(w, http.StatusBadRequest, "at most 12 phases are allowed")
		return
	}
	for i, phase := range input.Phases {
		if err := validate.OptionalString(fmt.Sprintf("phases[%d].name", i), phase.Name, validate.MaxNameLen); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		for j, act := range phase.TemplateWeek.Activities {
			if err := validate.OptionalString(fmt.Sprintf("phases[%d].activities[%d].notes", i, j), act.Notes, validate.MaxNotesLen); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
		}
	}

	programInput := models.ExpandTemplatesToSaveInput(input)
	programInput.CreatedBy = "user"

	result, err := h.programService.SaveProgramWithCriteria(r.Context(), userID, programInput, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create program")
		return
	}
	writeJSON(w, http.StatusCreated, result)
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

	if input.Name != nil {
		if err := validate.String("name", *input.Name, validate.MaxNameLen); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if input.Status != nil {
		switch *input.Status {
		case "active", "archived", "draft":
		default:
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
	userID := middleware.GetUserID(r.Context())
	programID := chi.URLParam(r, "id")

	criteria, err := h.programService.GetCriteria(r.Context(), programID, userID)
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
	oldCriteria, _ := h.programService.GetCriteria(r.Context(), programID, userID)

	var input []models.SaveCriterionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(input) > 50 {
		writeError(w, http.StatusBadRequest, "at most 50 criteria are allowed")
		return
	}
	for i, c := range input {
		if err := validate.String(fmt.Sprintf("criteria[%d].key", i), c.Key, 100); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := validate.OptionalString(fmt.Sprintf("criteria[%d].label", i), c.Label, validate.MaxCriterionLabelLen); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := validate.OptionalString(fmt.Sprintf("criteria[%d].value", i), c.Value, validate.MaxCriterionValueLen); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	criteria, err := h.programService.UpsertCriteria(r.Context(), programID, userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update criteria")
		return
	}

	// Notify Grit of settings changes (system message for context) and surface
	// the edit as a header-only segment in the chat timeline.
	if diff := buildCriteriaDiff(oldCriteria, input); diff != "" {
		content := fmt.Sprintf(
			"The user manually updated their program settings. Changes: %s. Take this into account in future coaching.",
			diff,
		)
		if msg, err := h.chatService.SaveMessage(r.Context(), userID, "system", content, nil, nil); err == nil {
			h.recordManualEditEvent(r.Context(), userID, msg.ID, models.SegmentHeader{
				Label:    "Updated program settings",
				Subtitle: diff,
				RefType:  "program",
				RefID:    programID,
			})
		}
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

	activities, err := h.programService.GetUpcomingActivities(r.Context(), userID, 6)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get upcoming activities")
		return
	}
	writeJSON(w, http.StatusOK, activities)
}

func (h *ProgramHandler) GetLinkable(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	activityType := strings.TrimSpace(r.URL.Query().Get("activity_type"))
	if activityType == "" {
		writeError(w, http.StatusBadRequest, "activity_type is required")
		return
	}

	refDate := time.Now().UTC()
	if rd := r.URL.Query().Get("reference_date"); rd != "" {
		t, err := time.Parse("2006-01-02", rd)
		if err != nil {
			writeError(w, http.StatusBadRequest, "reference_date must be YYYY-MM-DD")
			return
		}
		refDate = t
	}

	windowDays := 3
	if wd := r.URL.Query().Get("window_days"); wd != "" {
		n, err := strconv.Atoi(wd)
		if err != nil || n <= 0 || n > 14 {
			writeError(w, http.StatusBadRequest, "window_days must be 1-14")
			return
		}
		windowDays = n
	}

	activities, err := h.programService.GetLinkableActivities(r.Context(), userID, activityType, refDate, windowDays)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get linkable activities")
		return
	}
	if activities == nil {
		activities = []models.LinkableActivityResponse{}
	}
	writeJSON(w, http.StatusOK, activities)
}

func (h *ProgramHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	activityID := chi.URLParam(r, "activityId")

	activity, err := h.programService.GetActivityDetail(r.Context(), activityID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity")
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

	// Fetch old state for diff. SQL is scoped by userID; the programID check
	// guards the URL contract (activity must belong to the program in the path).
	oldActivity, err := h.programService.GetActivityDetail(r.Context(), activityID, userID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "activity not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get activity")
		return
	}
	if oldActivity.ProgramID != programID {
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

	// Build diff and insert system message for Grit, plus a header-only
	// segment so the edit shows up as context in the chat timeline.
	diff := buildActivityDiff(oldActivity, input)
	if diff != "" {
		content := fmt.Sprintf(
			"The user manually edited the activity '%s' on %s. Changes: %s. Take this into account in future conversations.",
			updated.ActivityType, updated.Date, diff,
		)
		if msg, err := h.chatService.SaveMessage(r.Context(), userID, "system", content, nil, nil); err == nil {
			h.recordManualEditEvent(r.Context(), userID, msg.ID, models.SegmentHeader{
				Label:    fmt.Sprintf("Edited %s · %s", updated.ActivityType, updated.Date),
				Subtitle: diff,
				RefType:  "activity",
				RefID:    activityID,
			})
		}
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

// recordManualEditEvent inserts a header-only chat segment so manual program
// edits surface as a "you edited X" cue in the timeline. Best-effort — any
// error is logged but does not fail the edit request.
func (h *ProgramHandler) recordManualEditEvent(ctx context.Context, userID, anchorMessageID string, header models.SegmentHeader) {
	if h.memoryService == nil {
		return
	}
	if _, err := h.memoryService.RecordEvent(ctx, userID, "manual_edit", anchorMessageID, header.Marshal()); err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Failed to record manual edit event segment")
	}
}

func dayName(d int) string {
	days := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	if d >= 0 && d < len(days) {
		return days[d]
	}
	return fmt.Sprintf("day %d", d)
}

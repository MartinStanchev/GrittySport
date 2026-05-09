package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
	"github.com/grittyfitness/api/internal/validate"
)

type UserHandler struct {
	userService   *services.UserService
	usageService  *usage.Service
	exportService *services.ExportService
}

func NewUserHandler(userService *services.UserService, usageSvc *usage.Service, exportSvc *services.ExportService) *UserHandler {
	return &UserHandler{userService: userService, usageService: usageSvc, exportService: exportSvc}
}

func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.userService.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input services.UpdateUserInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validateUpdateUserInput(input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.userService.Update(r.Context(), userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// validateUpdateUserInput enforces bounds on every optional field so that
// user-supplied data never reaches the DB or the LLM prompts unchecked.
func validateUpdateUserInput(in services.UpdateUserInput) error {
	if in.Name != nil {
		if err := validate.OptionalString("name", *in.Name, validate.MaxNameLen); err != nil {
			return err
		}
	}
	if in.Timezone != nil {
		if err := validate.Timezone(*in.Timezone); err != nil {
			return err
		}
	}
	if in.UnitsPreference != nil {
		switch *in.UnitsPreference {
		case "metric", "imperial":
		default:
			return errors.New("units_preference must be 'metric' or 'imperial'")
		}
	}
	if in.MaxHeartRate != nil {
		if err := validate.IntRange("max_heart_rate", *in.MaxHeartRate, validate.MinHeartRate, validate.MaxHeartRate); err != nil {
			return err
		}
	}
	if in.WeeklyEffortGoal != nil {
		if err := validate.IntRange("weekly_effort_goal", *in.WeeklyEffortGoal, validate.MinWeeklyEffortGoal, validate.MaxWeeklyEffortGoal); err != nil {
			return err
		}
	}
	if in.BirthYear != nil {
		if err := validate.BirthYear(*in.BirthYear); err != nil {
			return err
		}
	}
	if in.HeightCm != nil {
		if err := validate.FloatRange("height_cm", *in.HeightCm, validate.MinHeightCm, validate.MaxHeightCm); err != nil {
			return err
		}
	}
	if in.WeightKg != nil {
		if err := validate.FloatRange("weight_kg", *in.WeightKg, validate.MinWeightKg, validate.MaxWeightKg); err != nil {
			return err
		}
	}
	return nil
}

func (h *UserHandler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.userService.Delete(r.Context(), userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Str("user_id", userID).Msg("delete account failed")
		writeError(w, http.StatusInternalServerError, "failed to delete account")
		return
	}
	log.Info().Str("user_id", userID).Msg("account deleted")
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) GetUsage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	summary, err := h.usageService.GetUsage(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get usage")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// ExportData returns a JSON archive of every user-scoped row (GDPR Art. 15
// access + Art. 20 portability). Served as a downloadable attachment so the
// client can save it directly.
func (h *UserHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	payload, err := h.exportService.Export(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("data export failed")
		writeError(w, http.StatusInternalServerError, "failed to export data")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="gritty-fitness-data.json"`)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("data export encode failed")
	}
}

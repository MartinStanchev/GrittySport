package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/notifications"
	"github.com/grittyfitness/api/internal/usage"
	"github.com/grittyfitness/api/internal/validate"
)

// NotificationHandler handles push token registration and notification preferences.
type NotificationHandler struct {
	notifService *notifications.Service
	usageService *usage.Service
}

// NewNotificationHandler creates a new notification handler.
func NewNotificationHandler(notifSvc *notifications.Service, usageSvc *usage.Service) *NotificationHandler {
	return &NotificationHandler{notifService: notifSvc, usageService: usageSvc}
}

// RegisterToken handles POST /api/v1/devices/push-token.
func (h *NotificationHandler) RegisterToken(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validate.String("token", input.Token, validate.MaxPushTokenLen); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if input.Platform != "ios" && input.Platform != "android" {
		writeError(w, http.StatusBadRequest, "platform must be ios or android")
		return
	}

	if err := h.notifService.SaveToken(r.Context(), userID, input.Token, input.Platform); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save push token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteToken handles DELETE /api/v1/devices/push-token.
func (h *NotificationHandler) DeleteToken(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validate.String("token", input.Token, validate.MaxPushTokenLen); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.notifService.DeleteToken(r.Context(), userID, input.Token); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete push token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// notifTypeResponse is a single notification type returned to the frontend.
type notifTypeResponse struct {
	Key             string `json:"key"`
	Label           string `json:"label"`
	Description     string `json:"description"`
	RequiresPremium bool   `json:"requires_premium"`
	Enabled         bool   `json:"enabled"`
}

// ListTypes handles GET /api/v1/notifications/types.
// Returns all notification types with the user's current preference.
func (h *NotificationHandler) ListTypes(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	prefs, err := h.notifService.GetPreferences(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load preferences")
		return
	}

	tier, _ := h.usageService.GetTier(r.Context(), userID)

	result := make([]notifTypeResponse, 0, len(notifications.Registry))
	for _, nt := range notifications.Registry {
		enabled := prefs[nt.Key]
		// If the type requires premium and user is free, force disabled
		if nt.RequiresPremium && tier != usage.TierPremium {
			enabled = false
		}
		result = append(result, notifTypeResponse{
			Key:             nt.Key,
			Label:           nt.Label,
			Description:     nt.Description,
			RequiresPremium: nt.RequiresPremium,
			Enabled:         enabled,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// UpdatePreference handles PUT /api/v1/notifications/preferences/{type}.
func (h *NotificationHandler) UpdatePreference(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	notifType := chi.URLParam(r, "type")

	nt, ok := notifications.Lookup(notifType)
	if !ok {
		writeError(w, http.StatusBadRequest, "unknown notification type")
		return
	}

	// Check premium gating
	if nt.RequiresPremium {
		tier, _ := h.usageService.GetTier(r.Context(), userID)
		if tier != usage.TierPremium {
			writeError(w, http.StatusForbidden, "this notification type requires premium")
			return
		}
	}

	var input struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.notifService.SetPreference(r.Context(), userID, notifType, input.Enabled); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update preference")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

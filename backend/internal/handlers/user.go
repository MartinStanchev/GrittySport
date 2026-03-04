package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
)

type UserHandler struct {
	userService  *services.UserService
	usageService *usage.Service
}

func NewUserHandler(userService *services.UserService, usageSvc *usage.Service) *UserHandler {
	return &UserHandler{userService: userService, usageService: usageSvc}
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

	user, err := h.userService.Update(r.Context(), userID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	writeJSON(w, http.StatusOK, user)
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

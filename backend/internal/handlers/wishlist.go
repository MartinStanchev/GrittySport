package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grittyfitness/api/internal/services"
)

type WishlistHandler struct {
	svc *services.WishlistService
}

func NewWishlistHandler(svc *services.WishlistService) *WishlistHandler {
	return &WishlistHandler{svc: svc}
}

type wishlistSubscribeBody struct {
	Email string `json:"email"`
}

func (h *WishlistHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req wishlistSubscribeBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.Subscribe(r.Context(), req.Email); err != nil {
		var valErrs *services.ValidationErrors
		if errors.As(err, &valErrs) {
			writeValidationErrors(w, valErrs.Errors)
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

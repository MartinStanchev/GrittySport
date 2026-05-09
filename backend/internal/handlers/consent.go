package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
)

type ConsentHandler struct {
	consentService *services.ConsentService
}

func NewConsentHandler(consentService *services.ConsentService) *ConsentHandler {
	return &ConsentHandler{consentService: consentService}
}

type recordConsentsBody struct {
	Consents  []services.ConsentInput `json:"consents"`
	BirthYear *int                    `json:"birth_year"`
}

func (h *ConsentHandler) Record(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var body recordConsentsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.consentService.RecordConsents(r.Context(), userID, services.RecordConsentsInput{
		Consents:  body.Consents,
		BirthYear: body.BirthYear,
		IPAddress: clientIP(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrMissingRequiredConsent),
			errors.Is(err, services.ErrInvalidBirthYear):
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "failed to record consents")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func clientIP(r *http.Request) string {
	if v := r.Header.Get("X-Forwarded-For"); v != "" {
		if i := strings.IndexByte(v, ','); i > 0 {
			return strings.TrimSpace(v[:i])
		}
		return strings.TrimSpace(v)
	}
	return r.RemoteAddr
}

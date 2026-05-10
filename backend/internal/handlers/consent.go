package handlers

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"

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

	// r.RemoteAddr is normalized by chimw.RealIP (registered in main.go before
	// JWT auth). Re-reading X-Forwarded-For here would let an unauthenticated
	// header poison the GDPR consent audit trail.
	err := h.consentService.RecordConsents(r.Context(), userID, services.RecordConsentsInput{
		Consents:  body.Consents,
		BirthYear: body.BirthYear,
		IPAddress: stripPort(r.RemoteAddr),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrMissingRequiredConsent),
			errors.Is(err, services.ErrInvalidBirthYear),
			errors.Is(err, services.ErrConsentVersionMismatch):
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "failed to record consents")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// stripPort removes a trailing port from a "host:port" address. RealIP returns
// just the IP, but if the request never passed through a trusted proxy
// r.RemoteAddr is "1.2.3.4:5678" — INET column won't accept that. Returns empty
// for unparseable input so the consent row stores NULL rather than garbage.
func stripPort(addr string) string {
	if addr == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	if ip := net.ParseIP(addr); ip != nil {
		return addr
	}
	return ""
}

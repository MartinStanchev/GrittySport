package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

type otpRequestBody struct {
	Email string `json:"email"`
}

type otpVerifyBody struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var req otpRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.authService.RequestOTP(r.Context(), req.Email)
	if err != nil {
		var valErrs *services.ValidationErrors
		if errors.As(err, &valErrs) {
			writeValidationErrors(w, valErrs.Errors)
			return
		}
		if errors.Is(err, services.ErrRateLimited) {
			writeError(w, http.StatusTooManyRequests, "too many requests; please wait before trying again")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req otpVerifyBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.authService.VerifyOTP(r.Context(), req.Email, req.Code)
	if err != nil {
		if errors.Is(err, services.ErrInvalidOTP) {
			writeError(w, http.StatusUnauthorized, "invalid or expired code")
			return
		}
		if errors.Is(err, services.ErrOTPLocked) {
			writeError(w, http.StatusTooManyRequests, "too many attempts; request a new code")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// RevokeAll signs the user out of every device by deleting all their refresh
// tokens. Called from Settings → "Sign out of all devices."
func (h *AuthHandler) RevokeAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.authService.RevokeAllRefreshTokens(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to revoke sessions")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, services.ErrInvalidToken) {
			writeError(w, http.StatusUnauthorized, "invalid or expired refresh token")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

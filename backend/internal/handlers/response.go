package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/grittyfitness/api/internal/services"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeValidationErrors(w http.ResponseWriter, errs []services.ValidationError) {
	writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
		"error":  "validation failed",
		"fields": errs,
	})
}

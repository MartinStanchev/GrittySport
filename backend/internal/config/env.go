// Package config exposes runtime environment helpers.
package config

import (
	"os"
	"strings"
)

// IsDevelopment reports true when APP_ENV is "development" or "dev".
// Default (unset / production / staging) is treated as non-development so
// that prod-only safeguards (fail-fast, PII stripping) kick in by default.
func IsDevelopment() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))) {
	case "development", "dev", "local":
		return true
	}
	return false
}

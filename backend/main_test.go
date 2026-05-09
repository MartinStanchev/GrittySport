package main

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateJWTSecret(t *testing.T) {
	tests := []struct {
		name    string
		secret  string
		wantErr error
	}{
		{"empty", "", errJWTSecretMissing},
		{"too short", "shortsecret", errJWTSecretTooShort},
		{"placeholder lowercase", "your-secret-key-here", errJWTSecretWeak},
		{"placeholder cased", "Your-Secret-Key-Here", errJWTSecretWeak},
		{"env-example placeholder", "replace-me-with-openssl-rand-hex-32-output", errJWTSecretWeak},
		{"changeme", "changeme", errJWTSecretWeak},
		{"strong random", strings.Repeat("a", 32), nil},
		{"long arbitrary", "0123456789abcdef0123456789abcdef0123456789abcdef", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateJWTSecret(tt.secret)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("validateJWTSecret(%q) = %v, want %v", tt.secret, err, tt.wantErr)
			}
		})
	}
}

func TestParseCORSOrigins_DefaultsToLocalhost(t *testing.T) {
	got := parseCORSOrigins("")
	if _, ok := got["http://localhost:8081"]; !ok {
		t.Error("expected localhost:8081 in defaults")
	}
	if _, ok := got["http://localhost:3000"]; !ok {
		t.Error("expected localhost:3000 in defaults")
	}
	if _, ok := got["https://evil.example.com"]; ok {
		t.Error("default allowlist must not include arbitrary external origins")
	}
}

func TestParseCORSOrigins_ExplicitList(t *testing.T) {
	got := parseCORSOrigins("https://app.example.com, https://web.example.com")
	if len(got) != 2 {
		t.Fatalf("expected 2 origins, got %d", len(got))
	}
	if _, ok := got["https://app.example.com"]; !ok {
		t.Error("expected app.example.com")
	}
	if _, ok := got["https://web.example.com"]; !ok {
		t.Error("expected web.example.com (whitespace should be trimmed)")
	}
	if _, ok := got["http://localhost:8081"]; ok {
		t.Error("explicit allowlist must not include defaults")
	}
}

func TestParseCORSOrigins_SkipsBlankEntries(t *testing.T) {
	got := parseCORSOrigins("https://app.example.com,,  ,https://web.example.com")
	if len(got) != 2 {
		t.Errorf("expected 2 origins, got %d", len(got))
	}
}

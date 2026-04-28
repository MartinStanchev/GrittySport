package ai

import (
	"fmt"
	"testing"
	"time"

	"google.golang.org/genai"
)

func TestFlexHTTPOptions(t *testing.T) {
	opts := flexHTTPOptions()

	if opts == nil {
		t.Fatal("flexHTTPOptions() returned nil")
	}

	if opts.Timeout == nil {
		t.Fatal("expected timeout to be set")
	}
	if *opts.Timeout != 10*time.Minute {
		t.Errorf("expected 10m timeout, got %v", *opts.Timeout)
	}

	tier, ok := opts.ExtraBody["service_tier"]
	if !ok {
		t.Fatal("expected service_tier in ExtraBody")
	}
	if tier != "flex" {
		t.Errorf("expected service_tier=flex, got %v", tier)
	}

	if opts.Headers.Get("X-Server-Timeout") != "600" {
		t.Errorf("expected X-Server-Timeout=600, got %q", opts.Headers.Get("X-Server-Timeout"))
	}
}

func TestApplyFlexTier_NilConfig(t *testing.T) {
	cfg := applyFlexTier(nil)
	if cfg == nil {
		t.Fatal("expected non-nil config")
	}
	if cfg.HTTPOptions == nil {
		t.Fatal("expected HTTPOptions to be set")
	}
	tier := cfg.HTTPOptions.ExtraBody["service_tier"]
	if tier != "flex" {
		t.Errorf("expected flex, got %v", tier)
	}
}

func TestApplyFlexTier_PreservesExisting(t *testing.T) {
	existing := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText("test prompt")},
		},
		MaxOutputTokens: 1024,
	}

	cfg := applyFlexTier(existing)

	if cfg.SystemInstruction == nil || cfg.SystemInstruction.Parts[0].Text != "test prompt" {
		t.Error("applyFlexTier should preserve SystemInstruction")
	}
	if cfg.MaxOutputTokens != 1024 {
		t.Error("applyFlexTier should preserve MaxOutputTokens")
	}
	if cfg.HTTPOptions == nil || cfg.HTTPOptions.ExtraBody["service_tier"] != "flex" {
		t.Error("applyFlexTier should set Flex tier")
	}
}

func TestIsFlexRetryable(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{fmt.Errorf("something went wrong"), false},
		{fmt.Errorf("503 Service Unavailable"), true},
		{fmt.Errorf("429 Too Many Requests"), true},
		{fmt.Errorf("rpc error: code = 503"), true},
		{fmt.Errorf("rpc error: code = 429"), true},
		{fmt.Errorf("RESOURCE_EXHAUSTED: quota exceeded"), true},
		{fmt.Errorf("invalid API key"), false},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%v", tt.err), func(t *testing.T) {
			got := isFlexRetryable(tt.err)
			if got != tt.want {
				t.Errorf("isFlexRetryable(%v) = %v, want %v", tt.err, got, tt.want)
			}
		})
	}
}

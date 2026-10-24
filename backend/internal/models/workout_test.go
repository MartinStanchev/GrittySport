package models

import (
	"testing"
	"time"
)

func TestEffectiveDurationSec(t *testing.T) {
	start := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	finish := start.Add(30 * time.Minute)

	tests := []struct {
		name   string
		w      Workout
		expect float64
	}{
		{"no pause", Workout{StartedAt: start, FinishedAt: &finish}, 1800},
		{"excludes paused time", Workout{StartedAt: start, FinishedAt: &finish, PausedDurationSec: 300}, 1500},
		{"floored at zero", Workout{StartedAt: start, FinishedAt: &finish, PausedDurationSec: 5000}, 0},
		{"unfinished", Workout{StartedAt: start}, 0},
	}
	for _, tt := range tests {
		if got := tt.w.EffectiveDurationSec(); got != tt.expect {
			t.Errorf("%s: EffectiveDurationSec() = %v, want %v", tt.name, got, tt.expect)
		}
	}
}

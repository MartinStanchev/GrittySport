package notifications

import (
	"strings"
	"testing"
)

func TestFormatActivityLabel(t *testing.T) {
	cases := map[string]string{
		"strength_training": "Strength",
		"mobility_recovery": "Mobility",
		"run":               "Run",
		"cycling":           "Ride",
		"swimming":          "Swim",
		"long_run":          "Long Run",
		"":                  "Workout",
		"hiit":              "Hiit",
	}
	for in, want := range cases {
		got := FormatActivityLabel(in)
		if got != want {
			t.Errorf("FormatActivityLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPickMissedWorkoutBody(t *testing.T) {
	// Should always return one of the registered bodies, never empty.
	seen := make(map[string]bool)
	for i := 0; i < 50; i++ {
		got := PickMissedWorkoutBody()
		if strings.TrimSpace(got) == "" {
			t.Fatal("PickMissedWorkoutBody returned empty string")
		}
		found := false
		for _, b := range missedWorkoutBodies {
			if b == got {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("PickMissedWorkoutBody returned %q which is not in the registry", got)
		}
		seen[got] = true
	}
	// With 50 picks across 5 options, expect at least 2 distinct values.
	if len(seen) < 2 {
		t.Errorf("Expected variety across picks, only saw %d distinct values", len(seen))
	}
}

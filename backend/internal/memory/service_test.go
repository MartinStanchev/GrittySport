package memory

import (
	"testing"
)

func TestFormatFactType(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"injury", "Injury"},
		{"health_condition", "Health"},
		{"preference", "Preference"},
		{"goal", "Goal"},
		{"schedule_constraint", "Schedule"},
		{"equipment", "Equipment"},
		{"sport_focus", "Sport"},
		{"explicit_preference", "User Preference"},
		{"unknown_type", "unknown type"},
	}

	for _, tt := range tests {
		result := formatFactType(tt.input)
		if result != tt.expected {
			t.Errorf("formatFactType(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestFormatSegmentType(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"program_creation", "Program Creation"},
		{"post_workout_review", "Post-Workout Review"},
		{"missed_workout_checkin", "Missed Workout Check-in"},
		{"program_modification", "Program Modification"},
		{"general_coaching", "General Coaching"},
		{"unknown_segment", "unknown segment"},
	}

	for _, tt := range tests {
		result := formatSegmentType(tt.input)
		if result != tt.expected {
			t.Errorf("formatSegmentType(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

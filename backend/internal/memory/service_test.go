package memory

import (
	"reflect"
	"testing"

	"github.com/grittyfitness/api/internal/models"
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

func TestNormalizeMemoryIDs(t *testing.T) {
	got := normalizeMemoryIDs([]string{
		"1a2b3c4d",     // valid
		" 1A2B3C4E ",   // trimmed + lowercased
		"id:deadbeef",  // label stripped
		"id: cafebabe", // label + space stripped
		"1a2b3c4",      // too short
		"1a2b3c4d5",    // too long
		"zzzzzzzz",     // not hex
		"",
	})
	want := []string{"1a2b3c4d", "1a2b3c4e", "deadbeef", "cafebabe"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("normalizeMemoryIDs = %v, want %v", got, want)
	}
}

func TestIsForgotten(t *testing.T) {
	forgotten := []models.ChatFact{{FactType: "injury", Content: "Left ankle sprain"}}

	tests := []struct {
		factType, content string
		want              bool
	}{
		{"injury", "Left ankle sprain", true},
		{"injury", "  left ANKLE sprain ", true},
		{"preference", "Left ankle sprain", false}, // different type
		{"injury", "Right knee pain", false},
	}
	for _, tt := range tests {
		if got := isForgotten(tt.factType, tt.content, forgotten); got != tt.want {
			t.Errorf("isForgotten(%q, %q) = %v, want %v", tt.factType, tt.content, got, tt.want)
		}
	}
}

func TestParseRedactionUpdates(t *testing.T) {
	raw := "```json\n" + `{"updates": [
		{"index": 1, "summary": " Built a 10k program. "},
		{"index": 3, "summary": ""},
		{"index": 0, "summary": "out of range"},
		{"index": 9, "summary": "out of range"}
	]}` + "\n```"

	got, err := parseRedactionUpdates(raw, 3)
	if err != nil {
		t.Fatalf("parseRedactionUpdates: %v", err)
	}
	want := map[int]string{0: "Built a 10k program.", 2: ""}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseRedactionUpdates = %v, want %v", got, want)
	}

	if _, err := parseRedactionUpdates("not json", 3); err == nil {
		t.Error("expected error for invalid JSON")
	}
}

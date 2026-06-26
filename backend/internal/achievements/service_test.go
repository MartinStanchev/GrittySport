package achievements

import (
	"testing"

	"github.com/grittyfitness/api/internal/models"
)

func TestHighestCrossed(t *testing.T) {
	w := &models.Workout{ID: "w1"}

	tests := []struct {
		name      string
		total     float64
		wantNil   bool
		wantTitle string
		wantKey   string
	}{
		{"below first threshold", 0, true, "", ""},
		{"exactly first", 1, false, "First workout logged", "milestone:workout_count:1"},
		{"between thresholds picks lower", 30, false, "25 workouts logged", "milestone:workout_count:25"},
		{"at higher threshold", 100, false, "100 workouts logged", "milestone:workout_count:100"},
		{"above all picks highest", 9999, false, "250 workouts logged", "milestone:workout_count:250"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := highestCrossed(tt.total, workoutCountMilestones, "milestone:workout_count:", w)
			if tt.wantNil {
				if got != nil {
					t.Fatalf("expected nil, got %+v", got)
				}
				return
			}
			if got == nil {
				t.Fatal("expected candidate, got nil")
			}
			if got.title != tt.wantTitle {
				t.Errorf("title = %q, want %q", got.title, tt.wantTitle)
			}
			if got.dedupeKey != tt.wantKey {
				t.Errorf("dedupeKey = %q, want %q", got.dedupeKey, tt.wantKey)
			}
			if got.achType != models.AchievementMilestone {
				t.Errorf("achType = %q, want milestone", got.achType)
			}
			if got.workoutID == nil || *got.workoutID != "w1" {
				t.Errorf("workoutID not set to w1")
			}
		})
	}
}

func TestPrescriptionString(t *testing.T) {
	raw := []byte(`{"event_name":"Berlin Marathon","goal":"sub-3:30"}`)
	if got := prescriptionString(raw, "event_name"); got != "Berlin Marathon" {
		t.Errorf("event_name = %q", got)
	}
	if got := prescriptionString(raw, "missing"); got != "" {
		t.Errorf("missing key should be empty, got %q", got)
	}
	if got := prescriptionString(nil, "event_name"); got != "" {
		t.Errorf("nil raw should be empty, got %q", got)
	}
}

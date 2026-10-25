package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidatePrescription(t *testing.T) {
	tests := []struct {
		name         string
		activityType string
		presc        string
		wantErr      string
	}{
		{"simple run", "run", `{"distance_m":8000,"pace_sec_per_km":330,"effort":"Easy","rpe":6}`, ""},
		{"intervals", "run", `{"warmup":"1.5km easy","sets":[{"reps":6,"distance_m":800,"pace_sec_per_km":220,"rest":"400m jog"}],"total_distance_m":10000}`, ""},
		{"strength", "strength_training", `{"exercises":[{"name":"Squat","sets":4,"reps":8,"weight_kg":85,"rest_sec":120,"rpe":8}]}`, ""},
		{"empty", "run", `{}`, ""},
		{"event metadata exempt", "event", `{"event_name":"Berlin","distance":"42.2 km"}`, ""},
		{"legacy distance", "run", `{"distance":"8km"}`, "use distance_m"},
		{"legacy pace in set", "run", `{"sets":[{"reps":4,"pace":"4:00/km"}]}`, "prescription.sets[0].pace"},
		{"legacy weight", "strength_training", `{"exercises":[{"name":"Squat","weight":"85kg"}]}`, "use weight_kg"},
		{"string number", "run", `{"distance_m":"8000"}`, "non-negative number"},
		{"fractional reps", "run", `{"sets":[{"reps":2.5,"distance_m":400}]}`, "whole number"},
		{"sets count at top", "run", `{"sets":4}`, "array of objects"},
		{"rpe out of range", "run", `{"rpe":12}`, "between 1 and 10"},
		{"not an object", "run", `[1,2]`, "JSON object"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePrescription(tt.activityType, json.RawMessage(tt.presc))
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want containing %q", err, tt.wantErr)
			}
		})
	}
}

func TestPrescribedAndRecordedDistance(t *testing.T) {
	if got := PrescribedDistanceM(map[string]any{"total_distance_m": 9000.0}); got != 9000 {
		t.Errorf("PrescribedDistanceM fallback = %v, want 9000", got)
	}
	if got := RecordedDistanceM(map[string]any{"distance_km": 5.2}); got != 5200 {
		t.Errorf("RecordedDistanceM km = %v, want 5200", got)
	}
	if got := RecordedDistanceM(map[string]any{"distance_m": 1500.0}); got != 1500 {
		t.Errorf("RecordedDistanceM m = %v, want 1500", got)
	}
}

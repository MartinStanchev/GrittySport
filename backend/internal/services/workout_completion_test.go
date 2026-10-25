package services

import (
	"encoding/json"
	"testing"
)

func TestEvaluateCompletion(t *testing.T) {
	tests := []struct {
		name         string
		activityType string
		recorded     string
		prescription string
		durationSec  float64
		want         string
	}{
		{"run hits distance and duration", "run", `{"distance_km":9.8}`, `{"distance_m":10000,"duration_sec":3600}`, 3500, "met_targets"},
		{"run short on distance", "run", `{"distance_km":6}`, `{"distance_m":10000,"duration_sec":3600}`, 3500, "below_targets"},
		{"manual log uses meters", "swim", `{"distance_m":1900}`, `{"total_distance_m":2000}`, 0, "met_targets"},
		{"strength exercise count", "strength_training", `{"exercises":[{},{}]}`, `{"exercises":[{},{},{},{}]}`, 0, "below_targets"},
		{"nothing measurable", "yoga", `{}`, `{"style":"vinyasa"}`, 1800, "completed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateCompletion(json.RawMessage(tt.recorded), json.RawMessage(tt.prescription), tt.activityType, tt.durationSec)
			if got != tt.want {
				t.Errorf("evaluateCompletion = %q, want %q", got, tt.want)
			}
		})
	}
}

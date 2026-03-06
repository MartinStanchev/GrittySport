package review

import (
	"encoding/json"
	"testing"
)

func TestComputeEffortScore(t *testing.T) {
	tests := []struct {
		name        string
		hrData      string
		maxHR       int
		durationSec float64
		wantMin     int
		wantMax     int
	}{
		{
			name:        "empty HR data",
			hrData:      "",
			maxHR:       185,
			durationSec: 3600,
			wantMin:     0,
			wantMax:     0,
		},
		{
			name:        "single reading",
			hrData:      `{"readings":[{"bpm":120,"timestamp":0}]}`,
			maxHR:       185,
			durationSec: 3600,
			wantMin:     0,
			wantMax:     0,
		},
		{
			name:        "Z1 easy 30min",
			hrData:      buildHRJSON(100, 31, 60000),
			maxHR:       185,
			durationSec: 1800,
			wantMin:     0,
			wantMax:     25,
		},
		{
			name:        "Z2 moderate 60min",
			hrData:      buildHRJSON(125, 61, 60000),
			maxHR:       185,
			durationSec: 3600,
			wantMin:     30,
			wantMax:     65,
		},
		{
			name:        "Z4 hard 45min",
			hrData:      buildHRJSON(170, 46, 60000),
			maxHR:       185,
			durationSec: 2700,
			wantMin:     50,
			wantMax:     100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var hrData json.RawMessage
			if tt.hrData != "" {
				hrData = json.RawMessage(tt.hrData)
			}
			got := ComputeEffortScore(hrData, tt.maxHR, tt.durationSec)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("ComputeEffortScore() = %d, want between %d and %d", got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestEffortLabel(t *testing.T) {
	tests := []struct {
		score int
		want  string
	}{
		{0, "Easy"},
		{24, "Easy"},
		{25, "Moderate"},
		{49, "Moderate"},
		{50, "Hard"},
		{74, "Hard"},
		{75, "Very Hard"},
		{89, "Very Hard"},
		{90, "Max"},
		{100, "Max"},
	}

	for _, tt := range tests {
		got := EffortLabel(tt.score)
		if got != tt.want {
			t.Errorf("EffortLabel(%d) = %q, want %q", tt.score, got, tt.want)
		}
	}
}

func TestComputeRunDeviation(t *testing.T) {
	prescription := map[string]any{
		"distance_km":            5.0,
		"target_pace_sec_per_km": 330.0, // 5:30/km
	}

	// Actual: 4.6km at 5:15/km pace
	recorded := json.RawMessage(`{"distance_km": 4.6, "avg_pace_sec_per_km": 315}`)

	dm := ComputeRunDeviation(prescription, recorded)

	if dm.DistanceDeviationPct == nil {
		t.Fatal("expected distance deviation")
	}
	// (4.6 - 5.0) / 5.0 = -8%
	if *dm.DistanceDeviationPct < -9 || *dm.DistanceDeviationPct > -7 {
		t.Errorf("distance deviation = %.1f%%, want ~-8%%", *dm.DistanceDeviationPct)
	}

	if dm.PaceDeviationPct == nil {
		t.Fatal("expected pace deviation")
	}
	// (330 - 315) / 330 = +4.5% (faster)
	if *dm.PaceDeviationPct < 3 || *dm.PaceDeviationPct > 6 {
		t.Errorf("pace deviation = %.1f%%, want ~4.5%%", *dm.PaceDeviationPct)
	}
}

func TestComputeStrengthDeviation(t *testing.T) {
	prescription := map[string]any{
		"exercises": []any{
			map[string]any{
				"name":   "Back Squat",
				"sets":   4.0,
				"reps":   5.0,
				"weight": 100.0,
			},
		},
	}

	// Actual: 4 sets × 5 reps × 95 kg = 1900 vs prescribed 2000
	recorded := json.RawMessage(`{
		"exercises": [{"name": "Back Squat", "sets": [
			{"reps": 5, "weight": 95},
			{"reps": 5, "weight": 95},
			{"reps": 5, "weight": 95},
			{"reps": 5, "weight": 95}
		]}]
	}`)

	dm := ComputeStrengthDeviation(prescription, recorded)

	if dm.VolumeDeviationPct == nil {
		t.Fatal("expected volume deviation")
	}
	// (1900 - 2000) / 2000 = -5%
	if *dm.VolumeDeviationPct < -6 || *dm.VolumeDeviationPct > -4 {
		t.Errorf("volume deviation = %.1f%%, want ~-5%%", *dm.VolumeDeviationPct)
	}
}

func TestComputeGenericDeviation(t *testing.T) {
	prescription := map[string]any{
		"duration_minutes": 30.0,
	}

	recorded := json.RawMessage(`{}`)
	dm := ComputeGenericDeviation(prescription, recorded, 1980) // 33 min

	if dm.DurationDeviationPct == nil {
		t.Fatal("expected duration deviation")
	}
	// (33 - 30) / 30 = +10%
	if *dm.DurationDeviationPct < 9 || *dm.DurationDeviationPct > 11 {
		t.Errorf("duration deviation = %.1f%%, want ~10%%", *dm.DurationDeviationPct)
	}
}

func TestComputeKmSplits(t *testing.T) {
	t.Run("empty GPS data", func(t *testing.T) {
		splits := ComputeKmSplits(nil)
		if splits != nil {
			t.Errorf("expected nil, got %d splits", len(splits))
		}
	})

	t.Run("valid 2km route", func(t *testing.T) {
		route := buildGPSRoute(21, 100, 30000)
		splits := ComputeKmSplits(route)

		if len(splits) != 2 {
			t.Fatalf("expected 2 splits, got %d", len(splits))
		}

		if splits[0].Km != 1 || splits[1].Km != 2 {
			t.Errorf("split kms: %d, %d", splits[0].Km, splits[1].Km)
		}

		// Each split ~300 sec/km at 100m per 30s
		for _, s := range splits {
			if s.PaceSecPerKm < 250 || s.PaceSecPerKm > 350 {
				t.Errorf("split %d pace = %.1f, want ~300", s.Km, s.PaceSecPerKm)
			}
		}
	})
}

// --- Helpers ---

func buildHRJSON(bpm, count, intervalMs int) string {
	type reading struct {
		BPM       int   `json:"bpm"`
		Timestamp int64 `json:"timestamp"`
	}
	readings := make([]reading, count)
	for i := 0; i < count; i++ {
		readings[i] = reading{BPM: bpm, Timestamp: int64(i * intervalMs)}
	}
	data := struct {
		Readings []reading `json:"readings"`
	}{Readings: readings}
	b, _ := json.Marshal(data)
	return string(b)
}

func buildGPSRoute(pointCount, stepM, stepMs int) json.RawMessage {
	type point struct {
		Lat              float64  `json:"lat"`
		Lng              float64  `json:"lng"`
		Altitude         *float64 `json:"altitude"`
		Accuracy         float64  `json:"accuracy"`
		Speed            *float64 `json:"speed"`
		Timestamp        int64    `json:"timestamp"`
		DistanceFromPrev float64  `json:"distance_from_prev"`
	}

	points := make([]point, pointCount)
	lngStep := float64(stepM) / 68600
	for i := 0; i < pointCount; i++ {
		dist := 0.0
		if i > 0 {
			dist = float64(stepM)
		}
		points[i] = point{
			Lat:              52.0,
			Lng:              4.0 + float64(i)*lngStep,
			Accuracy:         5,
			Timestamp:        int64(i * stepMs),
			DistanceFromPrev: dist,
		}
	}

	data := struct {
		Points []point `json:"points"`
	}{Points: points}
	b, _ := json.Marshal(data)
	return b
}

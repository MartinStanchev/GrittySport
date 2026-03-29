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

func TestActivityTypeFamily(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"run", "run"},
		{"easy_run", "run"},
		{"long_run", "run"},
		{"interval", "run"},
		{"trail_run", "run"},
		{"tempo_run", "run"},
		{"cycling", "cycling"},
		{"bike", "cycling"},
		{"swim", "swim"},
		{"swim_open_water", "swim"},
		{"strength_training", "strength"},
		{"weight_training", "strength"},
		{"mobility", "mobility"},
		{"yoga", "mobility"},
		{"hike", "hike"},
		{"walk", "walk"},
	}
	for _, tt := range tests {
		got := activityTypeFamily(tt.input)
		if got != tt.want {
			t.Errorf("activityTypeFamily(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestActivityTypesInFamily(t *testing.T) {
	runTypes := activityTypesInFamily("run")
	if len(runTypes) < 4 {
		t.Errorf("expected at least 4 run types, got %d: %v", len(runTypes), runTypes)
	}
	cyclingTypes := activityTypesInFamily("cycling")
	if len(cyclingTypes) != 2 {
		t.Errorf("expected 2 cycling types, got %d: %v", len(cyclingTypes), cyclingTypes)
	}
}

func TestFormatDurationSec(t *testing.T) {
	tests := []struct {
		sec  float64
		want string
	}{
		{0, "0:00"},
		{65, "1:05"},
		{300, "5:00"},
		{1234.5, "20:35"},
		{3661, "1:01:01"},
		{7200, "2:00:00"},
	}
	for _, tt := range tests {
		got := formatDurationSec(tt.sec)
		if got != tt.want {
			t.Errorf("formatDurationSec(%.1f) = %q, want %q", tt.sec, got, tt.want)
		}
	}
}

func TestComputeCardiacEfficiencyFromData(t *testing.T) {
	t.Run("insufficient matches returns nil", func(t *testing.T) {
		result := computeCardiacEfficiencyFromData(
			330, 150,
			[]float64{400, 420}, // paces too far from 330
			[]float64{145, 148},
			30,
		)
		if result != nil {
			t.Error("expected nil for insufficient matches")
		}
	})

	t.Run("improving cardiac efficiency", func(t *testing.T) {
		result := computeCardiacEfficiencyFromData(
			330, 140, // current: 5:30/km, 140 bpm
			[]float64{325, 335, 328}, // historical paces within ±30
			[]float64{152, 148, 150}, // historical HRs
			30,
		)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		if result.Trend != TrendImproving {
			t.Errorf("expected improving trend, got %q", result.Trend)
		}
		if result.DeltaHR >= 0 {
			t.Errorf("expected negative delta HR for improvement, got %d", result.DeltaHR)
		}
		if result.ComparisonCount != 3 {
			t.Errorf("expected 3 comparisons, got %d", result.ComparisonCount)
		}
	})

	t.Run("declining cardiac efficiency", func(t *testing.T) {
		result := computeCardiacEfficiencyFromData(
			330, 160,
			[]float64{335, 328},
			[]float64{148, 150},
			30,
		)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		if result.Trend != TrendDeclining {
			t.Errorf("expected declining trend, got %q", result.Trend)
		}
	})

	t.Run("stable cardiac efficiency", func(t *testing.T) {
		result := computeCardiacEfficiencyFromData(
			330, 150,
			[]float64{335, 328},
			[]float64{149, 151},
			30,
		)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		if result.Trend != TrendStable {
			t.Errorf("expected stable trend, got %q", result.Trend)
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

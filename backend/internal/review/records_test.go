package review

import (
	"encoding/json"
	"math"
	"testing"
)

func TestComputeBestSegmentTime(t *testing.T) {
	t.Run("empty GPS data", func(t *testing.T) {
		result := computeBestSegmentTime(nil, 5000)
		if result != 0 {
			t.Errorf("expected 0 for nil GPS, got %.1f", result)
		}
	})

	t.Run("route shorter than target", func(t *testing.T) {
		// 3km route: 31 points at 100m each = 3000m
		points := parseGPSPoints(buildGPSRoute(31, 100, 30000))
		result := computeBestSegmentTime(points, 5000)
		if result != 0 {
			t.Errorf("expected 0 for short route, got %.1f", result)
		}
	})

	t.Run("5K from 5K route", func(t *testing.T) {
		// 51 points × 100m = 5000m, each step 30s → total 1500s = 25 min
		points := parseGPSPoints(buildGPSRoute(51, 100, 30000))
		result := computeBestSegmentTime(points, 5000)
		if result <= 0 {
			t.Fatal("expected positive segment time for 5K")
		}
		// 50 segments × 30s = 1500s expected
		if result < 1400 || result > 1600 {
			t.Errorf("expected ~1500s, got %.0f", result)
		}
	})

	t.Run("10K from 11K route", func(t *testing.T) {
		// 111 points × 100m = 11000m, each step 30s
		points := parseGPSPoints(buildGPSRoute(111, 100, 30000))
		result := computeBestSegmentTime(points, 10000)
		if result <= 0 {
			t.Fatal("expected positive segment time for 10K")
		}
		// Should find best 10K = 100 segments × 30s = 3000s
		if result < 2800 || result > 3200 {
			t.Errorf("expected ~3000s, got %.0f", result)
		}
	})

	t.Run("no half marathon from 11K", func(t *testing.T) {
		points := parseGPSPoints(buildGPSRoute(111, 100, 30000))
		result := computeBestSegmentTime(points, 21097.5)
		if result != 0 {
			t.Errorf("expected 0 for insufficient distance, got %.1f", result)
		}
	})

	t.Run("finds fastest segment in variable pace route", func(t *testing.T) {
		var gpsPoints []GPSPoint
		ts := int64(0)

		// First point
		gpsPoints = append(gpsPoints, GPSPoint{Lat: 52, Lng: 4, Accuracy: 5, Timestamp: 0})

		// Slow 5K: 100m steps, 40s each → 2000s for 5K
		for i := 1; i <= 50; i++ {
			ts += 40000
			gpsPoints = append(gpsPoints, GPSPoint{
				Lat: 52, Lng: 4 + float64(i)*0.001,
				Accuracy: 5, Timestamp: ts, DistanceFromPrev: 100,
			})
		}

		// Fast 5K: 100m steps, 20s each → 1000s for 5K
		for i := 1; i <= 50; i++ {
			ts += 20000
			gpsPoints = append(gpsPoints, GPSPoint{
				Lat: 52, Lng: 4 + 0.05 + float64(i)*0.001,
				Accuracy: 5, Timestamp: ts, DistanceFromPrev: 100,
			})
		}

		result := computeBestSegmentTime(gpsPoints, 5000)
		if result <= 0 {
			t.Fatal("expected positive segment time")
		}
		// Should find the fast 5K (~1000s), not the slow one (~2000s)
		if result > 1100 {
			t.Errorf("expected fastest 5K ~1000s, got %.0f", result)
		}
	})
}

func TestParseExercisePRs(t *testing.T) {
	t.Run("valid strength data", func(t *testing.T) {
		data := json.RawMessage(`{
			"exercises": [
				{
					"name": "Back Squat",
					"sets": [
						{"reps": 5, "weight": 100},
						{"reps": 3, "weight": 110},
						{"reps": 1, "weight": 120}
					]
				},
				{
					"name": "Bench Press",
					"sets": [
						{"reps": 8, "weight": 80}
					]
				}
			]
		}`)

		result := parseExercisePRs(data)
		if len(result) != 2 {
			t.Fatalf("expected 2 exercises, got %d", len(result))
		}

		squat := result["Back Squat"]
		if squat == nil {
			t.Fatal("expected Back Squat data")
		}
		// Heaviest set: 120 kg
		if squat.heaviestKg != 120 {
			t.Errorf("heaviest squat = %.1f, want 120", squat.heaviestKg)
		}
		// e1RM: best from 120 × (1 + 1/30) = 124.0 or 110 × (1 + 3/30) = 121.0 or 100 × (1 + 5/30) = 116.67
		expectedE1RM := 124.0
		if math.Abs(squat.bestE1RM-expectedE1RM) > 0.5 {
			t.Errorf("squat e1RM = %.1f, want ~%.1f", squat.bestE1RM, expectedE1RM)
		}
		// Volume: 5×100 + 3×110 + 1×120 = 500 + 330 + 120 = 950
		if math.Abs(squat.totalVolume-950) > 0.5 {
			t.Errorf("squat volume = %.1f, want 950", squat.totalVolume)
		}

		bench := result["Bench Press"]
		if bench == nil {
			t.Fatal("expected Bench Press data")
		}
		// e1RM: 80 × (1 + 8/30) = 101.33
		expectedBenchE1RM := 80 * (1 + 8.0/30)
		if math.Abs(bench.bestE1RM-expectedBenchE1RM) > 0.5 {
			t.Errorf("bench e1RM = %.1f, want ~%.1f", bench.bestE1RM, expectedBenchE1RM)
		}
	})

	t.Run("empty exercises returns nil", func(t *testing.T) {
		result := parseExercisePRs(json.RawMessage(`{"exercises": []}`))
		if len(result) != 0 {
			t.Errorf("expected empty map, got %d entries", len(result))
		}
	})

	t.Run("no exercises field returns nil", func(t *testing.T) {
		result := parseExercisePRs(json.RawMessage(`{"distance_km": 5}`))
		if result != nil {
			t.Errorf("expected nil, got %v", result)
		}
	})
}

func TestComputeSwimPRTargets(t *testing.T) {
	// Validate swim PR targets exist for expected distances
	if len(swimPRTargets) != 3 {
		t.Errorf("expected 3 swim PR targets, got %d", len(swimPRTargets))
	}
	names := make(map[string]bool)
	for _, target := range swimPRTargets {
		names[target.name] = true
	}
	for _, expected := range []string{"Fastest 200m", "Fastest 400m", "Fastest 1500m"} {
		if !names[expected] {
			t.Errorf("missing swim PR target: %s", expected)
		}
	}
}

func TestDistancePRTargets(t *testing.T) {
	runTargets, ok := distancePRTargets["run"]
	if !ok {
		t.Fatal("missing run distance PR targets")
	}
	if len(runTargets) != 3 {
		t.Errorf("expected 3 run targets, got %d", len(runTargets))
	}

	cyclingTargets, ok := distancePRTargets["cycling"]
	if !ok {
		t.Fatal("missing cycling distance PR targets")
	}
	if len(cyclingTargets) != 2 {
		t.Errorf("expected 2 cycling targets, got %d", len(cyclingTargets))
	}
}

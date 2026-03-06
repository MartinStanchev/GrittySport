package review

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

// AnalyticsResponse is the JSON shape returned by GET /workouts/{id}/analytics.
type AnalyticsResponse struct {
	EffortScore     int              `json:"effort_score"`
	EffortLabel     string           `json:"effort_label"`
	Splits          []KmSplit        `json:"splits"`
	FastestSplitKm  int              `json:"fastest_split_km"`
	SlowestSplitKm  int              `json:"slowest_split_km"`
	FadePct         float64          `json:"fade_pct"`
	IsNegativeSplit bool             `json:"is_negative_split"`
	Alignment       *AlignmentData   `json:"program_alignment,omitempty"`
	Trend           *TrendData       `json:"trend,omitempty"`
	PersonalRecords []PersonalRecord `json:"personal_records,omitempty"`
}

// AlignmentData shows prescribed vs actual.
type AlignmentData struct {
	PrescribedDistanceKm *float64 `json:"prescribed_distance_km,omitempty"`
	ActualDistanceKm     *float64 `json:"actual_distance_km,omitempty"`
	DistanceDeviationPct *float64 `json:"distance_deviation_pct,omitempty"`
	PrescribedPace       string   `json:"prescribed_pace,omitempty"`
	ActualPace           string   `json:"actual_pace,omitempty"`
	PaceDeviationPct     *float64 `json:"pace_deviation_pct,omitempty"`
	PrescribedDurationMin *float64 `json:"prescribed_duration_min,omitempty"`
	ActualDurationMin     *float64 `json:"actual_duration_min,omitempty"`
	DurationDeviationPct  *float64 `json:"duration_deviation_pct,omitempty"`
}

// TrendData compares to recent workouts.
type TrendData struct {
	ComparisonText string `json:"comparison_text"`
	AvgPaceTrend   string `json:"avg_pace_trend"` // "improving", "stable", "declining"
}

// ComputeAnalytics generates full analytics for a workout.
func ComputeAnalytics(ctx context.Context, pool *pgxpool.Pool, workout *models.Workout, maxHR int) (*AnalyticsResponse, error) {
	var durationSec float64
	if workout.FinishedAt != nil {
		durationSec = workout.FinishedAt.Sub(workout.StartedAt).Seconds()
	}

	effortScore := ComputeEffortScore(workout.HeartRateData, maxHR, durationSec)
	splits := ComputeKmSplits(workout.GPSRoute)
	if splits == nil {
		splits = []KmSplit{}
	}

	resp := &AnalyticsResponse{
		EffortScore: effortScore,
		EffortLabel: EffortLabel(effortScore),
		Splits:      splits,
	}

	// Splits analysis
	if len(splits) > 0 {
		fastestKm := splits[0].Km
		slowestKm := splits[0].Km
		fastestPace := splits[0].PaceSecPerKm
		slowestPace := splits[0].PaceSecPerKm

		for _, s := range splits {
			if s.PaceSecPerKm < fastestPace {
				fastestPace = s.PaceSecPerKm
				fastestKm = s.Km
			}
			if s.PaceSecPerKm > slowestPace {
				slowestPace = s.PaceSecPerKm
				slowestKm = s.Km
			}
		}

		resp.FastestSplitKm = fastestKm
		resp.SlowestSplitKm = slowestKm

		first := splits[0].PaceSecPerKm
		last := splits[len(splits)-1].PaceSecPerKm
		if first > 0 {
			resp.FadePct = math.Round(((last-first)/first)*1000) / 10
		}

		half := len(splits) / 2
		if half > 0 {
			var firstHalf, secondHalf float64
			for _, s := range splits[:half] {
				firstHalf += s.PaceSecPerKm
			}
			for _, s := range splits[half:] {
				secondHalf += s.PaceSecPerKm
			}
			firstHalf /= float64(half)
			secondHalf /= float64(len(splits) - half)
			resp.IsNegativeSplit = secondHalf < firstHalf
		}
	}

	// Program alignment
	if workout.ScheduledActivityID != nil && *workout.ScheduledActivityID != "" {
		resp.Alignment = computeAlignment(ctx, pool, *workout.ScheduledActivityID, workout)
	}

	// Trend comparison
	resp.Trend = computeTrend(ctx, pool, workout)

	// Personal records (pass pre-computed effort score to avoid redundant computation)
	resp.PersonalRecords = DetectPersonalRecords(ctx, pool, workout, maxHR, effortScore)

	return resp, nil
}

func computeAlignment(ctx context.Context, pool *pgxpool.Pool, activityID string, workout *models.Workout) *AlignmentData {
	var prescription json.RawMessage
	err := pool.QueryRow(ctx,
		"SELECT prescription FROM scheduled_activities WHERE id = $1",
		activityID,
	).Scan(&prescription)
	if err != nil || len(prescription) == 0 {
		return nil
	}

	var prescMap, recMap map[string]any
	if json.Unmarshal(prescription, &prescMap) != nil {
		return nil
	}
	if json.Unmarshal(workout.RecordedData, &recMap) != nil {
		return nil
	}

	ad := &AlignmentData{}
	hasData := false

	// Distance
	prescDist := floatFromMap(prescMap, "distance_km")
	actDist := floatFromMap(recMap, "distance_km")
	if prescDist > 0 && actDist > 0 {
		ad.PrescribedDistanceKm = &prescDist
		ad.ActualDistanceKm = &actDist
		d := math.Round(((actDist-prescDist)/prescDist)*1000) / 10
		ad.DistanceDeviationPct = &d
		hasData = true
	}

	// Pace
	prescPace := floatFromMap(prescMap, "target_pace_sec_per_km")
	actPace := floatFromMap(recMap, "avg_pace_sec_per_km")
	if prescPace > 0 && actPace > 0 {
		ad.PrescribedPace = formatPace(prescPace)
		ad.ActualPace = formatPace(actPace)
		d := math.Round(((prescPace-actPace)/prescPace)*1000) / 10
		ad.PaceDeviationPct = &d
		hasData = true
	}

	// Duration
	prescDur := floatFromMap(prescMap, "duration_minutes")
	if prescDur > 0 && workout.FinishedAt != nil {
		actDur := workout.FinishedAt.Sub(workout.StartedAt).Minutes()
		ad.PrescribedDurationMin = &prescDur
		ad.ActualDurationMin = &actDur
		d := math.Round(((actDur-prescDur)/prescDur)*1000) / 10
		ad.DurationDeviationPct = &d
		hasData = true
	}

	if !hasData {
		return nil
	}
	return ad
}

func computeTrend(ctx context.Context, pool *pgxpool.Pool, workout *models.Workout) *TrendData {
	rows, err := pool.Query(ctx,
		`SELECT recorded_data FROM workouts
		 WHERE user_id = $1 AND activity_type = $2 AND id != $3
		 ORDER BY started_at DESC LIMIT 5`,
		workout.UserID, workout.ActivityType, workout.ID,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var paces []float64
	for rows.Next() {
		var data json.RawMessage
		if rows.Scan(&data) != nil {
			continue
		}
		var rec map[string]any
		if json.Unmarshal(data, &rec) != nil {
			continue
		}
		pace := floatFromMap(rec, "avg_pace_sec_per_km")
		if pace > 0 {
			paces = append(paces, pace)
		}
	}

	if len(paces) == 0 {
		return nil
	}

	var currentRec map[string]any
	if json.Unmarshal(workout.RecordedData, &currentRec) != nil {
		return nil
	}
	currentPace := floatFromMap(currentRec, "avg_pace_sec_per_km")
	if currentPace <= 0 {
		return nil
	}

	var sum float64
	for _, p := range paces {
		sum += p
	}
	avgPace := sum / float64(len(paces))

	diffPct := ((avgPace - currentPace) / avgPace) * 100

	trend := "stable"
	var comparison string
	actLabel := strings.ReplaceAll(workout.ActivityType, "_", " ")

	switch {
	case diffPct > 2:
		trend = "improving"
		comparison = fmt.Sprintf("Your pace was %.0f%% faster than your last %d %ss", diffPct, len(paces), actLabel)
	case diffPct < -2:
		trend = "declining"
		comparison = fmt.Sprintf("Your pace was %.0f%% slower than your last %d %ss", -diffPct, len(paces), actLabel)
	default:
		comparison = fmt.Sprintf("Your pace is consistent with your last %d %ss", len(paces), actLabel)
	}

	return &TrendData{
		ComparisonText: comparison,
		AvgPaceTrend:   trend,
	}
}

func formatPace(secPerKm float64) string {
	if secPerKm <= 0 {
		return "--:--"
	}
	min := int(secPerKm) / 60
	sec := int(secPerKm) % 60
	return fmt.Sprintf("%d:%02d/km", min, sec)
}

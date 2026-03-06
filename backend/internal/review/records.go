package review

import (
	"context"
	"encoding/json"
	"math"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

// PersonalRecord represents a detected PR.
type PersonalRecord struct {
	Category       string  `json:"category"`
	Value          float64 `json:"value"`
	PreviousBest   float64 `json:"previous_best,omitempty"`
	ImprovementPct float64 `json:"improvement_pct,omitempty"`
}

// DetectPersonalRecords checks workout metrics against historical bests.
// currentEffort is the pre-computed effort score to avoid redundant computation.
func DetectPersonalRecords(ctx context.Context, pool *pgxpool.Pool, workout *models.Workout, maxHR int, currentEffort int) []PersonalRecord {
	var prs []PersonalRecord

	currentSplits := ComputeKmSplits(workout.GPSRoute)

	var currentDistKm float64
	var recorded map[string]any
	if json.Unmarshal(workout.RecordedData, &recorded) == nil {
		currentDistKm = floatFromMap(recorded, "distance_km")
	}

	// Find fastest 1km split
	var currentFastest1km float64
	for _, s := range currentSplits {
		if currentFastest1km == 0 || s.PaceSecPerKm < currentFastest1km {
			currentFastest1km = s.PaceSecPerKm
		}
	}

	// Load historical workouts of the same type
	rows, err := pool.Query(ctx,
		`SELECT gps_route, recorded_data, heart_rate_data,
				EXTRACT(EPOCH FROM (finished_at - started_at)) as duration_sec
		 FROM workouts
		 WHERE user_id = $1 AND activity_type = $2 AND id != $3
		 ORDER BY started_at DESC LIMIT 50`,
		workout.UserID, workout.ActivityType, workout.ID,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var bestFastest1km, bestDistance float64
	var bestEffort int

	for rows.Next() {
		var histGPS, histRecorded, histHR json.RawMessage
		var histDuration *float64
		if err := rows.Scan(&histGPS, &histRecorded, &histHR, &histDuration); err != nil {
			continue
		}

		// Check fastest 1km
		histSplits := ComputeKmSplits(histGPS)
		for _, s := range histSplits {
			if bestFastest1km == 0 || s.PaceSecPerKm < bestFastest1km {
				bestFastest1km = s.PaceSecPerKm
			}
		}

		// Check distance
		var histRec map[string]any
		if json.Unmarshal(histRecorded, &histRec) == nil {
			d := floatFromMap(histRec, "distance_km")
			if d > bestDistance {
				bestDistance = d
			}
		}

		// Check effort score
		dur := 0.0
		if histDuration != nil {
			dur = *histDuration
		}
		e := ComputeEffortScore(histHR, maxHR, dur)
		if e > bestEffort {
			bestEffort = e
		}
	}

	// Detect PRs
	if currentFastest1km > 0 && (bestFastest1km == 0 || currentFastest1km < bestFastest1km) {
		pr := PersonalRecord{
			Category: "Fastest 1km split",
			Value:    math.Round(currentFastest1km*10) / 10,
		}
		if bestFastest1km > 0 {
			pr.PreviousBest = math.Round(bestFastest1km*10) / 10
			pr.ImprovementPct = math.Round(((bestFastest1km-currentFastest1km)/bestFastest1km)*1000) / 10
		}
		prs = append(prs, pr)
	}

	if currentDistKm > 0 && currentDistKm > bestDistance {
		pr := PersonalRecord{
			Category: "Longest distance",
			Value:    math.Round(currentDistKm*100) / 100,
		}
		if bestDistance > 0 {
			pr.PreviousBest = math.Round(bestDistance*100) / 100
			pr.ImprovementPct = math.Round(((currentDistKm-bestDistance)/bestDistance)*1000) / 10
		}
		prs = append(prs, pr)
	}

	if currentEffort > 0 && currentEffort > bestEffort {
		pr := PersonalRecord{
			Category: "Highest effort score",
			Value:    float64(currentEffort),
		}
		if bestEffort > 0 {
			pr.PreviousBest = float64(bestEffort)
			pr.ImprovementPct = math.Round((float64(currentEffort-bestEffort)/float64(bestEffort))*1000) / 10
		}
		prs = append(prs, pr)
	}

	return prs
}

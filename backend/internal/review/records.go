package review

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

// historicalWorkout holds parsed data from a single historical workout.
type historicalWorkout struct {
	gpsRoute     json.RawMessage
	gpsPoints    []GPSPoint // pre-parsed GPS points (nil if no route)
	recordedData json.RawMessage
	hrData       json.RawMessage
	durationSec  float64
}

// PersonalRecord represents a detected PR.
type PersonalRecord struct {
	Category       string  `json:"category"`
	Value          float64 `json:"value"`
	FormattedValue string  `json:"formatted_value,omitempty"`
	Unit           string  `json:"unit,omitempty"`
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

	// Load historical workouts of the same activity type family
	family := activityTypeFamily(workout.ActivityType)
	familyTypes := activityTypesInFamily(family)
	rows, err := pool.Query(ctx,
		`SELECT gps_route, recorded_data, heart_rate_data,
				EXTRACT(EPOCH FROM (finished_at - started_at)) as duration_sec
		 FROM workouts
		 WHERE user_id = $1 AND activity_type = ANY($2) AND id != $3
		 ORDER BY started_at DESC LIMIT 50`,
		workout.UserID, familyTypes, workout.ID,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var historicalData []historicalWorkout
	var bestFastest1km, bestDistance float64
	var bestEffort int

	for rows.Next() {
		var hw historicalWorkout
		var histDuration *float64
		if err := rows.Scan(&hw.gpsRoute, &hw.recordedData, &hw.hrData, &histDuration); err != nil {
			continue
		}
		if histDuration != nil {
			hw.durationSec = *histDuration
		}
		// Pre-parse GPS points once to avoid redundant JSON unmarshaling
		hw.gpsPoints = parseGPSPoints(hw.gpsRoute)
		historicalData = append(historicalData, hw)

		// Check fastest 1km
		histSplits := computeKmSplitsFromPoints(hw.gpsPoints)
		for _, s := range histSplits {
			if bestFastest1km == 0 || s.PaceSecPerKm < bestFastest1km {
				bestFastest1km = s.PaceSecPerKm
			}
		}

		// Check distance
		var histRec map[string]any
		if json.Unmarshal(hw.recordedData, &histRec) == nil {
			d := floatFromMap(histRec, "distance_km")
			if d > bestDistance {
				bestDistance = d
			}
		}

		// Check effort score
		e := ComputeEffortScore(hw.hrData, maxHR, hw.durationSec)
		if e > bestEffort {
			bestEffort = e
		}
	}

	// Detect PRs — generic categories
	if currentFastest1km > 0 && (bestFastest1km == 0 || currentFastest1km < bestFastest1km) {
		pr := PersonalRecord{
			Category:       "Fastest 1km split",
			Value:          math.Round(currentFastest1km*10) / 10,
			FormattedValue: formatDurationSec(currentFastest1km),
			Unit:           "pace",
		}
		if bestFastest1km > 0 {
			pr.PreviousBest = math.Round(bestFastest1km*10) / 10
			pr.ImprovementPct = math.Round(((bestFastest1km-currentFastest1km)/bestFastest1km)*1000) / 10
		}
		prs = append(prs, pr)
	}

	if currentDistKm > 0 && currentDistKm > bestDistance {
		pr := PersonalRecord{
			Category:       "Longest distance",
			Value:          math.Round(currentDistKm*100) / 100,
			FormattedValue: fmt.Sprintf("%.2f km", currentDistKm),
			Unit:           "km",
		}
		if bestDistance > 0 {
			pr.PreviousBest = math.Round(bestDistance*100) / 100
			pr.ImprovementPct = math.Round(((currentDistKm-bestDistance)/bestDistance)*1000) / 10
		}
		prs = append(prs, pr)
	}

	if currentEffort > 0 && currentEffort > bestEffort {
		pr := PersonalRecord{
			Category:       "Highest effort score",
			Value:          float64(currentEffort),
			FormattedValue: fmt.Sprintf("%d/100", currentEffort),
			Unit:           "score",
		}
		if bestEffort > 0 {
			pr.PreviousBest = float64(bestEffort)
			pr.ImprovementPct = math.Round((float64(currentEffort-bestEffort)/float64(bestEffort))*1000) / 10
		}
		prs = append(prs, pr)
	}

	// Sport-specific PRs
	currentPoints := parseGPSPoints(workout.GPSRoute)
	switch family {
	case "run", "cycling":
		distancePRs := detectDistancePRs(currentPoints, historicalData, family)
		prs = append(prs, distancePRs...)
	case "swim":
		swimPRs := detectSwimPRs(workout, historicalData)
		prs = append(prs, swimPRs...)
	}
	if family == "strength" {
		strengthPRs := detectStrengthPRs(workout, historicalData)
		prs = append(prs, strengthPRs...)
	}

	return prs
}

// ── Distance PRs (Running / Cycling) ────────────────────────────────────────

// distancePRTargets defines named distance thresholds per sport family.
var distancePRTargets = map[string][]struct {
	name   string
	metres float64
}{
	"run": {
		{"Fastest 5K", 5000},
		{"Fastest 10K", 10000},
		{"Fastest Half Marathon", 21097.5},
	},
	"cycling": {
		{"Fastest 20K", 20000},
		{"Fastest 50K", 50000},
	},
}

// computeBestSegmentTime finds the fastest elapsed time over a contiguous GPS
// segment of at least targetMetres using a two-pointer sliding window.
// Returns the elapsed time in seconds, or 0 if the route is too short.
func computeBestSegmentTime(points []GPSPoint, targetMetres float64) float64 {
	if len(points) < 2 {
		return 0
	}

	// Quick check: total distance
	var totalDist float64
	for i := 1; i < len(points); i++ {
		totalDist += points[i].DistanceFromPrev
	}
	if totalDist < targetMetres {
		return 0
	}

	// Two-pointer sliding window
	var windowDist float64
	start := 0
	bestSec := 0.0

	for end := 1; end < len(points); end++ {
		windowDist += points[end].DistanceFromPrev

		// Shrink window from the left while it still covers the target
		for start < end-1 {
			withoutStart := windowDist - points[start+1].DistanceFromPrev
			if withoutStart >= targetMetres {
				windowDist = withoutStart
				start++
			} else {
				break
			}
		}

		if windowDist >= targetMetres {
			elapsed := float64(points[end].Timestamp-points[start].Timestamp) / 1000.0
			if elapsed > 0 && (bestSec == 0 || elapsed < bestSec) {
				bestSec = elapsed
			}
		}
	}

	return bestSec
}

func detectDistancePRs(currentPoints []GPSPoint, historical []historicalWorkout, family string) []PersonalRecord {
	targets, ok := distancePRTargets[family]
	if !ok {
		return nil
	}

	var prs []PersonalRecord
	for _, t := range targets {
		currentBest := computeBestSegmentTime(currentPoints, t.metres)
		if currentBest <= 0 {
			continue // workout doesn't cover this distance
		}

		// Check against historical using pre-parsed GPS points
		var historicalBest float64
		for _, hw := range historical {
			hBest := computeBestSegmentTime(hw.gpsPoints, t.metres)
			if hBest > 0 && (historicalBest == 0 || hBest < historicalBest) {
				historicalBest = hBest
			}
		}

		if historicalBest == 0 || currentBest < historicalBest {
			pr := PersonalRecord{
				Category:       t.name,
				Value:          math.Round(currentBest*10) / 10,
				FormattedValue: formatDurationSec(currentBest),
				Unit:           "time",
			}
			if historicalBest > 0 {
				pr.PreviousBest = math.Round(historicalBest*10) / 10
				pr.ImprovementPct = math.Round(((historicalBest-currentBest)/historicalBest)*1000) / 10
			}
			prs = append(prs, pr)
		}
	}
	return prs
}

// ── Swimming PRs ────────────────────────────────────────────────────────────

var swimPRTargets = []struct {
	name   string
	metres float64
}{
	{"Fastest 200m", 200},
	{"Fastest 400m", 400},
	{"Fastest 1500m", 1500},
}

func detectSwimPRs(workout *models.Workout, historical []historicalWorkout) []PersonalRecord {
	var rec map[string]any
	if json.Unmarshal(workout.RecordedData, &rec) != nil {
		return nil
	}
	totalDist := floatFromMap(rec, "distance_m")
	if totalDist <= 0 {
		return nil
	}
	totalDur := workout.EffectiveDurationSec()
	if totalDur <= 0 {
		return nil
	}

	var prs []PersonalRecord
	for _, t := range swimPRTargets {
		if totalDist < t.metres {
			continue
		}
		// Estimate segment time proportionally
		currentTime := (t.metres / totalDist) * totalDur

		// Check historical
		var historicalBest float64
		for _, hw := range historical {
			var hRec map[string]any
			if json.Unmarshal(hw.recordedData, &hRec) != nil {
				continue
			}
			hDist := floatFromMap(hRec, "distance_m")
			if hDist < t.metres || hw.durationSec <= 0 {
				continue
			}
			hTime := (t.metres / hDist) * hw.durationSec
			if historicalBest == 0 || hTime < historicalBest {
				historicalBest = hTime
			}
		}

		if historicalBest == 0 || currentTime < historicalBest {
			pr := PersonalRecord{
				Category:       t.name,
				Value:          math.Round(currentTime*10) / 10,
				FormattedValue: formatDurationSec(currentTime),
				Unit:           "time",
			}
			if historicalBest > 0 {
				pr.PreviousBest = math.Round(historicalBest*10) / 10
				pr.ImprovementPct = math.Round(((historicalBest-currentTime)/historicalBest)*1000) / 10
			}
			prs = append(prs, pr)
		}
	}
	return prs
}

// ── Strength PRs ────────────────────────────────────────────────────────────

type exercisePRData struct {
	bestE1RM    float64
	heaviestKg  float64
	totalVolume float64
}

func parseExercisePRs(data json.RawMessage) map[string]*exercisePRData {
	var rec map[string]any
	if json.Unmarshal(data, &rec) != nil {
		return nil
	}
	exercises, ok := rec["exercises"].([]any)
	if !ok || len(exercises) == 0 {
		return nil
	}

	result := make(map[string]*exercisePRData)
	for _, ex := range exercises {
		exMap, ok := ex.(map[string]any)
		if !ok {
			continue
		}
		name, _ := exMap["name"].(string)
		if name == "" {
			continue
		}

		pr := &exercisePRData{}
		sets, _ := exMap["sets"].([]any)
		for _, s := range sets {
			setMap, ok := s.(map[string]any)
			if !ok {
				continue
			}
			reps := floatFromAny(setMap["reps"])
			weight := floatFromAny(setMap["weight"])
			if reps > 0 && weight > 0 {
				// Epley formula: e1RM = weight × (1 + reps/30)
				e1rm := weight * (1 + reps/30)
				if e1rm > pr.bestE1RM {
					pr.bestE1RM = e1rm
				}
				if weight > pr.heaviestKg {
					pr.heaviestKg = weight
				}
				pr.totalVolume += reps * weight
			}
		}
		if pr.bestE1RM > 0 {
			result[name] = pr
		}
	}
	return result
}

func detectStrengthPRs(workout *models.Workout, historical []historicalWorkout) []PersonalRecord {
	currentPRs := parseExercisePRs(workout.RecordedData)
	if len(currentPRs) == 0 {
		return nil
	}

	// Build historical bests per exercise
	historicalBests := make(map[string]*exercisePRData)
	var historicalBestVolume float64
	for _, hw := range historical {
		hPRs := parseExercisePRs(hw.recordedData)
		var sessionVol float64
		for name, hpr := range hPRs {
			sessionVol += hpr.totalVolume
			best, exists := historicalBests[name]
			if !exists {
				historicalBests[name] = &exercisePRData{
					bestE1RM:   hpr.bestE1RM,
					heaviestKg: hpr.heaviestKg,
				}
				continue
			}
			if hpr.bestE1RM > best.bestE1RM {
				best.bestE1RM = hpr.bestE1RM
			}
			if hpr.heaviestKg > best.heaviestKg {
				best.heaviestKg = hpr.heaviestKg
			}
		}
		if sessionVol > historicalBestVolume {
			historicalBestVolume = sessionVol
		}
	}

	var prs []PersonalRecord

	// Sort exercise names for deterministic PR ordering
	exerciseNames := make([]string, 0, len(currentPRs))
	for name := range currentPRs {
		exerciseNames = append(exerciseNames, name)
	}
	sort.Strings(exerciseNames)

	// Per-exercise PRs
	for _, name := range exerciseNames {
		current := currentPRs[name]
		best := historicalBests[name]

		// e1RM PR
		if best == nil || current.bestE1RM > best.bestE1RM {
			pr := PersonalRecord{
				Category:       fmt.Sprintf("%s — Est. 1RM", name),
				Value:          math.Round(current.bestE1RM*10) / 10,
				FormattedValue: fmt.Sprintf("%.1f kg", current.bestE1RM),
				Unit:           "kg",
			}
			if best != nil && best.bestE1RM > 0 {
				pr.PreviousBest = math.Round(best.bestE1RM*10) / 10
				pr.ImprovementPct = math.Round(((current.bestE1RM-best.bestE1RM)/best.bestE1RM)*1000) / 10
			}
			prs = append(prs, pr)
		}

		// Heaviest set PR
		if best == nil || current.heaviestKg > best.heaviestKg {
			pr := PersonalRecord{
				Category:       fmt.Sprintf("%s — Heaviest Set", name),
				Value:          current.heaviestKg,
				FormattedValue: fmt.Sprintf("%.1f kg", current.heaviestKg),
				Unit:           "kg",
			}
			if best != nil && best.heaviestKg > 0 {
				pr.PreviousBest = best.heaviestKg
				pr.ImprovementPct = math.Round(((current.heaviestKg-best.heaviestKg)/best.heaviestKg)*1000) / 10
			}
			prs = append(prs, pr)
		}
	}

	// Session total volume PR
	var currentTotalVol float64
	for _, cp := range currentPRs {
		currentTotalVol += cp.totalVolume
	}
	if currentTotalVol > 0 && currentTotalVol > historicalBestVolume {
		pr := PersonalRecord{
			Category:       "Session Volume",
			Value:          math.Round(currentTotalVol),
			FormattedValue: fmt.Sprintf("%.0f kg", currentTotalVol),
			Unit:           "kg",
		}
		if historicalBestVolume > 0 {
			pr.PreviousBest = math.Round(historicalBestVolume)
			pr.ImprovementPct = math.Round(((currentTotalVol-historicalBestVolume)/historicalBestVolume)*1000) / 10
		}
		prs = append(prs, pr)
	}

	return prs
}

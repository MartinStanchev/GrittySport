package review

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

// Trend constants for cardiac efficiency and HR trend.
const (
	TrendImproving = "improving"
	TrendStable    = "stable"
	TrendDeclining = "declining"
)

// AnalyticsResponse is the JSON shape returned by GET /workouts/{id}/analytics.
type AnalyticsResponse struct {
	EffortScore      int                `json:"effort_score"`
	EffortLabel      string             `json:"effort_label"`
	Splits           []KmSplit          `json:"splits"`
	FastestSplitKm   int                `json:"fastest_split_km"`
	SlowestSplitKm   int                `json:"slowest_split_km"`
	FadePct          float64            `json:"fade_pct"`
	IsNegativeSplit  bool               `json:"is_negative_split"`
	Alignment        *AlignmentData     `json:"program_alignment,omitempty"`
	Trend            *TrendData         `json:"trend,omitempty"`
	PersonalRecords  []PersonalRecord   `json:"personal_records,omitempty"`
	CardiacEfficiency *CardiacEfficiency `json:"cardiac_efficiency,omitempty"`
	WeeklyTrend      *WeeklyTrendData   `json:"weekly_trend,omitempty"`
}

// CardiacEfficiency compares HR at a similar pace across historical workouts.
type CardiacEfficiency struct {
	CurrentPaceSecPerKm float64 `json:"current_pace_sec_per_km"`
	CurrentAvgHR        int     `json:"current_avg_hr"`
	HistoricalAvgHR     int     `json:"historical_avg_hr"`
	ComparisonCount     int     `json:"comparison_count"`
	DeltaHR             int     `json:"delta_hr"`
	Trend               string  `json:"trend"`
	Summary             string  `json:"summary"`
}

// WeeklyTrendData provides structured week-over-week comparison.
type WeeklyTrendData struct {
	VolumeTrend *VolumeTrend `json:"volume_trend,omitempty"`
	EffortTrend *EffortTrend `json:"effort_trend,omitempty"`
	HRTrend     *HRTrend     `json:"hr_trend,omitempty"`
}

// VolumeTrend compares this week's volume to last week's.
type VolumeTrend struct {
	ThisWeekKm       float64 `json:"this_week_km,omitempty"`
	LastWeekKm       float64 `json:"last_week_km,omitempty"`
	ThisWeekSessions int     `json:"this_week_sessions"`
	LastWeekSessions int     `json:"last_week_sessions"`
	ChangeKmPct      float64 `json:"change_km_pct,omitempty"`
	ChangeSessionPct float64 `json:"change_session_pct"`
}

// EffortTrend compares this week's avg effort to last 4 weeks' average.
type EffortTrend struct {
	ThisWeekAvgEffort   float64 `json:"this_week_avg_effort"`
	Last4WeeksAvgEffort float64 `json:"last_4_weeks_avg_effort"`
	ChangePct           float64 `json:"change_pct"`
}

// HRTrend compares HR at similar pace this week vs last 4 weeks.
type HRTrend struct {
	AvgHRAtPaceThisWeek  int    `json:"avg_hr_at_pace_this_week"`
	AvgHRAtPaceLast4Wks  int    `json:"avg_hr_at_pace_last_4_weeks"`
	DeltaHR              int    `json:"delta_hr"`
	Trend                string `json:"trend"`
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
	durationSec := workout.EffectiveDurationSec()

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

	// Cardiac efficiency
	resp.CardiacEfficiency = computeCardiacEfficiency(ctx, pool, workout)

	// Weekly trend
	resp.WeeklyTrend = computeWeeklyTrend(ctx, pool, workout)

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
		actDur := workout.EffectiveDurationSec() / 60
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

	trend := TrendStable
	var comparison string
	actLabel := strings.ReplaceAll(workout.ActivityType, "_", " ")

	switch {
	case diffPct > 2:
		trend = TrendImproving
		comparison = fmt.Sprintf("Your pace was %.0f%% faster than your last %d %ss", diffPct, len(paces), actLabel)
	case diffPct < -2:
		trend = TrendDeclining
		comparison = fmt.Sprintf("Your pace was %.0f%% slower than your last %d %ss", -diffPct, len(paces), actLabel)
	default:
		comparison = fmt.Sprintf("Your pace is consistent with your last %d %ss", len(paces), actLabel)
	}

	return &TrendData{
		ComparisonText: comparison,
		AvgPaceTrend:   trend,
	}
}

func computeCardiacEfficiency(ctx context.Context, pool *pgxpool.Pool, workout *models.Workout) *CardiacEfficiency {
	var currentRec map[string]any
	if json.Unmarshal(workout.RecordedData, &currentRec) != nil {
		return nil
	}

	currentPace := floatFromMap(currentRec, "avg_pace_sec_per_km")
	currentHR := floatFromMap(currentRec, "avg_hr")
	if currentPace <= 0 || currentHR <= 0 {
		return nil
	}

	familyTypes := activityTypesInFamily(activityTypeFamily(workout.ActivityType))
	rows, err := pool.Query(ctx,
		`SELECT recorded_data FROM workouts
		 WHERE user_id = $1 AND activity_type = ANY($2) AND id != $3
		 ORDER BY started_at DESC LIMIT 15`,
		workout.UserID, familyTypes, workout.ID,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	return computeCardiacEfficiencyFromRows(rows, currentPace, currentHR)
}

// computeCardiacEfficiencyFromData is the pure computation, testable without DB.
func computeCardiacEfficiencyFromData(currentPace, currentHR float64, historicalPaces, historicalHRs []float64, paceWindow float64) *CardiacEfficiency {
	if currentPace <= 0 || currentHR <= 0 {
		return nil
	}

	var matchedHRs []float64
	for i, pace := range historicalPaces {
		if math.Abs(pace-currentPace) <= paceWindow && historicalHRs[i] > 0 {
			matchedHRs = append(matchedHRs, historicalHRs[i])
		}
	}

	if len(matchedHRs) < 2 {
		return nil
	}

	var sum float64
	for _, hr := range matchedHRs {
		sum += hr
	}
	historicalAvg := int(math.Round(sum / float64(len(matchedHRs))))
	currentHRInt := int(math.Round(currentHR))
	delta := currentHRInt - historicalAvg

	trend := TrendStable
	switch {
	case delta < -3:
		trend = TrendImproving
	case delta > 3:
		trend = TrendDeclining
	}

	paceFormatted := formatPace(currentPace)
	var summary string
	switch trend {
	case TrendImproving:
		summary = fmt.Sprintf("At %s/km, your avg HR was %d bpm vs %d bpm average — improving cardiac efficiency", paceFormatted, currentHRInt, historicalAvg)
	case TrendDeclining:
		summary = fmt.Sprintf("At %s/km, your avg HR was %d bpm vs %d bpm average — higher than usual", paceFormatted, currentHRInt, historicalAvg)
	default:
		summary = fmt.Sprintf("At %s/km, your avg HR was %d bpm, consistent with your %d bpm average", paceFormatted, currentHRInt, historicalAvg)
	}

	return &CardiacEfficiency{
		CurrentPaceSecPerKm: currentPace,
		CurrentAvgHR:        currentHRInt,
		HistoricalAvgHR:     historicalAvg,
		ComparisonCount:     len(matchedHRs),
		DeltaHR:             delta,
		Trend:               trend,
		Summary:             summary,
	}
}

func computeCardiacEfficiencyFromRows(rows interface{ Next() bool; Scan(...any) error }, currentPace, currentHR float64) *CardiacEfficiency {
	var historicalPaces, historicalHRs []float64
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
		hr := floatFromMap(rec, "avg_hr")
		if pace > 0 && hr > 0 {
			historicalPaces = append(historicalPaces, pace)
			historicalHRs = append(historicalHRs, hr)
		}
	}

	return computeCardiacEfficiencyFromData(currentPace, currentHR, historicalPaces, historicalHRs, 30)
}

func computeWeeklyTrend(ctx context.Context, pool *pgxpool.Pool, workout *models.Workout) *WeeklyTrendData {
	familyTypes := activityTypesInFamily(activityTypeFamily(workout.ActivityType))

	// Get user timezone for week bucketing
	var tzName *string
	_ = pool.QueryRow(ctx, "SELECT timezone FROM users WHERE id = $1", workout.UserID).Scan(&tzName)

	loc := time.UTC
	if tzName != nil && *tzName != "" {
		if parsed, err := time.LoadLocation(*tzName); err == nil {
			loc = parsed
		}
	}

	// Determine current week's Monday
	workoutDate := workout.StartedAt.In(loc)
	weekday := workoutDate.Weekday()
	if weekday == 0 {
		weekday = 7
	}
	currentMonday := workoutDate.AddDate(0, 0, -int(weekday-1))
	currentMonday = time.Date(currentMonday.Year(), currentMonday.Month(), currentMonday.Day(), 0, 0, 0, 0, loc)
	fiveWeeksAgo := currentMonday.AddDate(0, 0, -28) // 4 prior weeks

	rows, err := pool.Query(ctx,
		`SELECT recorded_data, effort_score, started_at
		 FROM workouts
		 WHERE user_id = $1 AND activity_type = ANY($2) AND started_at >= $3
		 ORDER BY started_at DESC`,
		workout.UserID, familyTypes, fiveWeeksAgo.UTC(),
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	type weekBucket struct {
		totalKm      float64
		sessions     int
		effortScores []float64
		paces        []float64
		hrs          []float64
	}
	buckets := make(map[int]*weekBucket) // week offset from currentMonday (0 = this week, -1 = last week, etc.)

	for rows.Next() {
		var recData json.RawMessage
		var effortScore *int
		var startedAt time.Time
		if rows.Scan(&recData, &effortScore, &startedAt) != nil {
			continue
		}

		// Determine week offset
		localStart := startedAt.In(loc)
		daysDiff := int(localStart.Sub(currentMonday).Hours() / 24)
		weekOffset := 0
		if daysDiff < 0 {
			weekOffset = (daysDiff - 6) / 7 // floor division
		}

		b, exists := buckets[weekOffset]
		if !exists {
			b = &weekBucket{}
			buckets[weekOffset] = b
		}
		b.sessions++

		var rec map[string]any
		if json.Unmarshal(recData, &rec) == nil {
			km := floatFromMap(rec, "distance_km")
			if km > 0 {
				b.totalKm += km
			}
			pace := floatFromMap(rec, "avg_pace_sec_per_km")
			hr := floatFromMap(rec, "avg_hr")
			if pace > 0 && hr > 0 {
				b.paces = append(b.paces, pace)
				b.hrs = append(b.hrs, hr)
			}
		}

		if effortScore != nil && *effortScore > 0 {
			b.effortScores = append(b.effortScores, float64(*effortScore))
		}
	}

	result := &WeeklyTrendData{}
	hasData := false

	// Volume trend: this week (0) vs last week (-1)
	thisWeek := buckets[0]
	lastWeek := buckets[-1]
	if thisWeek != nil && lastWeek != nil && lastWeek.sessions > 0 {
		vt := &VolumeTrend{
			ThisWeekSessions: thisWeek.sessions,
			LastWeekSessions: lastWeek.sessions,
			ChangeSessionPct: math.Round(((float64(thisWeek.sessions)-float64(lastWeek.sessions))/float64(lastWeek.sessions))*1000) / 10,
		}
		if thisWeek.totalKm > 0 || lastWeek.totalKm > 0 {
			vt.ThisWeekKm = math.Round(thisWeek.totalKm*10) / 10
			vt.LastWeekKm = math.Round(lastWeek.totalKm*10) / 10
			if lastWeek.totalKm > 0 {
				vt.ChangeKmPct = math.Round(((thisWeek.totalKm-lastWeek.totalKm)/lastWeek.totalKm)*1000) / 10
			}
		}
		result.VolumeTrend = vt
		hasData = true
	}

	// Effort trend: this week avg vs last 4 weeks avg
	if thisWeek != nil && len(thisWeek.effortScores) > 0 {
		var thisSum float64
		for _, e := range thisWeek.effortScores {
			thisSum += e
		}
		thisAvg := thisSum / float64(len(thisWeek.effortScores))

		var priorSum float64
		var priorCount int
		for offset := -1; offset >= -4; offset-- {
			b := buckets[offset]
			if b == nil {
				continue
			}
			for _, e := range b.effortScores {
				priorSum += e
				priorCount++
			}
		}

		if priorCount > 0 {
			priorAvg := priorSum / float64(priorCount)
			result.EffortTrend = &EffortTrend{
				ThisWeekAvgEffort:   math.Round(thisAvg*10) / 10,
				Last4WeeksAvgEffort: math.Round(priorAvg*10) / 10,
				ChangePct:           math.Round(((thisAvg-priorAvg)/priorAvg)*1000) / 10,
			}
			hasData = true
		}
	}

	// HR at pace trend: compare this week vs prior weeks
	if thisWeek != nil && len(thisWeek.paces) > 0 && len(thisWeek.hrs) > 0 {
		// Compute this week's average pace as the reference
		var paceSum float64
		for _, p := range thisWeek.paces {
			paceSum += p
		}
		refPace := paceSum / float64(len(thisWeek.paces))

		// This week's avg HR at similar pace
		var thisHRSum float64
		var thisHRCount int
		for i, p := range thisWeek.paces {
			if math.Abs(p-refPace) <= 30 {
				thisHRSum += thisWeek.hrs[i]
				thisHRCount++
			}
		}

		// Prior weeks' avg HR at similar pace
		var priorHRSum float64
		var priorHRCount int
		for offset := -1; offset >= -4; offset-- {
			b := buckets[offset]
			if b == nil {
				continue
			}
			for i, p := range b.paces {
				if math.Abs(p-refPace) <= 30 {
					priorHRSum += b.hrs[i]
					priorHRCount++
				}
			}
		}

		if thisHRCount > 0 && priorHRCount >= 2 {
			thisAvgHR := int(math.Round(thisHRSum / float64(thisHRCount)))
			priorAvgHR := int(math.Round(priorHRSum / float64(priorHRCount)))
			delta := thisAvgHR - priorAvgHR
			trend := TrendStable
			if delta < -3 {
				trend = TrendImproving
			} else if delta > 3 {
				trend = TrendDeclining
			}
			result.HRTrend = &HRTrend{
				AvgHRAtPaceThisWeek: thisAvgHR,
				AvgHRAtPaceLast4Wks: priorAvgHR,
				DeltaHR:             delta,
				Trend:               trend,
			}
			hasData = true
		}
	}

	if !hasData {
		return nil
	}
	return result
}

func formatPace(secPerKm float64) string {
	if secPerKm <= 0 {
		return "--:--"
	}
	min := int(secPerKm) / 60
	sec := int(secPerKm) % 60
	return fmt.Sprintf("%d:%02d/km", min, sec)
}

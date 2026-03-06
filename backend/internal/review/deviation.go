package review

import (
	"encoding/json"
	"math"
)

// DeviationMetrics holds deviation percentages between prescribed and actual workout metrics.
type DeviationMetrics struct {
	DistanceDeviationPct *float64 `json:"distance_deviation_pct,omitempty"`
	PaceDeviationPct     *float64 `json:"pace_deviation_pct,omitempty"`
	SpeedDeviationPct    *float64 `json:"speed_deviation_pct,omitempty"`
	VolumeDeviationPct   *float64 `json:"volume_deviation_pct,omitempty"`
	DurationDeviationPct *float64 `json:"duration_deviation_pct,omitempty"`
}

// HRReading mirrors the frontend HR reading structure.
type HRReading struct {
	BPM       int   `json:"bpm"`
	Timestamp int64 `json:"timestamp"` // Unix ms
}

// GPSPoint mirrors the frontend GPS point structure.
type GPSPoint struct {
	Lat              float64  `json:"lat"`
	Lng              float64  `json:"lng"`
	Altitude         *float64 `json:"altitude"`
	Accuracy         float64  `json:"accuracy"`
	Speed            *float64 `json:"speed"`
	Timestamp        int64    `json:"timestamp"`
	DistanceFromPrev float64  `json:"distance_from_prev"`
}

type zoneWeight struct {
	zone   int
	weight float64
}

var zoneWeights = []zoneWeight{
	{1, 1.0},
	{2, 1.5},
	{3, 2.5},
	{4, 3.5},
	{5, 5.0},
}

const normalisationFactor = 60 * 1.5 // 60min Z2 anchor

func getHRZone(bpm, maxHR int) int {
	if maxHR <= 0 {
		return 1
	}
	pct := float64(bpm) / float64(maxHR)
	switch {
	case pct < 0.6:
		return 1
	case pct < 0.7:
		return 2
	case pct < 0.8:
		return 3
	case pct < 0.9:
		return 4
	default:
		return 5
	}
}

func zoneWeightFor(zone int) float64 {
	for _, zw := range zoneWeights {
		if zw.zone == zone {
			return zw.weight
		}
	}
	return 1.0
}

// ComputeEffortScore calculates a TRIMP-based effort score (0-100).
func ComputeEffortScore(hrData json.RawMessage, maxHR int, durationSec float64) int {
	if len(hrData) == 0 || maxHR <= 0 || durationSec <= 0 {
		return 0
	}

	var data struct {
		Readings []HRReading `json:"readings"`
	}
	if err := json.Unmarshal(hrData, &data); err != nil || len(data.Readings) < 2 {
		return 0
	}

	var trimp float64
	for i := 1; i < len(data.Readings); i++ {
		dtMin := float64(data.Readings[i].Timestamp-data.Readings[i-1].Timestamp) / 60000.0
		zone := getHRZone(data.Readings[i-1].BPM, maxHR)
		trimp += dtMin * zoneWeightFor(zone)
	}

	score := int(math.Round((trimp / normalisationFactor) * 50))
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}

// EffortLabel returns a human-readable label for an effort score.
func EffortLabel(score int) string {
	switch {
	case score < 25:
		return "Easy"
	case score < 50:
		return "Moderate"
	case score < 75:
		return "Hard"
	case score < 90:
		return "Very Hard"
	default:
		return "Max"
	}
}

// KmSplit represents stats for a 1km segment.
type KmSplit struct {
	Km            int     `json:"km"`
	DurationSec   float64 `json:"duration_sec"`
	PaceSecPerKm  float64 `json:"pace_sec_per_km"`
	AvgHR         *int    `json:"avg_hr,omitempty"`
	ElevationGain float64 `json:"elevation_gain"`
}

// ComputeKmSplits walks GPS points and emits a split every 1000m.
func ComputeKmSplits(gpsRoute json.RawMessage) []KmSplit {
	if len(gpsRoute) == 0 {
		return nil
	}

	var route struct {
		Points []GPSPoint `json:"points"`
	}
	if err := json.Unmarshal(gpsRoute, &route); err != nil || len(route.Points) < 2 {
		return nil
	}

	var splits []KmSplit
	splitStart := 0
	var splitDist float64

	for i := 1; i < len(route.Points); i++ {
		splitDist += route.Points[i].DistanceFromPrev

		if splitDist >= 1000 {
			km := len(splits) + 1
			startTs := route.Points[splitStart].Timestamp
			endTs := route.Points[i].Timestamp
			durSec := float64(endTs-startTs) / 1000.0
			pace := 0.0
			if durSec > 0 && splitDist > 0 {
				pace = (durSec / splitDist) * 1000
			}

			splits = append(splits, KmSplit{
				Km:           km,
				DurationSec:  durSec,
				PaceSecPerKm: math.Round(pace*10) / 10,
			})

			splitStart = i
			splitDist = 0
		}
	}

	return splits
}

// ComputeRunDeviation computes deviation for run/cycling workouts.
func ComputeRunDeviation(prescription map[string]any, recordedData json.RawMessage) DeviationMetrics {
	var dm DeviationMetrics
	var recorded map[string]any
	if err := json.Unmarshal(recordedData, &recorded); err != nil {
		return dm
	}

	prescribedDist := floatFromMap(prescription, "distance_km")
	actualDist := floatFromMap(recorded, "distance_km")
	if prescribedDist > 0 && actualDist > 0 {
		d := ((actualDist - prescribedDist) / prescribedDist) * 100
		d = math.Round(d*10) / 10
		dm.DistanceDeviationPct = &d
	}

	prescribedPace := floatFromMap(prescription, "target_pace_sec_per_km")
	actualPace := floatFromMap(recorded, "avg_pace_sec_per_km")
	if prescribedPace > 0 && actualPace > 0 {
		// Lower pace = faster, so positive deviation means faster
		d := ((prescribedPace - actualPace) / prescribedPace) * 100
		d = math.Round(d*10) / 10
		dm.PaceDeviationPct = &d
	}

	return dm
}

// ComputeStrengthDeviation computes deviation for strength workouts (total volume).
func ComputeStrengthDeviation(prescription map[string]any, recordedData json.RawMessage) DeviationMetrics {
	var dm DeviationMetrics
	var recorded map[string]any
	if err := json.Unmarshal(recordedData, &recorded); err != nil {
		return dm
	}

	prescribedVol := computeVolume(prescription)
	actualVol := computeVolume(recorded)
	if prescribedVol > 0 && actualVol > 0 {
		d := ((actualVol - prescribedVol) / prescribedVol) * 100
		d = math.Round(d*10) / 10
		dm.VolumeDeviationPct = &d
	}

	return dm
}

// ComputeGenericDeviation computes deviation based on duration.
func ComputeGenericDeviation(prescription map[string]any, recordedData json.RawMessage, durationSec float64) DeviationMetrics {
	var dm DeviationMetrics

	prescribedMin := floatFromMap(prescription, "duration_minutes")
	if prescribedMin > 0 && durationSec > 0 {
		actualMin := durationSec / 60
		d := ((actualMin - prescribedMin) / prescribedMin) * 100
		d = math.Round(d*10) / 10
		dm.DurationDeviationPct = &d
	}

	return dm
}

// computeVolume calculates total volume (sets × reps × weight) from exercises.
func computeVolume(data map[string]any) float64 {
	exercises, ok := data["exercises"]
	if !ok {
		return 0
	}
	exList, ok := exercises.([]any)
	if !ok {
		return 0
	}

	var total float64
	for _, ex := range exList {
		exMap, ok := ex.(map[string]any)
		if !ok {
			continue
		}
		sets, _ := exMap["sets"].([]any)
		for _, s := range sets {
			setMap, ok := s.(map[string]any)
			if !ok {
				continue
			}
			reps := floatFromAny(setMap["reps"])
			weight := floatFromAny(setMap["weight"])
			if reps > 0 && weight > 0 {
				total += reps * weight
			}
		}
		// If no sets array, try sets/reps/weight as direct fields (prescription format)
		if len(sets) == 0 {
			numSets := floatFromAny(exMap["sets"])
			reps := floatFromAny(exMap["reps"])
			weight := floatFromAny(exMap["weight"])
			if numSets > 0 && reps > 0 && weight > 0 {
				total += numSets * reps * weight
			}
		}
	}
	return total
}

func floatFromMap(m map[string]any, key string) float64 {
	v, ok := m[key]
	if !ok {
		return 0
	}
	return floatFromAny(v)
}

func floatFromAny(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case json.Number:
		f, _ := val.Float64()
		return f
	default:
		return 0
	}
}

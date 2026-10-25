package models

import (
	"encoding/json"
	"fmt"
	"math"
	"slices"
)

// Prescriptions are free-form JSON objects, but every measurable value uses a
// canonical numeric key in metric base units so the backend can compute
// progression and compare plan vs. actual. Display formatting (km, min:sec,
// etc.) happens in the frontend.
//
// Top level:   distance_m, total_distance_m, duration_sec, pace_sec_per_km,
//              pace_sec_per_100m, power_w, rpe, plus descriptive strings
//              (effort, intensity, warmup, cooldown, focus, ...).
// sets[]:      reps, distance_m, duration_sec, pace_sec_per_km,
//              pace_sec_per_100m, power_w, rest_sec, rpe, rest (string).
// exercises[]: name, sets (count), reps, weight_kg, duration_sec, rest_sec, rpe.

// PassiveActivityTypes are scheduled activity types that are restorative
// rather than training load: they don't trigger reminders or missed-workout
// reviews, and deload weeks leave them unchanged.
var PassiveActivityTypes = []string{"rest", "recovery", "mobility", "yoga"}

// legacyPrescriptionKeys maps human-string keys the LLM may still reach for to
// the canonical numeric key that replaces them.
var legacyPrescriptionKeys = map[string]string{
	"distance":       "distance_m (meters, number)",
	"total_distance": "total_distance_m (meters, number)",
	"duration":       "duration_sec (seconds, number)",
	"time":           "duration_sec (seconds, number)",
	"pace":           "pace_sec_per_km or pace_sec_per_100m (seconds, number)",
	"weight":         "weight_kg (kilograms, number)",
	"rest_seconds":   "rest_sec (seconds, number)",
}

var numericPrescriptionKeys = []string{
	"distance_m", "total_distance_m", "duration_sec", "pace_sec_per_km",
	"pace_sec_per_100m", "power_w", "weight_kg", "rest_sec", "reps",
}

type prescriptionNode int

const (
	nodeTop prescriptionNode = iota
	nodeSet
	nodeExercise
)

// ValidatePrescription checks that a prescription uses the canonical numeric
// keys. Event prescriptions (race metadata) are exempt.
func ValidatePrescription(activityType string, raw json.RawMessage) error {
	if len(raw) == 0 || string(raw) == "null" || activityType == "event" {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return fmt.Errorf("prescription must be a JSON object")
	}
	return validatePrescriptionNode("prescription", m, nodeTop)
}

func validatePrescriptionNode(path string, m map[string]any, node prescriptionNode) error {
	for key, v := range m {
		keyPath := path + "." + key
		if replacement, ok := legacyPrescriptionKeys[key]; ok {
			return fmt.Errorf("%s is not supported — use %s", keyPath, replacement)
		}
		switch {
		case key == "rpe":
			n, ok := v.(float64)
			if !ok || n < 1 || n > 10 {
				return fmt.Errorf("%s must be a number between 1 and 10", keyPath)
			}
		case key == "sets" && node == nodeTop:
			if err := validateNodeList(keyPath, v, nodeSet); err != nil {
				return err
			}
		case key == "sets" && node == nodeExercise:
			if !isPositiveInt(v) {
				return fmt.Errorf("%s must be a whole number of sets", keyPath)
			}
		case key == "exercises" && node == nodeTop:
			if err := validateNodeList(keyPath, v, nodeExercise); err != nil {
				return err
			}
		case key == "reps":
			if !isPositiveInt(v) {
				return fmt.Errorf("%s must be a whole number", keyPath)
			}
		case slices.Contains(numericPrescriptionKeys, key):
			if n, ok := v.(float64); !ok || n < 0 {
				return fmt.Errorf("%s must be a non-negative number (not a string with units)", keyPath)
			}
		}
	}
	return nil
}

func validateNodeList(path string, v any, node prescriptionNode) error {
	list, ok := v.([]any)
	if !ok {
		return fmt.Errorf("%s must be an array of objects", path)
	}
	for i, item := range list {
		obj, ok := item.(map[string]any)
		if !ok {
			return fmt.Errorf("%s[%d] must be an object", path, i)
		}
		if err := validatePrescriptionNode(fmt.Sprintf("%s[%d]", path, i), obj, node); err != nil {
			return err
		}
	}
	return nil
}

func isPositiveInt(v any) bool {
	n, ok := v.(float64)
	return ok && n >= 1 && n == math.Trunc(n)
}

// PrescribedDistanceM returns the session's planned distance in meters
// (distance_m, falling back to total_distance_m), or 0.
func PrescribedDistanceM(p map[string]any) float64 {
	if d, ok := p["distance_m"].(float64); ok && d > 0 {
		return d
	}
	d, _ := p["total_distance_m"].(float64)
	return d
}

// PrescribedDurationSec returns the session's planned duration in seconds, or 0.
func PrescribedDurationSec(p map[string]any) float64 {
	d, _ := p["duration_sec"].(float64)
	return d
}

// RecordedDistanceM returns a recorded workout's distance in meters. GPS and
// imported workouts log distance_km; manually logged ones log distance_m.
func RecordedDistanceM(recorded map[string]any) float64 {
	if km, ok := recorded["distance_km"].(float64); ok && km > 0 {
		return km * 1000
	}
	m, _ := recorded["distance_m"].(float64)
	return m
}

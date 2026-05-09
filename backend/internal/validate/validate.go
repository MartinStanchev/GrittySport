// Package validate centralizes range/length checks for user-supplied input.
// Each handler validates at the system boundary so internal code can trust the
// data; bounds are deliberately loose enough to accept any plausible real
// value but tight enough to reject obvious abuse (megabyte-long strings,
// negative weights, future birth years, etc.).
package validate

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// MaxNameLen caps human display names for users and programs.
const MaxNameLen = 200

// MaxNotesLen caps free-form notes (program notes, criterion values).
const MaxNotesLen = 4000

// MaxCriterionLabelLen caps a single criterion's display label.
const MaxCriterionLabelLen = 200

// MaxCriterionValueLen caps a single criterion's stored value.
const MaxCriterionValueLen = 2000

// MaxPushTokenLen caps Expo push tokens (real tokens are <100 chars).
const MaxPushTokenLen = 256

// Bounds for body / training metrics — loose enough to accept any real value,
// tight enough to reject obvious garbage that would propagate into prompts or
// analytics.
const (
	MinHeartRate          = 30
	MaxHeartRate          = 250
	MinHeightCm           = 50.0
	MaxHeightCm           = 280.0
	MinWeightKg           = 20.0
	MaxWeightKg           = 500.0
	MinBirthYear          = 1900
	MinWeeklyEffortGoal   = 0
	MaxWeeklyEffortGoal   = 10000
)

// String checks that s is non-empty (after trimming) and within max chars.
// Use it for required text fields like Name.
func String(field, s string, max int) error {
	if strings.TrimSpace(s) == "" {
		return fmt.Errorf("%s is required", field)
	}
	if utf8.RuneCountInString(s) > max {
		return fmt.Errorf("%s must be at most %d characters", field, max)
	}
	return nil
}

// OptionalString checks that s is within max chars (empty is OK).
func OptionalString(field, s string, max int) error {
	if utf8.RuneCountInString(s) > max {
		return fmt.Errorf("%s must be at most %d characters", field, max)
	}
	return nil
}

// IntRange checks min <= v <= max.
func IntRange(field string, v, min, max int) error {
	if v < min || v > max {
		return fmt.Errorf("%s must be between %d and %d", field, min, max)
	}
	return nil
}

// FloatRange checks min <= v <= max.
func FloatRange(field string, v, min, max float64) error {
	if v < min || v > max {
		return fmt.Errorf("%s must be between %v and %v", field, min, max)
	}
	return nil
}

// Timezone returns an error unless tz is a valid IANA zone known to the Go
// runtime. Empty string is rejected; use OptionalTimezone for optional fields.
func Timezone(tz string) error {
	if tz == "" {
		return errors.New("timezone is required")
	}
	if _, err := time.LoadLocation(tz); err != nil {
		return errors.New("timezone is not a recognized IANA zone")
	}
	return nil
}

// BirthYear validates that y is between 1900 and the current year inclusive.
func BirthYear(y int) error {
	currentYear := time.Now().UTC().Year()
	return IntRange("birth_year", y, MinBirthYear, currentYear)
}

package notifications

import (
	"math/rand/v2"
	"strings"
)

// FormatActivityLabel turns a canonical snake_case activity type into a
// human-friendly label suitable for notification titles.
// e.g. "strength_training" -> "Strength", "long_run" -> "Long Run".
func FormatActivityLabel(activityType string) string {
	if activityType == "" {
		return "Workout"
	}
	switch activityType {
	case "strength_training":
		return "Strength"
	case "mobility_recovery":
		return "Mobility"
	case "run":
		return "Run"
	case "cycling":
		return "Ride"
	case "swimming":
		return "Swim"
	}
	parts := strings.Split(activityType, "_")
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}

// missedWorkoutBodies are randomized push bodies used when a scheduled session is missed.
var missedWorkoutBodies = []string{
	"Tap to check in with Grit.",
	"Life happens — let's regroup.",
	"Grit has thoughts. Want to chat?",
	"Skipped a session? Let's talk it through.",
	"No stress — Grit's here when you're ready.",
}

// PickMissedWorkoutBody returns a random body string for a missed-workout push.
func PickMissedWorkoutBody() string {
	return missedWorkoutBodies[rand.IntN(len(missedWorkoutBodies))]
}

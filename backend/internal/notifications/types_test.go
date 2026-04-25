package notifications

import (
	"testing"
)

func TestRegistryLookup(t *testing.T) {
	// All registry entries should be findable via Lookup
	for _, nt := range Registry {
		found, ok := Lookup(nt.Key)
		if !ok {
			t.Errorf("Lookup(%q) returned false, want true", nt.Key)
			continue
		}
		if found.Key != nt.Key {
			t.Errorf("Lookup(%q).Key = %q, want %q", nt.Key, found.Key, nt.Key)
		}
		if found.Label == "" {
			t.Errorf("Lookup(%q).Label is empty", nt.Key)
		}
		if found.DefaultTitle == "" {
			t.Errorf("Lookup(%q).DefaultTitle is empty", nt.Key)
		}
	}
}

func TestLookupUnknown(t *testing.T) {
	_, ok := Lookup("nonexistent_type")
	if ok {
		t.Error("Lookup(nonexistent_type) returned true, want false")
	}
}

func TestRegistryUniqueKeys(t *testing.T) {
	seen := make(map[string]bool, len(Registry))
	for _, nt := range Registry {
		if seen[nt.Key] {
			t.Errorf("Duplicate registry key: %q", nt.Key)
		}
		seen[nt.Key] = true
	}
}

func TestRegistryExpectedTypes(t *testing.T) {
	expected := []string{"workout_reminder", "post_workout_review", "missed_workout", "pre_workout_checkin"}
	for _, key := range expected {
		if _, ok := Lookup(key); !ok {
			t.Errorf("Expected notification type %q not found in registry", key)
		}
	}
}

func TestWorkoutReminderIsFree(t *testing.T) {
	nt, ok := Lookup("workout_reminder")
	if !ok {
		t.Fatal("workout_reminder not found")
	}
	if nt.RequiresPremium {
		t.Error("workout_reminder should be available to free users")
	}
}

func TestPremiumTypes(t *testing.T) {
	premiumTypes := []string{"post_workout_review", "missed_workout", "pre_workout_checkin"}
	for _, key := range premiumTypes {
		nt, ok := Lookup(key)
		if !ok {
			t.Fatalf("%s not found", key)
		}
		if !nt.RequiresPremium {
			t.Errorf("%s should require premium", key)
		}
	}
}

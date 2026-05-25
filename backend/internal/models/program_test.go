package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDowOffset(t *testing.T) {
	tests := []struct {
		dow    int
		expect int
	}{
		{0, 6}, // Sunday → 6 days after Monday
		{1, 0}, // Monday → 0
		{2, 1}, // Tuesday → 1
		{3, 2}, // Wednesday → 2
		{4, 3}, // Thursday → 3
		{5, 4}, // Friday → 4
		{6, 5}, // Saturday → 5
	}
	for _, tc := range tests {
		if got := DowOffset(tc.dow); got != tc.expect {
			t.Errorf("DowOffset(%d) = %d, want %d", tc.dow, got, tc.expect)
		}
	}
}

func TestMondayOf(t *testing.T) {
	tests := []struct {
		input  string
		expect string
	}{
		{"2026-02-23", "2026-02-23"}, // Monday → Monday
		{"2026-02-24", "2026-02-23"}, // Tuesday → Monday
		{"2026-02-25", "2026-02-23"}, // Wednesday → Monday
		{"2026-02-26", "2026-02-23"}, // Thursday → Monday
		{"2026-02-27", "2026-02-23"}, // Friday → Monday
		{"2026-02-28", "2026-02-23"}, // Saturday → Monday
		{"2026-03-01", "2026-02-23"}, // Sunday → previous Monday
		{"2026-03-02", "2026-03-02"}, // Next Monday
		{"2026-03-08", "2026-03-02"}, // Sunday → its Monday
	}
	for _, tc := range tests {
		input, _ := time.Parse("2006-01-02", tc.input)
		got := MondayOf(input).Format("2006-01-02")
		if got != tc.expect {
			t.Errorf("MondayOf(%s) = %s, want %s", tc.input, got, tc.expect)
		}
	}
}

func TestWeekToResponse_NormalizesToMonday(t *testing.T) {
	programStart, _ := time.Parse("2006-01-02", "2026-02-23")

	// Week with a non-Monday start_date in the DB (Sunday March 1)
	badStart, _ := time.Parse("2006-01-02", "2026-03-01")
	w := Week{
		ID:         "w1",
		PhaseID:    "p1",
		WeekNumber: 1,
		StartDate:  &badStart,
		Activities: []ScheduledActivity{
			{ID: "a1", DayOfWeek: 1, ActivityType: "run", Prescription: json.RawMessage("{}")},
			{ID: "a2", DayOfWeek: 3, ActivityType: "swim", Prescription: json.RawMessage("{}")},
		},
	}

	resp := w.ToResponse(programStart)

	if resp.StartDate != "2026-02-23" {
		t.Errorf("WeekResponse.StartDate = %s, want 2026-02-23", resp.StartDate)
	}

	expectedDates := map[string]string{
		"a1": "2026-02-23", // Monday
		"a2": "2026-02-25", // Wednesday
	}
	for _, a := range resp.Activities {
		if want, ok := expectedDates[a.ID]; ok && a.Date != want {
			t.Errorf("Activity %s date = %s, want %s", a.ID, a.Date, want)
		}
	}
}

func TestWeekToResponse_FallbackFromProgramStart(t *testing.T) {
	programStart, _ := time.Parse("2006-01-02", "2026-02-23")

	w := Week{
		ID:         "w2",
		PhaseID:    "p1",
		WeekNumber: 2,
		StartDate:  nil,
		Activities: []ScheduledActivity{
			{ID: "a1", DayOfWeek: 6, ActivityType: "run", Prescription: json.RawMessage("{}")},
		},
	}

	resp := w.ToResponse(programStart)

	// Week 2: programStart + 7 = March 2 (Monday), already Monday
	if resp.StartDate != "2026-03-02" {
		t.Errorf("WeekResponse.StartDate = %s, want 2026-03-02", resp.StartDate)
	}

	// Saturday of week 2: March 2 + 5 = March 7
	if resp.Activities[0].Date != "2026-03-07" {
		t.Errorf("Activity date = %s, want 2026-03-07", resp.Activities[0].Date)
	}
}

func TestIsValidEditAction(t *testing.T) {
	for _, a := range ValidEditActions {
		if !IsValidEditAction(a) {
			t.Errorf("IsValidEditAction(%q) = false, want true", a)
		}
	}
	for _, a := range []string{"", "update_activity_type_filter", "delete_activity", "unknown"} {
		if IsValidEditAction(a) {
			t.Errorf("IsValidEditAction(%q) = true, want false", a)
		}
	}
}

func TestWeekToResponse_SundayActivity(t *testing.T) {
	programStart, _ := time.Parse("2006-01-02", "2026-02-23")

	w := Week{
		ID:         "w1",
		PhaseID:    "p1",
		WeekNumber: 1,
		StartDate:  nil,
		Activities: []ScheduledActivity{
			{ID: "a1", DayOfWeek: 0, ActivityType: "rest", Prescription: json.RawMessage("{}")},
		},
	}

	resp := w.ToResponse(programStart)

	// Sunday: Monday Feb 23 + 6 = March 1
	if resp.Activities[0].Date != "2026-03-01" {
		t.Errorf("Sunday activity date = %s, want 2026-03-01", resp.Activities[0].Date)
	}
}

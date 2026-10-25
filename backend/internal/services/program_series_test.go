package services_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

func seedProgramUser(t *testing.T) string {
	t.Helper()
	cleanTables(t)
	var userID string
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO users (email, name, profile_completed) VALUES ('series@example.com', 'Series', true) RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return userID
}

// longRunProgram is one 5-week phase starting two weeks before this week, so
// weeks 1-2 are past, week 3 is the current week and weeks 4-5 are upcoming.
// The Sunday long run (+1 km/week) is open from week 3 on whatever today is.
func longRunProgram() models.TemplateProgramInput {
	start := models.MondayOf(time.Now()).AddDate(0, 0, -14).Format("2006-01-02")
	return models.TemplateProgramInput{
		Name:      "Base",
		StartDate: start,
		Phases: []models.TemplatePhaseInput{{
			Name:          "Base",
			DurationWeeks: 5,
			PhaseLoad:     models.PhaseLoad{DeloadWeeks: []int{5}},
			TemplateWeek: models.TemplateWeek{Activities: []models.TemplateActivity{{
				DayOfWeek:    0,
				ActivityType: "run",
				Notes:        "Long run",
				Prescription: json.RawMessage(`{"distance_m":10000,"pace_sec_per_km":375}`),
				Progression:  []models.ProgressionRule{{Field: "distance_m", Step: 1000}},
			}}},
		}},
	}
}

// dayActivities returns the activities on `day` for each week, in week order.
func dayActivities(t *testing.T, svc *services.ProgramService, programID, userID string, day int) [][]models.ScheduledActivityResponse {
	t.Helper()
	p, err := svc.GetByID(context.Background(), programID, userID)
	if err != nil {
		t.Fatalf("get program: %v", err)
	}
	var out [][]models.ScheduledActivityResponse
	for _, ph := range p.Phases {
		for _, w := range ph.Weeks {
			var acts []models.ScheduledActivityResponse
			for _, a := range w.Activities {
				if a.DayOfWeek == day {
					acts = append(acts, a)
				}
			}
			out = append(out, acts)
		}
	}
	return out
}

func distanceOf(t *testing.T, a models.ScheduledActivityResponse) float64 {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(a.Prescription, &m); err != nil {
		t.Fatalf("unmarshal prescription: %v", err)
	}
	d, _ := m["distance_m"].(float64)
	return d
}

func assertDistances(t *testing.T, weeks [][]models.ScheduledActivityResponse, want []float64) {
	t.Helper()
	if len(weeks) != len(want) {
		t.Fatalf("got %d weeks, want %d", len(weeks), len(want))
	}
	for i, acts := range weeks {
		if len(acts) != 1 {
			t.Fatalf("week %d has %d activities, want 1", i+1, len(acts))
		}
		if got := distanceOf(t, acts[0]); got != want[i] {
			t.Errorf("week %d distance_m = %v, want %v", i+1, got, want[i])
		}
	}
}

func saveProgram(t *testing.T, svc *services.ProgramService, userID string, tmpl models.TemplateProgramInput) string {
	t.Helper()
	p, err := svc.SaveProgramWithCriteria(context.Background(), userID, tmpl, "grit", nil, "")
	if err != nil {
		t.Fatalf("save program: %v", err)
	}
	return p.ID
}

func TestSaveProgram_MaterializesProgressionAndDeload(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	programID := saveProgram(t, svc, userID, longRunProgram())

	weeks := dayActivities(t, svc, programID, userID, 0)
	// Week 5 is a deload: the 14000 level cut by the default 35% → 9100.
	assertDistances(t, weeks, []float64{10000, 11000, 12000, 13000, 9100})

	if len(weeks[0][0].Progression) != 1 {
		t.Errorf("activity should expose its series progression, got %v", weeks[0][0].Progression)
	}
	p, _ := svc.GetByID(context.Background(), programID, userID)
	if !p.Phases[0].Weeks[4].IsDeload || p.Phases[0].Weeks[3].IsDeload {
		t.Error("is_deload should be set on week 5 only")
	}
}

func TestApplyEdits_SeriesUpdateRebasesUpcomingWeeksOnly(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	ctx := context.Background()
	programID := saveProgram(t, svc, userID, longRunProgram())

	// User individually edits week 4 — series edits must leave it alone.
	week4 := dayActivities(t, svc, programID, userID, 0)[3][0]
	if _, err := svc.ApplyEdits(ctx, programID, userID, []models.ProgramEdit{{
		Action: "update_activity", ActivityID: week4.ID, Prescription: json.RawMessage(`{"distance_m":5000}`),
	}}); err != nil {
		t.Fatalf("by-id edit: %v", err)
	}

	// Switch the ramp to +5% from the current week: week 3's progressed
	// level (12000) becomes the new base.
	sunday := 0
	rules := []models.ProgressionRule{{Field: "distance_m", Percent: 5}}
	n, err := svc.ApplyEdits(ctx, programID, userID, []models.ProgramEdit{{
		Action: "update_activity", DayOfWeek: &sunday, Progression: &rules,
	}})
	if err != nil {
		t.Fatalf("series edit: %v", err)
	}
	if n != 2 {
		t.Errorf("updated %d instances, want 2 (weeks 3 and 5)", n)
	}

	weeks := dayActivities(t, svc, programID, userID, 0)
	// Past weeks untouched, week 4 kept its override, week 5 = 12000 × 1.05²
	// = 13230 → 13200, cut 35% for the deload → 8600.
	assertDistances(t, weeks, []float64{10000, 11000, 12000, 5000, 8600})
	if !weeks[3][0].IsOverride || len(weeks[3][0].Progression) != 0 {
		t.Error("overridden week should be flagged and not expose series progression")
	}
}

func TestApplyEdits_SeriesUpdateWithNewPrescription(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	programID := saveProgram(t, svc, userID, longRunProgram())

	sunday := 0
	if _, err := svc.ApplyEdits(context.Background(), programID, userID, []models.ProgramEdit{{
		Action: "update_activity", DayOfWeek: &sunday, Prescription: json.RawMessage(`{"distance_m":8000,"pace_sec_per_km":380}`),
	}}); err != nil {
		t.Fatalf("series edit: %v", err)
	}
	// The new prescription is week 3's value; +1 km/week continues from it.
	assertDistances(t, dayActivities(t, svc, programID, userID, 0), []float64{10000, 11000, 8000, 9000, 6500})
}

func TestApplyEdits_RemoveSeriesKeepsHistory(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	ctx := context.Background()
	programID := saveProgram(t, svc, userID, longRunProgram())

	sunday := 0
	if _, err := svc.ApplyEdits(ctx, programID, userID, []models.ProgramEdit{{
		Action: "remove_activity", DayOfWeek: &sunday,
	}}); err != nil {
		t.Fatalf("remove: %v", err)
	}
	weeks := dayActivities(t, svc, programID, userID, 0)
	for i, acts := range weeks {
		want := 0
		if i < 2 {
			want = 1
		}
		if len(acts) != want {
			t.Errorf("week %d has %d activities, want %d", i+1, len(acts), want)
		}
	}
	var seriesCount int
	_ = testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_series s JOIN phases ph ON ph.id = s.phase_id WHERE ph.program_id = $1`, programID,
	).Scan(&seriesCount)
	if seriesCount != 0 {
		t.Errorf("series rows = %d, want 0", seriesCount)
	}
}

func TestApplyEdits_AddSeriesFillsUpcomingWeeks(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	programID := saveProgram(t, svc, userID, longRunProgram())

	sunday := 0
	rules := []models.ProgressionRule{{Field: "weight_kg", Exercise: "Squat", Step: 2.5}}
	n, err := svc.ApplyEdits(context.Background(), programID, userID, []models.ProgramEdit{{
		Action:       "add_activity",
		DayOfWeek:    &sunday,
		ActivityType: "strength_training",
		Prescription: json.RawMessage(`{"exercises":[{"name":"Squat","sets":3,"reps":5,"weight_kg":60}]}`),
		Progression:  &rules,
	}})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if n != 3 {
		t.Errorf("added %d instances, want 3 (weeks 3-5)", n)
	}

	weeks := dayActivities(t, svc, programID, userID, 0)
	wantWeights := map[int]float64{2: 60, 3: 62.5, 4: 65}
	for i, acts := range weeks {
		var lift *models.ScheduledActivityResponse
		for j := range acts {
			if acts[j].ActivityType == "strength_training" {
				lift = &acts[j]
			}
		}
		want, upcoming := wantWeights[i]
		if !upcoming {
			if lift != nil {
				t.Errorf("week %d (past) got a new strength session", i+1)
			}
			continue
		}
		if lift == nil {
			t.Fatalf("week %d missing strength session", i+1)
		}
		var p struct {
			Exercises []struct {
				Sets     float64 `json:"sets"`
				WeightKg float64 `json:"weight_kg"`
			} `json:"exercises"`
		}
		_ = json.Unmarshal(lift.Prescription, &p)
		if p.Exercises[0].WeightKg != want {
			t.Errorf("week %d squat = %v kg, want %v", i+1, p.Exercises[0].WeightKg, want)
		}
		if i == 4 && p.Exercises[0].Sets != 2 {
			t.Errorf("deload week squat sets = %v, want 2", p.Exercises[0].Sets)
		}
	}
}

func TestApplyEdits_SwapDayMovesSeriesAndUpcomingWeeks(t *testing.T) {
	userID := seedProgramUser(t)
	svc := services.NewProgramService(testPool)
	ctx := context.Background()
	programID := saveProgram(t, svc, userID, longRunProgram())

	sunday, saturday := 0, 6
	if _, err := svc.ApplyEdits(ctx, programID, userID, []models.ProgramEdit{{
		Action: "swap_day", DayOfWeek: &sunday, NewDay: &saturday,
	}}); err != nil {
		t.Fatalf("swap: %v", err)
	}

	sundays := dayActivities(t, svc, programID, userID, 0)
	saturdays := dayActivities(t, svc, programID, userID, 6)
	for i := 0; i < 2; i++ {
		if len(sundays[i]) != 1 {
			t.Errorf("past week %d should keep its Sunday run", i+1)
		}
	}
	for i := 3; i < 5; i++ {
		if len(saturdays[i]) != 1 || len(sundays[i]) != 0 {
			t.Errorf("upcoming week %d should have moved to Saturday", i+1)
		}
	}
	var seriesDay int
	_ = testPool.QueryRow(ctx,
		`SELECT s.day_of_week FROM activity_series s JOIN phases ph ON ph.id = s.phase_id WHERE ph.program_id = $1`, programID,
	).Scan(&seriesDay)
	if seriesDay != 6 {
		t.Errorf("series day = %d, want 6", seriesDay)
	}
}

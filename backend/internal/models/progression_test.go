package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func intPtr(i int) *int { return &i }

func materializeMap(t *testing.T, activityType, base string, rules []ProgressionRule, week, baseWeek int, load PhaseLoad) map[string]any {
	t.Helper()
	raw := MaterializePrescription(activityType, json.RawMessage(base), rules, week, baseWeek, load)
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("unmarshal materialized: %v", err)
	}
	return m
}

func TestMaterialize_PercentCompoundsAndRounds(t *testing.T) {
	rules := []ProgressionRule{{Field: "distance_m", Percent: 10}}
	want := []float64{10000, 11000, 12100, 13300} // 13310 rounds to 100 m
	for i, w := range want {
		m := materializeMap(t, "run", `{"distance_m":10000,"pace_sec_per_km":375}`, rules, i+1, 1, PhaseLoad{})
		if got := m["distance_m"]; got != w {
			t.Errorf("week %d distance_m = %v, want %v", i+1, got, w)
		}
		if m["pace_sec_per_km"] != 375.0 {
			t.Errorf("week %d pace changed: %v", i+1, m["pace_sec_per_km"])
		}
	}
}

func TestMaterialize_StepRespectsMax(t *testing.T) {
	rules := []ProgressionRule{{Field: "weight_kg", Exercise: "squat", Step: 2.5, Max: 85}}
	base := `{"exercises":[{"name":"Squat","sets":4,"reps":5,"weight_kg":80}]}`
	want := []float64{80, 82.5, 85, 85}
	for i, w := range want {
		m := materializeMap(t, "strength_training", base, rules, i+1, 1, PhaseLoad{})
		ex := m["exercises"].([]any)[0].(map[string]any)
		if ex["weight_kg"] != w {
			t.Errorf("week %d weight_kg = %v, want %v", i+1, ex["weight_kg"], w)
		}
	}
}

func TestMaterialize_DeloadCutsVolumeAndPausesProgression(t *testing.T) {
	rules := []ProgressionRule{{Field: "distance_m", Percent: 10}}
	load := PhaseLoad{DeloadWeeks: []int{4}, DeloadPct: 40}
	base := `{"distance_m":10000,"pace_sec_per_km":375}`

	w3 := materializeMap(t, "run", base, rules, 3, 1, load)
	w4 := materializeMap(t, "run", base, rules, 4, 1, load)
	w5 := materializeMap(t, "run", base, rules, 5, 1, load)

	if w3["distance_m"] != 12100.0 {
		t.Fatalf("week 3 = %v, want 12100", w3["distance_m"])
	}
	// Deload: the level week 4 reaches (13300) cut by 40%.
	if w4["distance_m"] != 8000.0 {
		t.Errorf("deload week 4 = %v, want 8000", w4["distance_m"])
	}
	if w4["pace_sec_per_km"] != 375.0 {
		t.Errorf("deload must keep intensity, pace = %v", w4["pace_sec_per_km"])
	}
	// The deload week doesn't count as a step, so week 5 does the uncut 13300.
	if w5["distance_m"] != 13300.0 {
		t.Errorf("week 5 = %v, want 13300", w5["distance_m"])
	}
}

func TestMaterialize_DeloadSkipsPassiveTypes(t *testing.T) {
	load := PhaseLoad{DeloadWeeks: []int{1}}
	m := materializeMap(t, "mobility", `{"duration_sec":1200}`, nil, 1, 1, load)
	if m["duration_sec"] != 1200.0 {
		t.Errorf("mobility duration changed in deload: %v", m["duration_sec"])
	}
}

func TestMaterialize_DeloadCutsIntervalRepsAndExerciseSets(t *testing.T) {
	load := PhaseLoad{DeloadWeeks: []int{1}, DeloadPct: 50}
	run := materializeMap(t, "run", `{"sets":[{"reps":6,"distance_m":800,"pace_sec_per_km":220}],"total_distance_m":7800}`, nil, 1, 1, load)
	set := run["sets"].([]any)[0].(map[string]any)
	if set["reps"] != 3.0 || set["distance_m"] != 800.0 {
		t.Errorf("interval deload = %v, want 3 × 800", set)
	}
	if run["total_distance_m"] != 3900.0 {
		t.Errorf("total_distance_m = %v, want 3900", run["total_distance_m"])
	}

	lift := materializeMap(t, "strength_training", `{"exercises":[{"name":"Bench","sets":4,"reps":8,"weight_kg":60}]}`, nil, 1, 1, load)
	ex := lift["exercises"].([]any)[0].(map[string]any)
	if ex["sets"] != 2.0 || ex["weight_kg"] != 60.0 {
		t.Errorf("strength deload = %v, want 2 sets at 60 kg", ex)
	}
}

func TestMaterialize_IntervalRepsKeepTotalInSync(t *testing.T) {
	rules := []ProgressionRule{{Field: "reps", SetIndex: intPtr(0), Step: 1, Max: 8}}
	base := `{"warmup":"2km easy","sets":[{"reps":5,"distance_m":800}],"total_distance_m":7000}`
	m := materializeMap(t, "run", base, rules, 3, 1, PhaseLoad{})
	set := m["sets"].([]any)[0].(map[string]any)
	if set["reps"] != 7.0 {
		t.Errorf("reps = %v, want 7", set["reps"])
	}
	if m["total_distance_m"] != 8600.0 {
		t.Errorf("total_distance_m = %v, want 8600 (7000 + 2 × 800)", m["total_distance_m"])
	}
}

func TestMaterialize_BaseWeekOffsetsSteps(t *testing.T) {
	rules := []ProgressionRule{{Field: "duration_sec", Step: 300}}
	// Rebased at week 3: week 3 is the base, week 5 is two steps on.
	m := materializeMap(t, "cycling", `{"duration_sec":3600}`, rules, 5, 3, PhaseLoad{})
	if m["duration_sec"] != 4200.0 {
		t.Errorf("duration_sec = %v, want 4200", m["duration_sec"])
	}
}

func TestProgressedPrescription_IgnoresDeloadCut(t *testing.T) {
	rules := []ProgressionRule{{Field: "distance_m", Step: 1000}}
	load := PhaseLoad{DeloadWeeks: []int{3}}
	raw := ProgressedPrescription("run", json.RawMessage(`{"distance_m":10000}`), rules, 3, 1, load)
	if !strings.Contains(string(raw), `"distance_m":12000`) {
		t.Errorf("progressed = %s, want distance_m 12000 without deload cut", raw)
	}
}

func TestValidateProgression(t *testing.T) {
	strength := json.RawMessage(`{"exercises":[{"name":"Squat","sets":4,"reps":5,"weight_kg":80}]}`)
	run := json.RawMessage(`{"distance_m":10000}`)
	tests := []struct {
		name    string
		rule    ProgressionRule
		presc   json.RawMessage
		wantErr string
	}{
		{"valid percent", ProgressionRule{Field: "distance_m", Percent: 10, Max: 18000}, run, ""},
		{"valid exercise step", ProgressionRule{Field: "weight_kg", Exercise: "Squat", Step: 2.5}, strength, ""},
		{"unknown field", ProgressionRule{Field: "pace_sec_per_km", Step: 1}, run, "field must be one of"},
		{"both percent and step", ProgressionRule{Field: "distance_m", Percent: 5, Step: 500}, run, "exactly one"},
		{"neither", ProgressionRule{Field: "distance_m"}, run, "exactly one"},
		{"percent too high", ProgressionRule{Field: "distance_m", Percent: 25}, run, "at most 15"},
		{"step too high", ProgressionRule{Field: "weight_kg", Exercise: "Squat", Step: 50}, strength, "at most 20"},
		{"sets without exercise", ProgressionRule{Field: "sets", Step: 1}, strength, "requires exercise"},
		{"missing exercise", ProgressionRule{Field: "weight_kg", Exercise: "Deadlift", Step: 5}, strength, "not found"},
		{"missing value", ProgressionRule{Field: "duration_sec", Step: 60}, run, "no numeric duration_sec"},
		{"max below base", ProgressionRule{Field: "distance_m", Percent: 10, Max: 8000}, run, "below the starting"},
		{"set index out of range", ProgressionRule{Field: "reps", SetIndex: intPtr(2), Step: 1}, run, "out of range"},
		{"shape only without prescription", ProgressionRule{Field: "distance_m", Percent: 10}, nil, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateProgression([]ProgressionRule{tt.rule}, tt.presc)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want containing %q", err, tt.wantErr)
			}
		})
	}
}

func TestValidateDeload(t *testing.T) {
	if err := (PhaseLoad{DeloadWeeks: []int{4, 8}, DeloadPct: 35}).validate(8); err != nil {
		t.Errorf("valid deload rejected: %v", err)
	}
	if err := (PhaseLoad{DeloadWeeks: []int{9}, DeloadPct: 35}).validate(8); err == nil {
		t.Error("week outside phase accepted")
	}
	if err := (PhaseLoad{DeloadWeeks: []int{4, 4}, DeloadPct: 35}).validate(8); err == nil {
		t.Error("duplicate week accepted")
	}
	if err := (PhaseLoad{DeloadWeeks: []int{4}, DeloadPct: 80}).validate(8); err == nil {
		t.Error("deload_pct 80 accepted")
	}
}

func TestPrepare_NormalizesDeloadPct(t *testing.T) {
	phase := TemplatePhaseInput{Name: "Base", DurationWeeks: 4, PhaseLoad: PhaseLoad{DeloadWeeks: []int{4}}}
	if err := phase.Prepare(); err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if phase.DeloadPct != DefaultDeloadPct {
		t.Errorf("deload_pct = %d, want default %d", phase.DeloadPct, DefaultDeloadPct)
	}

	noDeload := TemplatePhaseInput{Name: "Peak", DurationWeeks: 2, PhaseLoad: PhaseLoad{DeloadPct: 40}}
	if err := noDeload.Prepare(); err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if noDeload.DeloadPct != 0 || noDeload.DeloadWeeks == nil {
		t.Errorf("phase without deload weeks = %+v, want pct 0 and empty weeks", noDeload.PhaseLoad)
	}
}

func TestBuildPhasePreview(t *testing.T) {
	phase := TemplatePhaseInput{
		Name:          "Base",
		DurationWeeks: 4,
		PhaseLoad:     PhaseLoad{DeloadWeeks: []int{4}, DeloadPct: 35},
		TemplateWeek: TemplateWeek{Activities: []TemplateActivity{
			{DayOfWeek: 2, ActivityType: "run", Prescription: json.RawMessage(`{"distance_m":5000}`)},
			{DayOfWeek: 6, ActivityType: "run", Prescription: json.RawMessage(`{"distance_m":10000,"duration_sec":3600}`),
				Progression: []ProgressionRule{{Field: "distance_m", Percent: 10}}},
		}},
	}
	p := BuildPhasePreview(phase)

	if len(p.Weeks) != 4 {
		t.Fatalf("weeks = %d, want 4", len(p.Weeks))
	}
	wantDist := []float64{15000, 16000, 17100, 11900} // deload: 0.65 × (5000, 13300) = 3300 + 8600
	for i, w := range p.Weeks {
		if w.DistanceM != wantDist[i] {
			t.Errorf("week %d distance = %v, want %v", i+1, w.DistanceM, wantDist[i])
		}
	}
	if !p.Weeks[3].Deload || p.Weeks[2].Deload {
		t.Error("deload flag on wrong week")
	}
	if len(p.Activities[0]) != 0 || len(p.Activities[1]) != 1 {
		t.Fatalf("tracks = %v", p.Activities)
	}
	if got := p.Activities[1][0]; len(got) != 4 || got[0] != 10000 || got[2] != 12100 {
		t.Errorf("track values = %v", got)
	}

	summary := strings.Join(phase.ProgressionSummary(), "\n")
	for _, want := range []string{"W4* 11.9km", "Sat run distance_m by week: 10000, 11000, 12100, 8600*"} {
		if !strings.Contains(summary, want) {
			t.Errorf("summary missing %q:\n%s", want, summary)
		}
	}
}

func TestPhaseStartDates(t *testing.T) {
	tmpl := TemplateProgramInput{
		StartDate: "2026-03-02",
		Phases: []TemplatePhaseInput{
			{DurationWeeks: 2},
			{DurationWeeks: 3, StartDate: "2026-03-23"},
			{DurationWeeks: 1},
		},
	}
	got := tmpl.PhaseStartDates()
	want := []string{"2026-03-02", "2026-03-23", "2026-04-13"}
	for i, w := range want {
		if got[i].Format("2006-01-02") != w {
			t.Errorf("phase %d start = %s, want %s", i, got[i].Format("2006-01-02"), w)
		}
	}
}

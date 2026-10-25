package models

import (
	"encoding/json"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"
)

// ProgressionRule describes how one numeric prescription value grows week over
// week within a phase. Exactly one of Percent (compounding) or Step (linear)
// is set. The target is the top-level prescription, one exercise (by name) or
// one entry of the structured `sets` array (by index).
type ProgressionRule struct {
	Field    string  `json:"field"`
	Exercise string  `json:"exercise,omitempty"`
	SetIndex *int    `json:"set_index,omitempty"`
	Percent  float64 `json:"percent,omitempty"`
	Step     float64 `json:"step,omitempty"`
	Max      float64 `json:"max,omitempty"`
	Round    float64 `json:"round,omitempty"`
}

// ProgressionFields are the prescription values a rule may progress.
var ProgressionFields = []string{"distance_m", "duration_sec", "reps", "sets", "weight_kg"}

const (
	// MaxProgressionPercent caps compounding weekly growth (the 10% rule plus headroom).
	MaxProgressionPercent = 15
	// DefaultDeloadPct is the volume cut applied in deload weeks when none is given.
	DefaultDeloadPct = 35
)

var progressionStepLimits = map[string]float64{
	"distance_m": 5000, "duration_sec": 1800, "reps": 5, "sets": 2, "weight_kg": 20,
}

var defaultRoundUnits = map[string]float64{
	"distance_m": 100, "duration_sec": 60, "reps": 1, "sets": 1, "weight_kg": 0.5,
}

// PhaseLoad is a phase's deload configuration. DeloadPct is always set when
// DeloadWeeks is non-empty (see TemplatePhaseInput.Prepare).
type PhaseLoad struct {
	DeloadWeeks []int `json:"deload_weeks,omitempty"`
	DeloadPct   int   `json:"deload_pct,omitempty"`
}

// IsDeload reports whether the 1-based phase week is a deload week.
func (l PhaseLoad) IsDeload(week int) bool {
	return slices.Contains(l.DeloadWeeks, week)
}

// loadingSteps counts the non-deload weeks in [baseWeek, week): the number of
// progression steps applied by `week`. A deload week cuts volume from the
// level it reaches and doesn't count as a step, so the week after it repeats
// that level uncut and the ramp continues from there.
func (l PhaseLoad) loadingSteps(week, baseWeek int) int {
	steps := 0
	for w := baseWeek; w < week; w++ {
		if !l.IsDeload(w) {
			steps++
		}
	}
	return steps
}

// normalize defaults DeloadPct when the phase has deload weeks and clears it
// otherwise, so stored and displayed values are always the real cut.
func (l *PhaseLoad) normalize() {
	if l.DeloadWeeks == nil {
		l.DeloadWeeks = []int{}
	}
	switch {
	case len(l.DeloadWeeks) == 0:
		l.DeloadPct = 0
	case l.DeloadPct == 0:
		l.DeloadPct = DefaultDeloadPct
	}
}

// validate checks the deload configuration of a phase of durationWeeks weeks.
func (l PhaseLoad) validate(durationWeeks int) error {
	seen := map[int]bool{}
	for _, w := range l.DeloadWeeks {
		if w < 1 || w > durationWeeks {
			return fmt.Errorf("deload_weeks: week %d is outside the phase (1-%d)", w, durationWeeks)
		}
		if seen[w] {
			return fmt.Errorf("deload_weeks: week %d listed twice", w)
		}
		seen[w] = true
	}
	if len(l.DeloadWeeks) > 0 && (l.DeloadPct < 10 || l.DeloadPct > 60) {
		return fmt.Errorf("deload_pct must be between 10 and 60")
	}
	return nil
}

// ValidateProgression checks rule shape and limits. When a prescription is
// given, it also checks that every rule targets an existing numeric value.
func ValidateProgression(rules []ProgressionRule, prescription json.RawMessage) error {
	var p map[string]any
	if len(prescription) > 0 {
		if err := json.Unmarshal(prescription, &p); err != nil {
			return fmt.Errorf("prescription must be a JSON object")
		}
	}
	for i, r := range rules {
		if err := r.validate(p); err != nil {
			return fmt.Errorf("progression[%d]: %w", i, err)
		}
	}
	return nil
}

func (r ProgressionRule) validate(p map[string]any) error {
	if !slices.Contains(ProgressionFields, r.Field) {
		return fmt.Errorf("field must be one of %s", strings.Join(ProgressionFields, ", "))
	}
	if (r.Percent > 0) == (r.Step > 0) {
		return fmt.Errorf("set exactly one of percent or step (positive)")
	}
	if r.Percent > MaxProgressionPercent {
		return fmt.Errorf("percent must be at most %d per week", MaxProgressionPercent)
	}
	if limit := progressionStepLimits[r.Field]; r.Step > limit {
		return fmt.Errorf("step for %s must be at most %g per week", r.Field, limit)
	}
	if r.Max < 0 || r.Round < 0 {
		return fmt.Errorf("max and round must be non-negative")
	}
	if r.Exercise != "" && r.SetIndex != nil {
		return fmt.Errorf("set either exercise or set_index, not both")
	}
	if r.Field == "sets" && r.Exercise == "" {
		return fmt.Errorf("progressing sets requires exercise")
	}
	if r.Field == "reps" && r.Exercise == "" && r.SetIndex == nil {
		return fmt.Errorf("progressing reps requires exercise or set_index")
	}
	if p == nil {
		return nil
	}
	target, err := r.target(p)
	if err != nil {
		return err
	}
	base, ok := target[r.Field].(float64)
	if !ok {
		return fmt.Errorf("prescription has no numeric %s at the rule's target", r.Field)
	}
	if r.Max > 0 && r.Max < base {
		return fmt.Errorf("max (%g) is below the starting %s (%g)", r.Max, r.Field, base)
	}
	return nil
}

// target resolves the object within the prescription that holds r.Field.
func (r ProgressionRule) target(p map[string]any) (map[string]any, error) {
	if r.Exercise != "" {
		exercises, _ := p["exercises"].([]any)
		for _, e := range exercises {
			if ex, ok := e.(map[string]any); ok {
				if name, _ := ex["name"].(string); strings.EqualFold(name, r.Exercise) {
					return ex, nil
				}
			}
		}
		return nil, fmt.Errorf("exercise %q not found in prescription", r.Exercise)
	}
	if r.SetIndex != nil {
		sets, _ := p["sets"].([]any)
		i := *r.SetIndex
		if i < 0 || i >= len(sets) {
			return nil, fmt.Errorf("set_index %d out of range", i)
		}
		set, ok := sets[i].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("sets[%d] is not an object", i)
		}
		return set, nil
	}
	return p, nil
}

// valueAt returns the rule's value after `steps` progression steps.
func (r ProgressionRule) valueAt(base float64, steps int) float64 {
	v := base + r.Step*float64(steps)
	if r.Percent > 0 {
		v = base * math.Pow(1+r.Percent/100, float64(steps))
	}
	unit := r.Round
	if unit == 0 {
		unit = defaultRoundUnits[r.Field]
	}
	v = roundTo(v, unit)
	if r.Max > 0 && v > r.Max {
		v = r.Max
	}
	return v
}

func roundTo(v, unit float64) float64 {
	if unit > 0 {
		v = math.Round(v/unit) * unit
	}
	return math.Round(v*100) / 100
}

// MaterializePrescription computes an activity's prescription for a 1-based
// phase week. `base` is the prescription at `baseWeek`; rules apply one step
// per non-deload week after it, and deload weeks cut volume (not intensity)
// for non-passive activities.
func MaterializePrescription(activityType string, base json.RawMessage, rules []ProgressionRule, week, baseWeek int, load PhaseLoad) json.RawMessage {
	return marshalOr(materialize(activityType, base, rules, week, baseWeek, load, true), base)
}

// ProgressedPrescription is MaterializePrescription without the deload cut:
// the progression level reached by `week`. Used to rebase a series mid-phase.
func ProgressedPrescription(activityType string, base json.RawMessage, rules []ProgressionRule, week, baseWeek int, load PhaseLoad) json.RawMessage {
	return marshalOr(materialize(activityType, base, rules, week, baseWeek, load, false), base)
}

// marshalOr marshals m, falling back to the unchanged base when it couldn't
// be parsed.
func marshalOr(m map[string]any, fallback json.RawMessage) json.RawMessage {
	if m == nil {
		return fallback
	}
	out, err := json.Marshal(m)
	if err != nil {
		return fallback
	}
	return out
}

// materialize returns the computed prescription map, or nil when the base
// can't be parsed. cutDeload applies the deload volume cut in deload weeks.
func materialize(activityType string, base json.RawMessage, rules []ProgressionRule, week, baseWeek int, load PhaseLoad, cutDeload bool) map[string]any {
	var m map[string]any
	if err := json.Unmarshal(base, &m); err != nil || m == nil {
		return nil
	}

	steps := load.loadingSteps(week, baseWeek)
	setVolumeBefore := structuredSetsVolume(m)
	for _, r := range rules {
		target, err := r.target(m)
		if err != nil {
			continue
		}
		if v, ok := target[r.Field].(float64); ok {
			target[r.Field] = r.valueAt(v, steps)
		}
	}
	// Keep the session total in line when interval sets grew.
	if total, ok := m["total_distance_m"].(float64); ok {
		m["total_distance_m"] = roundTo(total+structuredSetsVolume(m)-setVolumeBefore, 100)
	}

	if cutDeload && load.IsDeload(week) && !isDeloadExempt(activityType) {
		applyDeload(m, 1-float64(load.DeloadPct)/100)
	}
	return m
}

func isDeloadExempt(activityType string) bool {
	return activityType == "event" || slices.Contains(PassiveActivityTypes, activityType)
}

// structuredSetsVolume sums reps × distance_m over the `sets` array.
func structuredSetsVolume(m map[string]any) float64 {
	sets, _ := m["sets"].([]any)
	total := 0.0
	for _, s := range sets {
		set, ok := s.(map[string]any)
		if !ok {
			continue
		}
		dist, _ := set["distance_m"].(float64)
		reps, ok := set["reps"].(float64)
		if !ok {
			reps = 1
		}
		total += reps * dist
	}
	return total
}

// applyDeload scales volume by `keep`: session distance/duration, the number
// of interval reps (or a single block's length), and exercise set counts.
// Pace, power and weight stay unchanged.
func applyDeload(m map[string]any, keep float64) {
	scaleField(m, "distance_m", 100, keep)
	scaleField(m, "total_distance_m", 100, keep)
	scaleField(m, "duration_sec", 60, keep)

	// Interval sets: fewer reps, or a shorter single block.
	for _, set := range objects(m["sets"]) {
		if n, ok := set["reps"].(float64); ok && n > 1 {
			scaleField(set, "reps", 1, keep)
			continue
		}
		scaleField(set, "distance_m", 100, keep)
		scaleField(set, "duration_sec", 60, keep)
	}
	// Exercises: fewer sets, or a shorter hold.
	for _, ex := range objects(m["exercises"]) {
		if n, ok := ex["sets"].(float64); ok && n > 1 {
			scaleField(ex, "sets", 1, keep)
			continue
		}
		scaleField(ex, "duration_sec", 60, keep)
	}
}

// objects returns the JSON objects in a decoded array value.
func objects(v any) []map[string]any {
	items, _ := v.([]any)
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		if obj, ok := it.(map[string]any); ok {
			out = append(out, obj)
		}
	}
	return out
}

// scaleField multiplies obj[key] by factor, rounded to unit and never below it.
func scaleField(obj map[string]any, key string, unit, factor float64) {
	v, ok := obj[key].(float64)
	if !ok || v <= 0 {
		return
	}
	obj[key] = math.Max(unit, roundTo(v*factor, unit))
}

// WeekLoad is the total planned distance and duration of one phase week.
type WeekLoad struct {
	Week        int     `json:"week"`
	Deload      bool    `json:"deload"`
	DistanceM   float64 `json:"distance_m"`
	DurationSec float64 `json:"duration_sec"`
}

// PhasePreview shows how a template phase plays out week by week.
// Activities[i][j] holds the weekly values of rule j of template activity i.
type PhasePreview struct {
	Weeks      []WeekLoad    `json:"weeks"`
	Activities [][][]float64 `json:"activities"`
}

// BuildPhasePreview expands a template phase into weekly load totals and
// per-rule value tracks.
func BuildPhasePreview(phase TemplatePhaseInput) PhasePreview {
	acts := phase.TemplateWeek.Activities
	preview := PhasePreview{
		Weeks:      make([]WeekLoad, 0, phase.DurationWeeks),
		Activities: make([][][]float64, len(acts)),
	}
	for i, act := range acts {
		preview.Activities[i] = make([][]float64, len(act.Progression))
	}

	for week := 1; week <= phase.DurationWeeks; week++ {
		wl := WeekLoad{Week: week, Deload: phase.IsDeload(week)}
		for i, act := range acts {
			m := materialize(act.ActivityType, act.Prescription, act.Progression, week, 1, phase.PhaseLoad, true)
			if m == nil {
				continue
			}
			wl.DistanceM += PrescribedDistanceM(m)
			wl.DurationSec += PrescribedDurationSec(m)
			for j, r := range act.Progression {
				var v float64
				if target, err := r.target(m); err == nil {
					v, _ = target[r.Field].(float64)
				}
				preview.Activities[i][j] = append(preview.Activities[i][j], v)
			}
		}
		preview.Weeks = append(preview.Weeks, wl)
	}
	return preview
}

// ProgressionSummary renders the phase's week-by-week preview as compact
// lines for the LLM to sanity-check its progression (deload weeks marked *).
func (p TemplatePhaseInput) ProgressionSummary() []string {
	preview := BuildPhasePreview(p)
	var lines []string
	var weekly []string
	for _, w := range preview.Weeks {
		mark := ""
		if w.Deload {
			mark = "*"
		}
		weekly = append(weekly, fmt.Sprintf("W%d%s %.1fkm/%.0fmin", w.Week, mark, w.DistanceM/1000, w.DurationSec/60))
	}
	if len(weekly) > 0 {
		lines = append(lines, "Weekly totals: "+strings.Join(weekly, ", "))
	}
	for i, act := range p.TemplateWeek.Activities {
		day := time.Weekday(act.DayOfWeek).String()[:3]
		for j, r := range act.Progression {
			target := r.Field
			if r.Exercise != "" {
				target = r.Exercise + " " + r.Field
			} else if r.SetIndex != nil {
				target = fmt.Sprintf("sets[%d].%s", *r.SetIndex, r.Field)
			}
			values := make([]string, len(preview.Activities[i][j]))
			for k, v := range preview.Activities[i][j] {
				values[k] = fmt.Sprintf("%g", v)
				if preview.Weeks[k].Deload {
					values[k] += "*"
				}
			}
			lines = append(lines, fmt.Sprintf("%s %s %s by week: %s", day, act.ActivityType, target, strings.Join(values, ", ")))
		}
	}
	return lines
}

// ProposalView is a template program plus each phase's week-by-week preview,
// as sent to the client for review.
type ProposalView struct {
	TemplateProgramInput
	PhasePreviews []PhasePreview `json:"phase_previews"`
}

func NewProposalView(t TemplateProgramInput) ProposalView {
	previews := make([]PhasePreview, len(t.Phases))
	for i, phase := range t.Phases {
		previews[i] = BuildPhasePreview(phase)
	}
	return ProposalView{TemplateProgramInput: t, PhasePreviews: previews}
}

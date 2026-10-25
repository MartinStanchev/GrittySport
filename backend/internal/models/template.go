package models

import (
	"encoding/json"
	"fmt"
	"time"
)

// TemplateProgramInput is a program described as phases of repeating template
// weeks. Saving it persists each template activity as an activity series and
// materializes one scheduled activity per week, applying progression rules
// and deload weeks.
type TemplateProgramInput struct {
	Name            string               `json:"name"`
	Sport           string               `json:"sport"`
	GoalDescription string               `json:"goal_description"`
	StartDate       string               `json:"start_date"`
	EndDate         string               `json:"end_date"`
	Phases          []TemplatePhaseInput `json:"phases"`
}

type TemplatePhaseInput struct {
	Name          string `json:"name"`
	OrderIndex    int    `json:"order_index"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	DurationWeeks int    `json:"duration_weeks"`
	PhaseLoad
	TemplateWeek TemplateWeek `json:"template_week"`
}

type TemplateWeek struct {
	Activities []TemplateActivity `json:"activities"`
}

type TemplateActivity struct {
	DayOfWeek    int               `json:"day_of_week"`
	ActivityType string            `json:"activity_type"`
	Prescription json.RawMessage   `json:"prescription"`
	Notes        string            `json:"notes"`
	OrderIndex   int               `json:"order_index"`
	Progression  []ProgressionRule `json:"progression,omitempty"`
}

// Prepare fills defaults (the deload cut) and checks the phase's deload
// config and every activity's prescription and progression rules.
func (p *TemplatePhaseInput) Prepare() error {
	p.normalize()
	if err := p.validate(p.DurationWeeks); err != nil {
		return fmt.Errorf("phase %q: %w", p.Name, err)
	}
	for i, act := range p.TemplateWeek.Activities {
		if err := ValidatePrescription(act.ActivityType, act.Prescription); err != nil {
			return fmt.Errorf("phase %q activity %d: %w", p.Name, i, err)
		}
		if err := ValidateProgression(act.Progression, act.Prescription); err != nil {
			return fmt.Errorf("phase %q activity %d: %w", p.Name, i, err)
		}
	}
	return nil
}

// Prepare prepares every phase (see TemplatePhaseInput.Prepare).
func (t *TemplateProgramInput) Prepare() error {
	for i := range t.Phases {
		if err := t.Phases[i].Prepare(); err != nil {
			return err
		}
	}
	return nil
}

func ParseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

// PhaseStartDates resolves each phase's start date: its explicit start_date,
// or the program start plus the weeks of all earlier phases.
func (t TemplateProgramInput) PhaseStartDates() []time.Time {
	starts := make([]time.Time, len(t.Phases))
	cursor := ParseDate(t.StartDate)
	for i, phase := range t.Phases {
		start := ParseDate(phase.StartDate)
		if start.IsZero() {
			start = cursor
		}
		starts[i] = start
		cursor = start.AddDate(0, 0, phase.DurationWeeks*7)
	}
	return starts
}

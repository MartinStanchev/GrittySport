package models

import (
	"encoding/json"
	"time"
)

type TemplateProgramInput struct {
	Name            string               `json:"name"`
	Sport           string               `json:"sport"`
	GoalDescription string               `json:"goal_description"`
	StartDate       string               `json:"start_date"`
	EndDate         string               `json:"end_date"`
	Phases          []TemplatePhaseInput  `json:"phases"`
}

type TemplatePhaseInput struct {
	Name          string       `json:"name"`
	OrderIndex    int          `json:"order_index"`
	StartDate     string       `json:"start_date"`
	EndDate       string       `json:"end_date"`
	DurationWeeks int          `json:"duration_weeks"`
	TemplateWeek  TemplateWeek `json:"template_week"`
}

type TemplateWeek struct {
	Activities []TemplateActivity `json:"activities"`
}

type TemplateActivity struct {
	DayOfWeek    int             `json:"day_of_week"`
	ActivityType string          `json:"activity_type"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        string          `json:"notes"`
	OrderIndex   int             `json:"order_index"`
}

func ParseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

// ExpandTemplatesToSaveInput converts template-based phases into fully expanded
// SaveProgramInput with individual weeks.
func ExpandTemplatesToSaveInput(tmpl TemplateProgramInput) SaveProgramInput {
	programStartDate := ParseDate(tmpl.StartDate)

	var expandedPhases []SavePhaseInput
	globalWeekNum := 1

	for _, phase := range tmpl.Phases {
		phaseStart := ParseDate(phase.StartDate)
		if phaseStart.IsZero() {
			phaseStart = programStartDate
			for _, ep := range expandedPhases {
				phaseStart = phaseStart.AddDate(0, 0, len(ep.Weeks)*7)
			}
		}

		var weeks []SaveWeekInput
		for w := 0; w < phase.DurationWeeks; w++ {
			weekStart := phaseStart.AddDate(0, 0, w*7)
			var activities []SaveActivityInput
			for _, act := range phase.TemplateWeek.Activities {
				activities = append(activities, SaveActivityInput(act))
			}
			weeks = append(weeks, SaveWeekInput{
				WeekNumber: globalWeekNum,
				StartDate:  weekStart.Format("2006-01-02"),
				Activities: activities,
			})
			globalWeekNum++
		}

		expandedPhases = append(expandedPhases, SavePhaseInput{
			Name:       phase.Name,
			OrderIndex: phase.OrderIndex,
			StartDate:  phase.StartDate,
			EndDate:    phase.EndDate,
			Weeks:      weeks,
		})
	}

	return SaveProgramInput{
		Name:            tmpl.Name,
		Sport:           tmpl.Sport,
		GoalDescription: tmpl.GoalDescription,
		StartDate:       tmpl.StartDate,
		EndDate:         tmpl.EndDate,
		Phases:          expandedPhases,
	}
}

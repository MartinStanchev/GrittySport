package models

import (
	"encoding/json"
	"time"
)

type Program struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Name            string     `json:"name"`
	Sport           *string    `json:"sport,omitempty"`
	GoalDescription *string    `json:"goal_description,omitempty"`
	StartDate       time.Time  `json:"start_date"`
	EndDate         *time.Time `json:"end_date,omitempty"`
	Status          string     `json:"status"`
	CreatedBy       string     `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ProgramResponse struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Sport           *string    `json:"sport,omitempty"`
	GoalDescription *string    `json:"goal_description,omitempty"`
	StartDate       string     `json:"start_date"`
	EndDate         *string    `json:"end_date,omitempty"`
	Status          string     `json:"status"`
	CreatedBy       string     `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (p *Program) ToResponse() ProgramResponse {
	resp := ProgramResponse{
		ID:              p.ID,
		Name:            p.Name,
		Sport:           p.Sport,
		GoalDescription: p.GoalDescription,
		StartDate:       p.StartDate.Format("2006-01-02"),
		Status:          p.Status,
		CreatedBy:       p.CreatedBy,
		CreatedAt:       p.CreatedAt,
		UpdatedAt:       p.UpdatedAt,
	}
	if p.EndDate != nil {
		s := p.EndDate.Format("2006-01-02")
		resp.EndDate = &s
	}
	return resp
}

type ProgramDetailResponse struct {
	ProgramResponse
	Phases   []PhaseResponse            `json:"phases"`
	Criteria []ProgramCriterionResponse `json:"criteria"`
}

func (p *Program) ToDetailResponse(phases []Phase, criteria []ProgramCriterion) ProgramDetailResponse {
	phaseResponses := make([]PhaseResponse, len(phases))
	for i, ph := range phases {
		phaseResponses[i] = ph.ToResponse(p.StartDate)
	}
	criteriaResponses := make([]ProgramCriterionResponse, len(criteria))
	for i, c := range criteria {
		criteriaResponses[i] = c.ToResponse()
	}
	return ProgramDetailResponse{
		ProgramResponse: p.ToResponse(),
		Phases:          phaseResponses,
		Criteria:        criteriaResponses,
	}
}

type ProgramCriterion struct {
	ID           string    `json:"id"`
	ProgramID    string    `json:"program_id"`
	Key          string    `json:"key"`
	Label        string    `json:"label"`
	Value        string    `json:"value"`
	ValueType    string    `json:"value_type"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ProgramCriterionResponse struct {
	ID           string `json:"id"`
	Key          string `json:"key"`
	Label        string `json:"label"`
	Value        string `json:"value"`
	ValueType    string `json:"value_type"`
	DisplayOrder int    `json:"display_order"`
}

func (c *ProgramCriterion) ToResponse() ProgramCriterionResponse {
	return ProgramCriterionResponse{
		ID:           c.ID,
		Key:          c.Key,
		Label:        c.Label,
		Value:        c.Value,
		ValueType:    c.ValueType,
		DisplayOrder: c.DisplayOrder,
	}
}

type Phase struct {
	ID         string     `json:"id"`
	ProgramID  string     `json:"program_id"`
	Name       string     `json:"name"`
	OrderIndex int        `json:"order_index"`
	StartDate  *time.Time `json:"start_date,omitempty"`
	EndDate    *time.Time `json:"end_date,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	Weeks      []Week     `json:"weeks,omitempty"`
}

type PhaseResponse struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	OrderIndex int            `json:"order_index"`
	StartDate  *string        `json:"start_date,omitempty"`
	EndDate    *string        `json:"end_date,omitempty"`
	Weeks      []WeekResponse `json:"weeks"`
}

func (p *Phase) ToResponse(programStart time.Time) PhaseResponse {
	weekResponses := make([]WeekResponse, len(p.Weeks))
	for i, w := range p.Weeks {
		weekResponses[i] = w.ToResponse(programStart)
	}
	resp := PhaseResponse{
		ID:         p.ID,
		Name:       p.Name,
		OrderIndex: p.OrderIndex,
		Weeks:      weekResponses,
	}
	if p.StartDate != nil {
		s := p.StartDate.Format("2006-01-02")
		resp.StartDate = &s
	}
	if p.EndDate != nil {
		s := p.EndDate.Format("2006-01-02")
		resp.EndDate = &s
	}
	return resp
}

type Week struct {
	ID         string              `json:"id"`
	PhaseID    string              `json:"phase_id"`
	WeekNumber int                 `json:"week_number"`
	StartDate  *time.Time          `json:"start_date,omitempty"`
	CreatedAt  time.Time           `json:"created_at"`
	Activities []ScheduledActivity `json:"activities,omitempty"`
}

type WeekResponse struct {
	ID         string                      `json:"id"`
	WeekNumber int                         `json:"week_number"`
	StartDate  string                      `json:"start_date"`
	Activities []ScheduledActivityResponse `json:"activities"`
}

func (w *Week) ToResponse(programStart time.Time) WeekResponse {
	var raw time.Time
	if w.StartDate != nil {
		raw = *w.StartDate
	} else {
		raw = programStart.AddDate(0, 0, (w.WeekNumber-1)*7)
	}
	weekMonday := MondayOf(raw)

	actResponses := make([]ScheduledActivityResponse, len(w.Activities))
	for i, a := range w.Activities {
		actResponses[i] = a.ToResponseWithDate(weekMonday)
	}
	return WeekResponse{
		ID:         w.ID,
		WeekNumber: w.WeekNumber,
		StartDate:  weekMonday.Format("2006-01-02"),
		Activities: actResponses,
	}
}

type ScheduledActivity struct {
	ID              string          `json:"id"`
	WeekID          string          `json:"week_id"`
	DayOfWeek       int             `json:"day_of_week"`
	ActivityType    string          `json:"activity_type"`
	Prescription    json.RawMessage `json:"prescription"`
	Notes           *string         `json:"notes,omitempty"`
	OrderIndex      int             `json:"order_index"`
	LinkedWorkoutID *string         `json:"linked_workout_id,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type ScheduledActivityResponse struct {
	ID              string          `json:"id"`
	DayOfWeek       int             `json:"day_of_week"`
	Date            string          `json:"date"`
	ActivityType    string          `json:"activity_type"`
	Prescription    json.RawMessage `json:"prescription"`
	Notes           *string         `json:"notes,omitempty"`
	OrderIndex      int             `json:"order_index"`
	LinkedWorkoutID *string         `json:"linked_workout_id,omitempty"`
}

// DowOffset converts a JS-convention day_of_week (0=Sun, 1=Mon…6=Sat) to a
// Monday-based offset so that weekStart + offset gives the correct calendar date.
func DowOffset(dow int) int {
	if dow == 0 {
		return 6
	}
	return dow - 1
}

// MondayOf returns the Monday (start of ISO week) for the week containing t.
func MondayOf(t time.Time) time.Time {
	return t.AddDate(0, 0, -DowOffset(int(t.Weekday())))
}

func (a *ScheduledActivity) ToResponseWithDate(weekStart time.Time) ScheduledActivityResponse {
	date := weekStart.AddDate(0, 0, DowOffset(a.DayOfWeek)).Format("2006-01-02")
	return ScheduledActivityResponse{
		ID:              a.ID,
		DayOfWeek:       a.DayOfWeek,
		Date:            date,
		ActivityType:    a.ActivityType,
		Prescription:    a.Prescription,
		Notes:           a.Notes,
		OrderIndex:      a.OrderIndex,
		LinkedWorkoutID: a.LinkedWorkoutID,
	}
}

// Input types for creating/updating programs

type SaveProgramInput struct {
	Name            string           `json:"name"`
	Sport           string           `json:"sport"`
	GoalDescription string           `json:"goal_description"`
	StartDate       string           `json:"start_date"`
	EndDate         string           `json:"end_date"`
	Phases          []SavePhaseInput `json:"phases"`
	CreatedBy       string           `json:"created_by,omitempty"`
}

type SavePhaseInput struct {
	Name       string          `json:"name"`
	OrderIndex int             `json:"order_index"`
	StartDate  string          `json:"start_date"`
	EndDate    string          `json:"end_date"`
	Weeks      []SaveWeekInput `json:"weeks"`
}

type SaveWeekInput struct {
	WeekNumber int                 `json:"week_number"`
	StartDate  string              `json:"start_date"`
	Activities []SaveActivityInput `json:"activities"`
}

type SaveActivityInput struct {
	DayOfWeek    int             `json:"day_of_week"`
	ActivityType string          `json:"activity_type"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        string          `json:"notes"`
	OrderIndex   int             `json:"order_index"`
}

type SaveCriterionInput struct {
	Key          string `json:"key"`
	Label        string `json:"label"`
	Value        string `json:"value"`
	ValueType    string `json:"value_type"`
	DisplayOrder int    `json:"display_order"`
}

type UpdateProgramInput struct {
	Name   *string `json:"name,omitempty"`
	Status *string `json:"status,omitempty"`
}

// ValidEditActions enumerates the supported edit actions for ProgramEdit.Action.
// Single source of truth for the LLM tool schema enum and the apply-time validator.
var ValidEditActions = []string{
	"update_activity",
	"remove_activity",
	"add_activity",
	"swap_day",
	"update_criteria",
}

func IsValidEditAction(action string) bool {
	for _, a := range ValidEditActions {
		if a == action {
			return true
		}
	}
	return false
}

// ProgramEdit is a unified edit action for modifying saved programs.
// The Action field determines which other fields are relevant.
type ProgramEdit struct {
	// Action: see ValidEditActions
	Action string `json:"action"`

	// Target a specific activity by ID (update_activity, remove_activity)
	ActivityID string `json:"activity_id,omitempty"`
	// Target a specific week (add_activity)
	WeekID string `json:"week_id,omitempty"`
	// Target by day across weeks (all actions except update_criteria)
	DayOfWeek *int `json:"day_of_week,omitempty"`
	// swap_day: the other day to swap with
	NewDay *int `json:"new_day,omitempty"`
	// Activity type (update_activity, add_activity)
	ActivityType string `json:"activity_type,omitempty"`
	// Prescription details
	Prescription json.RawMessage `json:"prescription,omitempty"`
	// Notes
	Notes *string `json:"notes,omitempty"`
	// Limit to a specific phase (0-based)
	PhaseIndex *int `json:"phase_index,omitempty"`
	// Filter by activity type when multiple exist on the same day
	ActivityTypeFilter string `json:"activity_type_filter,omitempty"`
	// For update_criteria
	Criteria []SaveCriterionInput `json:"criteria,omitempty"`
}

// ActivitySnapshot is a lightweight summary of an activity's current state.
type ActivitySnapshot struct {
	ActivityType string          `json:"activity_type"`
	Prescription json.RawMessage `json:"prescription,omitempty"`
	Notes        *string         `json:"notes,omitempty"`
}

// CriterionSnapshot captures the old value of a criterion.
type CriterionSnapshot struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
}

// EditBeforeState holds the resolved "before" state for a single edit.
type EditBeforeState struct {
	Activity *ActivitySnapshot   `json:"activity,omitempty"`
	DayA     []ActivitySnapshot  `json:"day_a,omitempty"`
	DayB     []ActivitySnapshot  `json:"day_b,omitempty"`
	Criteria []CriterionSnapshot `json:"criteria,omitempty"`
}

// EnrichedEdit is a ProgramEdit augmented with its resolved "before" state.
type EnrichedEdit struct {
	ProgramEdit
	Before *EditBeforeState `json:"before,omitempty"`
}

type UpcomingActivityResponse struct {
	ID           string          `json:"id"`
	ActivityType string          `json:"activity_type"`
	DayOfWeek    int             `json:"day_of_week"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        *string         `json:"notes,omitempty"`
	WeekNumber   int             `json:"week_number"`
	PhaseName    string          `json:"phase_name"`
	Date         string          `json:"date"`
}

type LinkableActivityResponse struct {
	UpcomingActivityResponse
	SameType bool `json:"same_type"`
}

type ActivityDetailResponse struct {
	ID           string          `json:"id"`
	ProgramID    string          `json:"program_id"`
	ProgramName  string          `json:"program_name"`
	ActivityType string          `json:"activity_type"`
	DayOfWeek    int             `json:"day_of_week"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        *string         `json:"notes,omitempty"`
	OrderIndex   int             `json:"order_index"`
	WeekNumber   int             `json:"week_number"`
	PhaseName    string          `json:"phase_name"`
	Date         string          `json:"date"`
	UserID       string          `json:"-"`
	// Linked recorded workout (if any)
	LinkedWorkoutID         *string         `json:"linked_workout_id,omitempty"`
	LinkedWorkoutRecordedAt *time.Time      `json:"linked_workout_recorded_at,omitempty"`
	LinkedWorkoutSource     *string         `json:"linked_workout_source,omitempty"`
	LinkedGPSRoute          json.RawMessage `json:"linked_gps_route,omitempty"`
}

type UpdateActivityInput struct {
	Prescription json.RawMessage `json:"prescription,omitempty"`
	Notes        *string         `json:"notes,omitempty"`
	DayOfWeek    *int            `json:"day_of_week,omitempty"`
	ActivityType *string         `json:"activity_type,omitempty"`
}

// SetProgramEventInput describes the goal event (race/meet/competition) a
// program is building toward. It is stored as a single scheduled activity of
// type `event` in the program's final week; the rich fields live in the
// activity's prescription.
type SetProgramEventInput struct {
	EventName    string `json:"event_name"`
	EventSubtype string `json:"event_subtype"`
	Date         string `json:"date"` // YYYY-MM-DD
	Location     string `json:"location"`
	Goal         string `json:"goal"`
	Distance     string `json:"distance"`
}

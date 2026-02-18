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
		phaseResponses[i] = ph.ToResponse()
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

func (p *Phase) ToResponse() PhaseResponse {
	weekResponses := make([]WeekResponse, len(p.Weeks))
	for i, w := range p.Weeks {
		weekResponses[i] = w.ToResponse()
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
	StartDate  *string                     `json:"start_date,omitempty"`
	Activities []ScheduledActivityResponse `json:"activities"`
}

func (w *Week) ToResponse() WeekResponse {
	actResponses := make([]ScheduledActivityResponse, len(w.Activities))
	for i, a := range w.Activities {
		actResponses[i] = a.ToResponse()
	}
	resp := WeekResponse{
		ID:         w.ID,
		WeekNumber: w.WeekNumber,
		Activities: actResponses,
	}
	if w.StartDate != nil {
		s := w.StartDate.Format("2006-01-02")
		resp.StartDate = &s
	}
	return resp
}

type ScheduledActivity struct {
	ID           string          `json:"id"`
	WeekID       string          `json:"week_id"`
	DayOfWeek    int             `json:"day_of_week"`
	ActivityType string          `json:"activity_type"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        *string         `json:"notes,omitempty"`
	OrderIndex   int             `json:"order_index"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type ScheduledActivityResponse struct {
	ID           string          `json:"id"`
	DayOfWeek    int             `json:"day_of_week"`
	ActivityType string          `json:"activity_type"`
	Prescription json.RawMessage `json:"prescription"`
	Notes        *string         `json:"notes,omitempty"`
	OrderIndex   int             `json:"order_index"`
}

func (a *ScheduledActivity) ToResponse() ScheduledActivityResponse {
	return ScheduledActivityResponse{
		ID:           a.ID,
		DayOfWeek:    a.DayOfWeek,
		ActivityType: a.ActivityType,
		Prescription: a.Prescription,
		Notes:        a.Notes,
		OrderIndex:   a.OrderIndex,
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

type AdjustActivityInput struct {
	ActivityID   string          `json:"activity_id"`
	Prescription json.RawMessage `json:"prescription"`
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
}

type UpdateActivityInput struct {
	Prescription json.RawMessage `json:"prescription,omitempty"`
	Notes        *string         `json:"notes,omitempty"`
	DayOfWeek    *int            `json:"day_of_week,omitempty"`
	ActivityType *string         `json:"activity_type,omitempty"`
}

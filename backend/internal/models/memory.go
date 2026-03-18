package models

import "time"

type ChatSegment struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	SegmentType    string     `json:"segment_type"`
	Status         string     `json:"status"`
	StartMessageID *string    `json:"start_message_id,omitempty"`
	EndMessageID   *string    `json:"end_message_id,omitempty"`
	Summary        *string    `json:"summary,omitempty"`
	StartedAt      time.Time  `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type ChatFact struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	FactType        string    `json:"fact_type"`
	Content         string    `json:"content"`
	SourceSegmentID *string   `json:"source_segment_id,omitempty"`
	Active          bool      `json:"active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

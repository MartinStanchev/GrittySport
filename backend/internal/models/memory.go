package models

import (
	"encoding/json"
	"time"
)

// SegmentHeader is the denormalized payload stored on a segment row to drive
// the chat-grouping UI. Captured as a snapshot at segment-start so renames or
// later workout edits don't change a historical header.
type SegmentHeader struct {
	Label    string `json:"label"`
	Subtitle string `json:"subtitle,omitempty"`
	RefType  string `json:"ref_type,omitempty"`
	RefID    string `json:"ref_id,omitempty"`
}

// Marshal returns the header as a json.RawMessage suitable for storage on a
// chat_segments row. SegmentHeader contains only string fields so json.Marshal
// cannot fail here.
func (h SegmentHeader) Marshal() json.RawMessage {
	raw, _ := json.Marshal(h)
	return raw
}

type ChatSegment struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	SegmentType    string          `json:"segment_type"`
	Status         string          `json:"status"`
	StartMessageID *string         `json:"start_message_id,omitempty"`
	EndMessageID   *string         `json:"end_message_id,omitempty"`
	Summary        *string         `json:"summary,omitempty"`
	Tags           []string        `json:"tags,omitempty"`
	Header         json.RawMessage `json:"header,omitempty"`
	StartedAt      time.Time       `json:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// ChatSegmentResponse is the public shape of a segment exposed via the chat
// API. Internal fields like `summary` and `tags` (used for memory assembly)
// are intentionally omitted.
type ChatSegmentResponse struct {
	ID             string          `json:"id"`
	SegmentType    string          `json:"segment_type"`
	Status         string          `json:"status"`
	StartMessageID *string         `json:"start_message_id,omitempty"`
	EndMessageID   *string         `json:"end_message_id,omitempty"`
	Header         json.RawMessage `json:"header,omitempty"`
	StartedAt      time.Time       `json:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at,omitempty"`
}

func (s *ChatSegment) ToResponse() ChatSegmentResponse {
	return ChatSegmentResponse{
		ID:             s.ID,
		SegmentType:    s.SegmentType,
		Status:         s.Status,
		StartMessageID: s.StartMessageID,
		EndMessageID:   s.EndMessageID,
		Header:         s.Header,
		StartedAt:      s.StartedAt,
		CompletedAt:    s.CompletedAt,
	}
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

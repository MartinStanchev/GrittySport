package models

import (
	"encoding/json"
	"time"
)

type ChatMessage struct {
	ID        string          `json:"id"`
	UserID    string          `json:"user_id"`
	Role      string          `json:"role"`
	Content   string          `json:"content"`
	ProgramID *string         `json:"program_id,omitempty"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

func (m *ChatMessage) ToResponse() ChatMessageResponse {
	return ChatMessageResponse{
		ID:        m.ID,
		Role:      m.Role,
		Content:   m.Content,
		ProgramID: m.ProgramID,
		Metadata:  m.Metadata,
		CreatedAt: m.CreatedAt,
	}
}

type ChatMessageResponse struct {
	ID        string          `json:"id"`
	Role      string          `json:"role"`
	Content   string          `json:"content"`
	ProgramID *string         `json:"program_id,omitempty"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

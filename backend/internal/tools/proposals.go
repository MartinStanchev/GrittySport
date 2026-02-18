package tools

import (
	"encoding/json"
	"sync"
	"time"
)

type PendingProposal struct {
	Type           string          `json:"type"` // "program_creation" or "program_adjustment"
	Program        json.RawMessage `json:"program,omitempty"`
	Criteria       json.RawMessage `json:"criteria,omitempty"`
	DraftProgramID string          `json:"draft_program_id,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type ProposalStore struct {
	mu      sync.RWMutex
	pending map[string]*PendingProposal
}

func NewProposalStore() *ProposalStore {
	return &ProposalStore{
		pending: make(map[string]*PendingProposal),
	}
}

func (s *ProposalStore) Set(userID string, proposal *PendingProposal) {
	s.mu.Lock()
	defer s.mu.Unlock()
	proposal.CreatedAt = time.Now()
	s.pending[userID] = proposal
}

func (s *ProposalStore) Get(userID string) (*PendingProposal, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.pending[userID]
	if !ok {
		return nil, false
	}
	if time.Since(p.CreatedAt) > 30*time.Minute {
		return nil, false
	}
	return p, true
}

func (s *ProposalStore) Delete(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.pending, userID)
}

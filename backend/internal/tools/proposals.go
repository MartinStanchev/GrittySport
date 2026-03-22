package tools

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/grittyfitness/api/internal/models"
)

type PendingProposal struct {
	Type           string                      `json:"type"` // "program_creation" or "program_edit"
	Program        json.RawMessage             `json:"program,omitempty"`
	Criteria       json.RawMessage             `json:"criteria,omitempty"`
	DraftProgramID string                      `json:"draft_program_id,omitempty"`
	DraftPhases    []models.TemplatePhaseInput `json:"draft_phases,omitempty"`
	CreatedAt      time.Time                   `json:"created_at"`
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

// AddPhase appends a phase to the user's in-progress draft and returns the total phase count.
// It upserts a fresh PendingProposal entry if none exists yet, ensuring the expiry timer starts now.
func (s *ProposalStore) AddPhase(userID string, phase models.TemplatePhaseInput) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pending[userID]
	if !ok {
		p = &PendingProposal{CreatedAt: time.Now()}
		s.pending[userID] = p
	} else {
		p.CreatedAt = time.Now() // refresh expiry on each new phase
	}
	p.DraftPhases = append(p.DraftPhases, phase)
	return len(p.DraftPhases)
}

// decomposeProgram extracts phases from the assembled Program JSON back into DraftPhases.
// This is needed after propose_program has been called and the user rejects — the assembled
// Program replaces DraftPhases, so we decompose it to allow phase-level edits.
func (p *PendingProposal) decomposeProgram() {
	if len(p.DraftPhases) > 0 || len(p.Program) == 0 {
		return
	}
	var program models.TemplateProgramInput
	if err := json.Unmarshal(p.Program, &program); err != nil {
		return
	}
	p.DraftPhases = program.Phases
}

// UpdatePhase replaces the phase at the given order_index. If DraftPhases is empty but
// an assembled Program exists (post-proposal rejection), it decomposes the program first.
func (s *ProposalStore) UpdatePhase(userID string, orderIndex int, phase models.TemplatePhaseInput) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pending[userID]
	if !ok {
		return fmt.Errorf("no draft phases found")
	}
	p.decomposeProgram()
	if len(p.DraftPhases) == 0 {
		return fmt.Errorf("no draft phases found")
	}
	for i, dp := range p.DraftPhases {
		if dp.OrderIndex == orderIndex {
			p.DraftPhases[i] = phase
			p.CreatedAt = time.Now()
			return nil
		}
	}
	return fmt.Errorf("no phase with order_index %d", orderIndex)
}

// DeletePhase removes the phase at the given order_index. If DraftPhases is empty but
// an assembled Program exists (post-proposal rejection), it decomposes the program first.
// Returns the remaining count.
func (s *ProposalStore) DeletePhase(userID string, orderIndex int) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pending[userID]
	if !ok {
		return 0, fmt.Errorf("no draft phases found")
	}
	p.decomposeProgram()
	if len(p.DraftPhases) == 0 {
		return 0, fmt.Errorf("no draft phases found")
	}
	for i, dp := range p.DraftPhases {
		if dp.OrderIndex == orderIndex {
			p.DraftPhases = append(p.DraftPhases[:i], p.DraftPhases[i+1:]...)
			p.CreatedAt = time.Now()
			return len(p.DraftPhases), nil
		}
	}
	return len(p.DraftPhases), fmt.Errorf("no phase with order_index %d", orderIndex)
}

// GetPhases returns the current draft phases for a user. If phases were assembled
// into a Program (after propose_program), they are decomposed back. Returns nil if
// no proposal or phases exist.
func (s *ProposalStore) GetPhases(userID string) []models.TemplatePhaseInput {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pending[userID]
	if !ok {
		return nil
	}
	p.decomposeProgram()
	// Return a copy to avoid races with concurrent UpdatePhase/DeletePhase calls.
	return append([]models.TemplatePhaseInput(nil), p.DraftPhases...)
}

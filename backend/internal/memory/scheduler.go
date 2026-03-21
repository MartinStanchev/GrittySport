package memory

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// FactDecayScheduler runs daily to deactivate stale facts.
type FactDecayScheduler struct {
	svc *Service
}

// NewFactDecayScheduler creates a new scheduler.
func NewFactDecayScheduler(svc *Service) *FactDecayScheduler {
	return &FactDecayScheduler{svc: svc}
}

// Run starts the daily decay loop. Blocks until context is cancelled.
func (s *FactDecayScheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	log.Info().Msg("Fact decay scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Fact decay scheduler stopped")
			return
		case <-ticker.C:
			deactivated, err := s.svc.RunFactDecay(ctx)
			if err != nil {
				log.Error().Err(err).Msg("Fact decay failed")
				continue
			}
			if deactivated > 0 {
				log.Info().Int64("deactivated", deactivated).Msg("Fact decay completed")
			}
		}
	}
}

package memory

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// MaintenanceScheduler runs daily memory upkeep: it deactivates stale facts and
// retries summary redaction for forgotten facts that weren't scrubbed yet.
type MaintenanceScheduler struct {
	svc *Service
}

// NewMaintenanceScheduler creates a new scheduler.
func NewMaintenanceScheduler(svc *Service) *MaintenanceScheduler {
	return &MaintenanceScheduler{svc: svc}
}

// Run starts the daily maintenance loop. Blocks until context is cancelled.
func (s *MaintenanceScheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	log.Info().Msg("Memory maintenance scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Memory maintenance scheduler stopped")
			return
		case <-ticker.C:
			s.runOnce(ctx)
		}
	}
}

func (s *MaintenanceScheduler) runOnce(ctx context.Context) {
	deactivated, err := s.svc.RunFactDecay(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Fact decay failed")
	} else if deactivated > 0 {
		log.Info().Int64("deactivated", deactivated).Msg("Fact decay completed")
	}

	redacted, err := s.svc.RedactPendingForgotten(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Forgotten-memory redaction retry failed")
	} else if redacted > 0 {
		log.Info().Int("users", redacted).Msg("Forgotten-memory redaction retry completed")
	}
}

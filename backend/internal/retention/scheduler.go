// Package retention runs the daily data-retention purge. Each Job below is a
// single SQL statement that removes data which is no longer needed for the
// purpose it was collected for (GDPR Art. 5(1)(e), storage limitation).
//
// Adding a new retention rule = append a Job here, document the period in the
// privacy policy, and you're done. The scheduler logs how many rows each job
// removed per cycle so retention can be monitored.
package retention

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// Job is a single retention purge. Stmt must be a DELETE that returns no rows.
type Job struct {
	Name string
	Stmt string
}

// Jobs is the canonical list of retention purges. Periods chosen to balance
// support (e.g. quota disputes) against storage minimization.
var Jobs = []Job{
	{
		Name: "refresh_tokens_expired",
		// 30-day grace period after a refresh token expires lets us debug
		// reuse-detection issues without keeping data forever.
		Stmt: `DELETE FROM refresh_tokens WHERE expires_at < now() - INTERVAL '30 days'`,
	},
	{
		Name: "usage_tracking_old",
		// 13 months covers a full quota-comparison year + 1 month buffer,
		// after which historical usage is no longer load-bearing.
		Stmt: `DELETE FROM usage_tracking WHERE created_at < now() - INTERVAL '13 months'`,
	},
	{
		Name: "email_otps_expired",
		// OTPs are single-use and short-lived — anything older than a day
		// is unreachable and only useful for replay-attack forensics.
		Stmt: `DELETE FROM email_otps WHERE expires_at < now() - INTERVAL '1 day'`,
	},
}

// Scheduler runs the retention jobs once per day. Blocks until context is
// cancelled.
type Scheduler struct {
	pool *pgxpool.Pool
}

func NewScheduler(pool *pgxpool.Pool) *Scheduler {
	return &Scheduler{pool: pool}
}

func (s *Scheduler) Run(ctx context.Context) {
	// Run once on startup so a freshly-deployed instance immediately enforces
	// retention rather than waiting up to 24h.
	s.runOnce(ctx)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	log.Info().Msg("Retention scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Retention scheduler stopped")
			return
		case <-ticker.C:
			s.runOnce(ctx)
		}
	}
}

func (s *Scheduler) runOnce(ctx context.Context) {
	for _, j := range Jobs {
		tag, err := s.pool.Exec(ctx, j.Stmt)
		if err != nil {
			log.Error().Err(err).Str("job", j.Name).Msg("Retention job failed")
			continue
		}
		if n := tag.RowsAffected(); n > 0 {
			log.Info().Str("job", j.Name).Int64("removed", n).Msg("Retention job removed rows")
		}
	}
}

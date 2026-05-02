package email

import (
	"context"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// Sender delivers transactional email. Must be safe for concurrent use.
type Sender interface {
	SendOTP(ctx context.Context, toEmail, code string) error
}

type Config struct {
	ResendAPIKey string
	From         string
}

func New(cfg Config) Sender {
	if cfg.ResendAPIKey == "" {
		log.Warn().Msg("email: RESEND_API_KEY not set, using MockSender (codes logged to stdout)")
		return &MockSender{}
	}
	log.Info().Str("from", cfg.From).Msg("email: using Resend")
	return &ResendSender{
		apiKey: cfg.ResendAPIKey,
		from:   cfg.From,
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

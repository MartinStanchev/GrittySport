package email

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/config"
)

// Sender delivers transactional email. Must be safe for concurrent use.
type Sender interface {
	SendOTP(ctx context.Context, toEmail, code string) error
	// SendWishlistNotification notifies the operator (`toEmail`) that
	// `signupEmail` just joined the pre-launch wishlist.
	SendWishlistNotification(ctx context.Context, toEmail, signupEmail string) error
}

type Config struct {
	ResendAPIKey string
	From         string
}

// ErrMissingAPIKey signals that RESEND_API_KEY is unset in a non-development
// environment. Falling back to MockSender in production would log OTP codes
// to stdout and silently break real deliveries, so callers must fail fast.
var ErrMissingAPIKey = errors.New("email: RESEND_API_KEY is required outside of development")

// New returns a Sender. It returns ErrMissingAPIKey when RESEND_API_KEY is
// unset and APP_ENV is not development.
func New(cfg Config) (Sender, error) {
	if cfg.ResendAPIKey == "" {
		if !config.IsDevelopment() {
			return nil, ErrMissingAPIKey
		}
		log.Warn().Msg("email: RESEND_API_KEY not set, using MockSender (codes logged to stdout, dev only)")
		return &MockSender{}, nil
	}
	log.Info().Str("from", cfg.From).Msg("email: using Resend")
	return &ResendSender{
		apiKey: cfg.ResendAPIKey,
		from:   cfg.From,
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

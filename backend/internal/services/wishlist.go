package services

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/email"
)

// WishlistService records pre-launch interest from the marketing site and
// notifies the operator via Resend. Unauthenticated; the endpoint is open to
// the public marketing page.
type WishlistService struct {
	pool     *pgxpool.Pool
	mailer   email.Sender
	notifyTo string
}

func NewWishlistService(pool *pgxpool.Pool, mailer email.Sender, notifyTo string) *WishlistService {
	return &WishlistService{pool: pool, mailer: mailer, notifyTo: notifyTo}
}

// Subscribe validates and persists the email, then fires a notification email
// to the operator. Returns ValidationErrors for a malformed address. Duplicate
// signups silently succeed (no error, no second notification) so the endpoint
// cannot be used to enumerate which emails already subscribed.
func (s *WishlistService) Subscribe(ctx context.Context, rawEmail string) error {
	addr, err := normalizeWishlistEmail(rawEmail)
	if err != nil {
		return &ValidationErrors{Errors: []ValidationError{{Field: "email", Message: "invalid email address"}}}
	}

	tag, err := s.pool.Exec(ctx,
		`INSERT INTO wishlist_signups (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
		addr,
	)
	if err != nil {
		return fmt.Errorf("insert wishlist signup: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// Already subscribed — return success without re-notifying.
		return nil
	}

	if s.notifyTo == "" {
		log.Warn().Msg("wishlist: WISHLIST_NOTIFY_TO not set, skipping operator email")
		return nil
	}
	if err := s.mailer.SendWishlistNotification(ctx, s.notifyTo, addr); err != nil {
		// The row is committed; surface the error so the operator notices, but
		// the user has still been added.
		log.Error().Err(err).Str("signup", addr).Msg("wishlist: notification email failed")
	}
	return nil
}

func normalizeWishlistEmail(raw string) (string, error) {
	addr := strings.ToLower(strings.TrimSpace(raw))
	if addr == "" {
		return "", errors.New("empty email")
	}
	if len(addr) > 254 {
		return "", errors.New("email too long")
	}
	if _, err := mail.ParseAddress(addr); err != nil {
		return "", err
	}
	return addr, nil
}

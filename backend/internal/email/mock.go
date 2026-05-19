package email

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"
)

// MockSender is used in dev (no RESEND_API_KEY) and tests.
type MockSender struct {
	mu        sync.Mutex
	sent      []SentOTP
	wishlist  []SentWishlist
}

type SentOTP struct {
	Email string
	Code  string
}

type SentWishlist struct {
	To          string
	SignupEmail string
}

func (m *MockSender) SendOTP(_ context.Context, toEmail, code string) error {
	m.mu.Lock()
	m.sent = append(m.sent, SentOTP{Email: toEmail, Code: code})
	m.mu.Unlock()
	log.Info().Str("to", toEmail).Str("code", code).Msg("MockSender: OTP")
	return nil
}

func (m *MockSender) SendWishlistNotification(_ context.Context, toEmail, signupEmail string) error {
	m.mu.Lock()
	m.wishlist = append(m.wishlist, SentWishlist{To: toEmail, SignupEmail: signupEmail})
	m.mu.Unlock()
	log.Info().Str("to", toEmail).Str("signup", signupEmail).Msg("MockSender: wishlist signup")
	return nil
}

func (m *MockSender) Sent() []SentOTP {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SentOTP, len(m.sent))
	copy(out, m.sent)
	return out
}

func (m *MockSender) SentWishlist() []SentWishlist {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SentWishlist, len(m.wishlist))
	copy(out, m.wishlist)
	return out
}

func (m *MockSender) Reset() {
	m.mu.Lock()
	m.sent = nil
	m.wishlist = nil
	m.mu.Unlock()
}

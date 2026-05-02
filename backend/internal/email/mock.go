package email

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"
)

// MockSender is used in dev (no RESEND_API_KEY) and tests.
type MockSender struct {
	mu   sync.Mutex
	sent []SentOTP
}

type SentOTP struct {
	Email string
	Code  string
}

func (m *MockSender) SendOTP(_ context.Context, toEmail, code string) error {
	m.mu.Lock()
	m.sent = append(m.sent, SentOTP{Email: toEmail, Code: code})
	m.mu.Unlock()
	log.Info().Str("to", toEmail).Str("code", code).Msg("MockSender: OTP")
	return nil
}

func (m *MockSender) Sent() []SentOTP {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SentOTP, len(m.sent))
	copy(out, m.sent)
	return out
}

func (m *MockSender) Reset() {
	m.mu.Lock()
	m.sent = nil
	m.mu.Unlock()
}

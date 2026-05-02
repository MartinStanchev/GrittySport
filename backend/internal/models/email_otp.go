package models

import "time"

const (
	OTPPurposeLogin = "login"
	OTPMaxAttempts  = 5
)

type EmailOTP struct {
	ID         string     `json:"id"`
	Email      string     `json:"email"`
	CodeHash   string     `json:"-"`
	Purpose    string     `json:"purpose"`
	ExpiresAt  time.Time  `json:"expires_at"`
	ConsumedAt *time.Time `json:"consumed_at,omitempty"`
	Attempts   int        `json:"attempts"`
	CreatedAt  time.Time  `json:"created_at"`
}

package models

import "time"

const (
	ConsentTypeTerms      = "terms"
	ConsentTypePrivacy    = "privacy"
	ConsentTypeHealthData = "health_data"
	ConsentTypeAge16Plus  = "age_16_plus"
	ConsentTypeMarketing  = "marketing"
)

// Bumped whenever a legal document or consent text materially changes —
// a user with an older accepted version will be re-prompted on next launch.
const (
	TermsVersion      = "2026-05-08"
	PrivacyVersion    = "2026-05-08"
	HealthDataVersion = "2026-05-08"
	Age16PlusVersion  = "2026-05-08"
	MarketingVersion  = "2026-05-08"
)

// RequiredConsents must all be accepted for a user to use the app.
// Marketing is intentionally excluded — it's optional.
var RequiredConsents = []string{
	ConsentTypeTerms,
	ConsentTypePrivacy,
	ConsentTypeHealthData,
	ConsentTypeAge16Plus,
}

type UserConsent struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	ConsentType  string     `json:"consent_type"`
	Version      string     `json:"version"`
	AcceptedAt   time.Time  `json:"accepted_at"`
	WithdrawnAt  *time.Time `json:"withdrawn_at,omitempty"`
	IPAddress    *string    `json:"ip_address,omitempty"`
	UserAgent    *string    `json:"user_agent,omitempty"`
}

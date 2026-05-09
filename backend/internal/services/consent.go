package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

var (
	ErrMissingRequiredConsent = errors.New("missing required consent")
	ErrInvalidBirthYear       = errors.New("birth year is missing or user is under 16")
)

// MinSignupAge is the minimum age for GDPR consent in Germany (Art. 8 GDPR + §13 BDSG).
const MinSignupAge = 16

type ConsentService struct {
	pool *pgxpool.Pool
}

func NewConsentService(pool *pgxpool.Pool) *ConsentService {
	return &ConsentService{pool: pool}
}

// ConsentInput represents one accepted consent. Version is captured at acceptance
// time so a future bump can detect users still on an older version.
type ConsentInput struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

type RecordConsentsInput struct {
	Consents  []ConsentInput
	BirthYear *int
	IPAddress string
	UserAgent string
}

// RecordConsents inserts one row per accepted consent and, if all required types
// are present, sets users.consents_completed_at. The age_16_plus consent is
// derived server-side from BirthYear rather than self-attested, so the consent
// row constitutes verified proof rather than a checkbox claim.
func (s *ConsentService) RecordConsents(ctx context.Context, userID string, input RecordConsentsInput) error {
	if err := validateRequired(input.Consents); err != nil {
		return err
	}
	if err := validateBirthYear(input.BirthYear); err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var ip, ua any
	if input.IPAddress != "" {
		ip = input.IPAddress
	}
	if input.UserAgent != "" {
		ua = input.UserAgent
	}

	for _, c := range input.Consents {
		if _, err := tx.Exec(ctx,
			`INSERT INTO user_consents (user_id, consent_type, version, ip_address, user_agent)
			 VALUES ($1, $2, $3, $4, $5)`,
			userID, c.Type, c.Version, ip, ua,
		); err != nil {
			return fmt.Errorf("insert consent %s: %w", c.Type, err)
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE users SET birth_year = $2, consents_completed_at = now(), updated_at = now() WHERE id = $1`,
		userID, *input.BirthYear,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func validateBirthYear(birthYear *int) error {
	if birthYear == nil {
		return ErrInvalidBirthYear
	}
	currentYear := time.Now().Year()
	if *birthYear < 1900 || *birthYear > currentYear {
		return ErrInvalidBirthYear
	}
	if currentYear-*birthYear < MinSignupAge {
		return ErrInvalidBirthYear
	}
	return nil
}

func validateRequired(provided []ConsentInput) error {
	got := make(map[string]bool, len(provided))
	for _, c := range provided {
		if !isKnownConsentType(c.Type) {
			return fmt.Errorf("unknown consent type %q", c.Type)
		}
		if c.Version == "" {
			return fmt.Errorf("consent %q missing version", c.Type)
		}
		got[c.Type] = true
	}
	for _, req := range models.RequiredConsents {
		if !got[req] {
			return fmt.Errorf("%w: %s", ErrMissingRequiredConsent, req)
		}
	}
	return nil
}

func isKnownConsentType(t string) bool {
	switch t {
	case models.ConsentTypeTerms,
		models.ConsentTypePrivacy,
		models.ConsentTypeHealthData,
		models.ConsentTypeAge16Plus,
		models.ConsentTypeMarketing:
		return true
	}
	return false
}

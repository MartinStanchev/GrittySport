package services_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

func newConsentService() *services.ConsentService {
	return services.NewConsentService(testPool)
}

// validBirthYear returns a year that makes the user comfortably over 16,
// so each test doesn't have to spell out the math.
func validBirthYear() *int {
	y := time.Now().Year() - 25
	return &y
}

// seedUser creates a user via the OTP flow so the user_consents FK is satisfied.
func seedUser(t *testing.T, addr string) string {
	t.Helper()
	mock := &email.MockSender{}
	svc := newService(mock)
	code := requestAndExtractCode(t, svc, mock, addr)
	resp, err := svc.VerifyOTP(context.Background(), addr, code)
	if err != nil {
		t.Fatalf("seedUser: VerifyOTP failed: %v", err)
	}
	return resp.User.ID
}

func TestRecordConsents_AllRequired_SetsCompletedFlag(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "consent@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: validBirthYear(),
		IPAddress: "127.0.0.1",
		UserAgent: "test-agent",
	})
	if err != nil {
		t.Fatalf("RecordConsents failed: %v", err)
	}

	var rowCount int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_consents WHERE user_id = $1`, userID).Scan(&rowCount); err != nil {
		t.Fatalf("count consents: %v", err)
	}
	if rowCount != 4 {
		t.Errorf("expected 4 consent rows, got %d", rowCount)
	}

	var completed bool
	var birthYear *int
	if err := testPool.QueryRow(context.Background(),
		`SELECT consents_completed_at IS NOT NULL, birth_year FROM users WHERE id = $1`, userID).Scan(&completed, &birthYear); err != nil {
		t.Fatalf("read user: %v", err)
	}
	if !completed {
		t.Error("expected users.consents_completed_at to be set")
	}
	if birthYear == nil || *birthYear != *validBirthYear() {
		t.Errorf("expected users.birth_year = %d, got %v", *validBirthYear(), birthYear)
	}
}

func TestRecordConsents_MissingRequired_RejectsAndDoesNotMark(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "missing@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			// health_data + age_16_plus omitted
		},
		BirthYear: validBirthYear(),
	})
	if !errors.Is(err, services.ErrMissingRequiredConsent) {
		t.Fatalf("expected ErrMissingRequiredConsent, got %v", err)
	}

	var completedAt *string
	if err := testPool.QueryRow(context.Background(),
		`SELECT consents_completed_at::text FROM users WHERE id = $1`, userID).Scan(&completedAt); err != nil {
		t.Fatalf("read flag: %v", err)
	}
	if completedAt != nil {
		t.Errorf("expected consents_completed_at to remain nil on rejection, got %v", *completedAt)
	}

	var rowCount int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_consents WHERE user_id = $1`, userID).Scan(&rowCount); err != nil {
		t.Fatalf("count consents: %v", err)
	}
	if rowCount != 0 {
		t.Errorf("expected 0 consent rows on rejected submission (transaction rollback), got %d", rowCount)
	}
}

func TestRecordConsents_OptionalMarketing_StoresAlongsideRequired(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "marketing@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
			{Type: models.ConsentTypeMarketing, Version: models.MarketingVersion},
		},
		BirthYear: validBirthYear(),
	})
	if err != nil {
		t.Fatalf("RecordConsents failed: %v", err)
	}

	var marketingCount int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_consents WHERE user_id = $1 AND consent_type = $2`,
		userID, models.ConsentTypeMarketing).Scan(&marketingCount); err != nil {
		t.Fatalf("count marketing: %v", err)
	}
	if marketingCount != 1 {
		t.Errorf("expected marketing consent recorded, got %d rows", marketingCount)
	}
}

func TestRecordConsents_UnknownType_Rejects(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "unknown@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: "bogus_type", Version: "v1"},
		},
		BirthYear: validBirthYear(),
	})
	if err == nil {
		t.Fatal("expected error for unknown consent type")
	}
}

func TestRecordConsents_BirthYearMissing_Rejects(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "no-birthyear@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: nil,
	})
	if !errors.Is(err, services.ErrInvalidBirthYear) {
		t.Fatalf("expected ErrInvalidBirthYear, got %v", err)
	}
}

func TestRecordConsents_BirthYearUnder16_Rejects(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "under16@example.com")

	tooYoung := time.Now().Year() - 10
	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: &tooYoung,
	})
	if !errors.Is(err, services.ErrInvalidBirthYear) {
		t.Fatalf("expected ErrInvalidBirthYear, got %v", err)
	}

	var completedAt *string
	if err := testPool.QueryRow(context.Background(),
		`SELECT consents_completed_at::text FROM users WHERE id = $1`, userID).Scan(&completedAt); err != nil {
		t.Fatalf("read flag: %v", err)
	}
	if completedAt != nil {
		t.Errorf("expected consents_completed_at to remain nil for under-16 rejection, got %v", *completedAt)
	}
}

func TestRecordConsents_BirthYearOutOfRange_Rejects(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "outofrange@example.com")

	svc := newConsentService()
	for _, year := range []int{1800, time.Now().Year() + 1} {
		y := year
		err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
			Consents: []services.ConsentInput{
				{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
				{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
				{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
				{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
			},
			BirthYear: &y,
		})
		if !errors.Is(err, services.ErrInvalidBirthYear) {
			t.Errorf("year=%d: expected ErrInvalidBirthYear, got %v", y, err)
		}
	}
}

func TestRecordConsents_StaleVersion_Rejects(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "stale-version@example.com")

	svc := newConsentService()
	err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: "1900-01-01"}, // outdated
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: validBirthYear(),
	})
	if !errors.Is(err, services.ErrConsentVersionMismatch) {
		t.Fatalf("expected ErrConsentVersionMismatch, got %v", err)
	}
}

func TestRecordConsents_BirthYearImmutableAfterFirstSet(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "immutable-birthyear@example.com")
	svc := newConsentService()

	first := validBirthYear()
	if err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: first,
	}); err != nil {
		t.Fatalf("first RecordConsents failed: %v", err)
	}

	// Replay with a different (still valid) birth year — must NOT overwrite.
	other := time.Now().Year() - 40
	if err := svc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: models.TermsVersion},
			{Type: models.ConsentTypePrivacy, Version: models.PrivacyVersion},
			{Type: models.ConsentTypeHealthData, Version: models.HealthDataVersion},
			{Type: models.ConsentTypeAge16Plus, Version: models.Age16PlusVersion},
		},
		BirthYear: &other,
	}); err != nil {
		t.Fatalf("second RecordConsents failed: %v", err)
	}

	var got *int
	if err := testPool.QueryRow(context.Background(),
		`SELECT birth_year FROM users WHERE id = $1`, userID).Scan(&got); err != nil {
		t.Fatalf("read birth_year: %v", err)
	}
	if got == nil || *got != *first {
		t.Errorf("expected birth_year to remain %d after replay, got %v", *first, got)
	}
}

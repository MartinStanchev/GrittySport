package services_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

func TestDeleteAccount_NotFound(t *testing.T) {
	cleanTables(t)
	svc := services.NewUserService(testPool)

	err := svc.Delete(context.Background(), "00000000-0000-0000-0000-000000000000")
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expected ErrNoRows for missing user, got %v", err)
	}
}

func TestDeleteAccount_AnonymizesConsentsAndCascadesUserData(t *testing.T) {
	cleanTables(t)

	userID := seedUser(t, "delete-me@example.com")

	consentSvc := services.NewConsentService(testPool)
	if err := consentSvc.RecordConsents(context.Background(), userID, services.RecordConsentsInput{
		Consents: []services.ConsentInput{
			{Type: models.ConsentTypeTerms, Version: "v1"},
			{Type: models.ConsentTypePrivacy, Version: "v1"},
			{Type: models.ConsentTypeHealthData, Version: "v1"},
			{Type: models.ConsentTypeAge16Plus, Version: "v1"},
			{Type: models.ConsentTypeMarketing, Version: "v1"},
		},
		IPAddress: "127.0.0.1",
		UserAgent: "test-agent",
	}); err != nil {
		t.Fatalf("RecordConsents: %v", err)
	}

	ctx := context.Background()
	var refreshCount int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1`, userID,
	).Scan(&refreshCount); err != nil {
		t.Fatalf("count refresh_tokens: %v", err)
	}
	if refreshCount == 0 {
		t.Fatalf("expected refresh_tokens row from seedUser")
	}

	svc := services.NewUserService(testPool)
	if err := svc.Delete(ctx, userID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	var userExists bool
	if err := testPool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID,
	).Scan(&userExists); err != nil {
		t.Fatalf("query users: %v", err)
	}
	if userExists {
		t.Fatalf("expected user row to be deleted")
	}

	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1`, userID,
	).Scan(&refreshCount); err != nil {
		t.Fatalf("count refresh_tokens after delete: %v", err)
	}
	if refreshCount != 0 {
		t.Fatalf("expected refresh_tokens to cascade-delete, got %d remaining", refreshCount)
	}

	rows, err := testPool.Query(ctx,
		`SELECT user_id, consent_type, version, ip_address, user_agent FROM user_consents WHERE consent_type IN ('terms','privacy','health_data','age_16_plus','marketing')`,
	)
	if err != nil {
		t.Fatalf("query consents: %v", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var uid *string
		var consentType, version string
		var ip *string
		var ua *string
		if err := rows.Scan(&uid, &consentType, &version, &ip, &ua); err != nil {
			t.Fatalf("scan: %v", err)
		}
		count++
		if uid != nil {
			t.Errorf("consent %s: expected user_id NULL, got %s", consentType, *uid)
		}
		if ip != nil {
			t.Errorf("consent %s: expected ip_address NULL, got %s", consentType, *ip)
		}
		if ua != nil {
			t.Errorf("consent %s: expected user_agent NULL, got %s", consentType, *ua)
		}
		if version == "" {
			t.Errorf("consent %s: expected version preserved", consentType)
		}
	}
	if count != 5 {
		t.Fatalf("expected 5 anonymized consent rows, got %d", count)
	}
}

package usage_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
	"github.com/grittyfitness/api/internal/usage"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		os.Exit(0) // skip all tests silently
	}

	ctx := context.Background()
	var err error
	testPool, err = db.Connect(ctx, dbURL)
	if err != nil {
		panic("failed to connect to test database: " + err.Error())
	}
	defer testPool.Close()

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "../../../../db/migrations"
	}

	if err := db.RunMigrations(ctx, testPool, migrationsPath); err != nil {
		panic("failed to run migrations: " + err.Error())
	}

	code := m.Run()

	cleanAll()
	os.Exit(code)
}

func cleanAll() {
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM programs")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func cleanTables(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	_, _ = testPool.Exec(ctx, "DELETE FROM usage_tracking")
	_, _ = testPool.Exec(ctx, "DELETE FROM programs")
	_, _ = testPool.Exec(ctx, "DELETE FROM refresh_tokens")
	_, _ = testPool.Exec(ctx, "DELETE FROM users")
}

func createTestUser(t *testing.T, tier string) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, name, subscription_tier)
		 VALUES ($1, 'hash', 'Test', $2) RETURNING id`,
		"test"+time.Now().Format("150405.000")+"@test.com", tier,
	).Scan(&id)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	return id
}

func TestGetTier_FreeUser(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")

	tier, err := svc.GetTier(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	if tier != "free" {
		t.Errorf("expected 'free', got %q", tier)
	}
}

func TestGetTier_ActivePremium(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "premium")

	// Set expiry in the future
	future := time.Now().Add(30 * 24 * time.Hour)
	_, err := testPool.Exec(context.Background(),
		"UPDATE users SET subscription_expires_at = $1 WHERE id = $2",
		future, userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	tier, err := svc.GetTier(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	if tier != "premium" {
		t.Errorf("expected 'premium', got %q", tier)
	}
}

func TestGetTier_ExpiredPremium(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "premium")

	// Set expiry in the past
	past := time.Now().Add(-24 * time.Hour)
	_, err := testPool.Exec(context.Background(),
		"UPDATE users SET subscription_expires_at = $1 WHERE id = $2",
		past, userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	tier, err := svc.GetTier(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	if tier != "free" {
		t.Errorf("expected expired premium to be 'free', got %q", tier)
	}
}

func TestCheckAndIncrement_UnderLimit(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")

	allowed, remaining, err := svc.CheckAndIncrement(context.Background(), userID, "chat_message")
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("expected allowed")
	}
	if remaining != usage.FreeChatMessagesPerWeek-1 {
		t.Errorf("expected %d remaining, got %d", usage.FreeChatMessagesPerWeek-1, remaining)
	}
}

func TestCheckAndIncrement_AtLimit(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")

	// Send messages up to the limit
	for i := 0; i < usage.FreeChatMessagesPerWeek; i++ {
		allowed, _, err := svc.CheckAndIncrement(context.Background(), userID, "chat_message")
		if err != nil {
			t.Fatal(err)
		}
		if !allowed {
			t.Fatalf("message %d should be allowed", i+1)
		}
	}

	// Next message should be denied
	allowed, remaining, err := svc.CheckAndIncrement(context.Background(), userID, "chat_message")
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Error("expected denied at limit")
	}
	if remaining != 0 {
		t.Errorf("expected 0 remaining, got %d", remaining)
	}
}

func TestCheckAndIncrement_PremiumUnlimited(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "premium")

	// Premium users should always be allowed
	for i := 0; i < 60; i++ {
		allowed, _, err := svc.CheckAndIncrement(context.Background(), userID, "chat_message")
		if err != nil {
			t.Fatal(err)
		}
		if !allowed {
			t.Fatalf("premium user should always be allowed, denied at %d", i+1)
		}
	}
}

func TestGetUsage_FreeUser(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")

	// Use a few chat messages
	for i := 0; i < 5; i++ {
		_, _, _ = svc.CheckAndIncrement(context.Background(), userID, "chat_message")
	}

	summary, err := svc.GetUsage(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}

	if summary.Tier != "free" {
		t.Errorf("expected tier 'free', got %q", summary.Tier)
	}
	if summary.ChatMessages.Used != 5 {
		t.Errorf("expected 5 chat messages used, got %d", summary.ChatMessages.Used)
	}
	if summary.ChatMessages.Limit != usage.FreeChatMessagesPerWeek {
		t.Errorf("expected limit %d, got %d", usage.FreeChatMessagesPerWeek, summary.ChatMessages.Limit)
	}
	if summary.Programs.Limit != usage.FreeProgramsTotal {
		t.Errorf("expected program limit %d, got %d", usage.FreeProgramsTotal, summary.Programs.Limit)
	}
}

func TestGetUsage_PremiumUser(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "premium")

	summary, err := svc.GetUsage(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}

	if summary.Tier != "premium" {
		t.Errorf("expected tier 'premium', got %q", summary.Tier)
	}
	if summary.ChatMessages.Limit != -1 {
		t.Errorf("expected unlimited (-1) for premium, got %d", summary.ChatMessages.Limit)
	}
	if summary.Programs.Limit != -1 {
		t.Errorf("expected unlimited (-1) for premium programs, got %d", summary.Programs.Limit)
	}
}

func TestCountUserPrograms_ExcludesDrafts(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")
	ctx := context.Background()

	count, err := svc.CountUserPrograms(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("expected 0 programs, got %d", count)
	}

	// Create an active program
	_, err = testPool.Exec(ctx,
		`INSERT INTO programs (user_id, name, status, created_by, start_date)
		 VALUES ($1, 'Active Program', 'active', 'user', '2026-03-03')`,
		userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Create a draft program — should NOT count
	_, err = testPool.Exec(ctx,
		`INSERT INTO programs (user_id, name, status, created_by, start_date)
		 VALUES ($1, 'Draft Program', 'draft', 'grit', '2026-03-03')`,
		userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	count, err = svc.CountUserPrograms(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected 1 program (drafts excluded), got %d", count)
	}
}

func TestCountUserDrafts(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")
	ctx := context.Background()

	count, err := svc.CountUserDrafts(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("expected 0 drafts, got %d", count)
	}

	// Create a draft
	_, err = testPool.Exec(ctx,
		`INSERT INTO programs (user_id, name, status, created_by, start_date)
		 VALUES ($1, 'Draft 1', 'draft', 'grit', '2026-03-03')`,
		userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	count, err = svc.CountUserDrafts(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected 1 draft, got %d", count)
	}

	// Active program should NOT count as draft
	_, err = testPool.Exec(ctx,
		`INSERT INTO programs (user_id, name, status, created_by, start_date)
		 VALUES ($1, 'Active', 'active', 'user', '2026-03-03')`,
		userID,
	)
	if err != nil {
		t.Fatal(err)
	}

	count, err = svc.CountUserDrafts(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected still 1 draft, got %d", count)
	}
}

func TestCanCreateDraft_FreeUserUnderLimit(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")
	ctx := context.Background()

	allowed, err := svc.CanCreateDraft(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("free user with 0 drafts should be allowed")
	}
}

func TestCanCreateDraft_FreeUserAtLimit(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "free")
	ctx := context.Background()

	// Create max drafts
	for i := 0; i < usage.FreeDraftsTotal; i++ {
		_, err := testPool.Exec(ctx,
			`INSERT INTO programs (user_id, name, status, created_by, start_date)
			 VALUES ($1, $2, 'draft', 'grit', '2026-03-03')`,
			userID, "Draft "+string(rune('A'+i)),
		)
		if err != nil {
			t.Fatal(err)
		}
	}

	allowed, err := svc.CanCreateDraft(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Errorf("free user at %d drafts should be blocked", usage.FreeDraftsTotal)
	}
}

func TestCanCreateDraft_PremiumUnlimited(t *testing.T) {
	cleanTables(t)
	svc := usage.NewService(testPool)
	userID := createTestUser(t, "premium")
	ctx := context.Background()

	// Create many drafts
	for i := 0; i < 10; i++ {
		_, err := testPool.Exec(ctx,
			`INSERT INTO programs (user_id, name, status, created_by, start_date)
			 VALUES ($1, $2, 'draft', 'grit', '2026-03-03')`,
			userID, "Draft "+string(rune('A'+i)),
		)
		if err != nil {
			t.Fatal(err)
		}
	}

	allowed, err := svc.CanCreateDraft(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("premium user should always be allowed to create drafts")
	}
}

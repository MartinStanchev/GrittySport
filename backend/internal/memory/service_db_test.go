package memory

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/db"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	ctx := context.Background()
	if dbURL := os.Getenv("TEST_DATABASE_URL"); dbURL != "" {
		var err error
		testPool, err = db.Connect(ctx, dbURL)
		if err != nil {
			panic("failed to connect to test database: " + err.Error())
		}
		migrationsPath := os.Getenv("MIGRATIONS_PATH")
		if migrationsPath == "" {
			migrationsPath = "../../../db/migrations"
		}
		if err := db.RunMigrations(ctx, testPool, migrationsPath); err != nil {
			panic("failed to run migrations: " + err.Error())
		}
	}

	code := m.Run()
	if testPool != nil {
		_, _ = testPool.Exec(ctx, "DELETE FROM users WHERE email LIKE 'memory-test-%'")
		testPool.Close()
	}
	os.Exit(code)
}

// seedMemoryUser creates a user (cascade-deleted with its facts) and returns its ID.
func seedMemoryUser(t *testing.T, name string) string {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	email := "memory-test-" + name + "@example.com"
	_, _ = testPool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
	var id string
	if err := testPool.QueryRow(ctx,
		`INSERT INTO users (email, name) VALUES ($1, 'Test') RETURNING id`, email,
	).Scan(&id); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return id
}

func seedFact(t *testing.T, userID, factType, content string) string {
	t.Helper()
	var id string
	if err := testPool.QueryRow(context.Background(),
		`INSERT INTO chat_facts (user_id, fact_type, content) VALUES ($1, $2, $3) RETURNING id`,
		userID, factType, content,
	).Scan(&id); err != nil {
		t.Fatalf("seed fact: %v", err)
	}
	return id
}

func short(id string) string { return id[:shortIDLen] }

func TestMarkForgotten_ByShortID(t *testing.T) {
	userID := seedMemoryUser(t, "forget")
	otherUserID := seedMemoryUser(t, "forget-other")
	svc := NewService(testPool, nil)
	ctx := context.Background()

	injuryID := seedFact(t, userID, "injury", "Left ankle sprain")
	prefID := seedFact(t, userID, "explicit_preference", "No jumping exercises")
	keepID := seedFact(t, userID, "goal", "Run a sub-50 10k")
	otherID := seedFact(t, otherUserID, "injury", "Someone else's injury")

	forgotten, err := svc.markForgotten(ctx, userID, []string{
		"id:" + strings.ToUpper(short(injuryID)), short(prefID), short(otherID), "not-an-id",
	})
	if err != nil {
		t.Fatalf("markForgotten: %v", err)
	}
	if len(forgotten) != 2 {
		t.Fatalf("forgot %d memories, want 2 (other user's fact must be untouched)", len(forgotten))
	}

	// Assembled memory no longer contains forgotten entries, and shows IDs on the rest.
	mem, err := svc.AssembleMemory(ctx, userID, "", WithIDTags)
	if err != nil {
		t.Fatalf("AssembleMemory: %v", err)
	}
	if strings.Contains(mem, "ankle") || strings.Contains(mem, "jumping") {
		t.Errorf("assembled memory still contains forgotten entries:\n%s", mem)
	}
	if !strings.Contains(mem, "- [id:"+short(keepID)+"] [Goal] Run a sub-50 10k") {
		t.Errorf("assembled memory missing tagged goal fact:\n%s", mem)
	}

	// Without ID tags (review prompts), lines carry no [id:] prefix.
	plain, err := svc.AssembleMemory(ctx, userID, "", WithoutIDTags)
	if err != nil {
		t.Fatalf("AssembleMemory without tags: %v", err)
	}
	if strings.Contains(plain, "[id:") || !strings.Contains(plain, "- [Goal] Run a sub-50 10k") {
		t.Errorf("untagged memory wrong:\n%s", plain)
	}

	// Forgotten facts are markers only for conversations that began before the forget.
	markers, err := svc.getForgottenSince(ctx, userID, time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatalf("getForgottenSince: %v", err)
	}
	if len(markers) != 2 {
		t.Errorf("getForgottenSince(past) len = %d, want 2", len(markers))
	}
	if later, _ := svc.getForgottenSince(ctx, userID, time.Now().Add(time.Hour)); len(later) != 0 {
		t.Errorf("getForgottenSince(future) len = %d, want 0", len(later))
	}

	// Both forgotten facts are owed a summary redaction.
	var pending int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM chat_facts WHERE user_id = $1 AND forgotten_at IS NOT NULL AND summaries_redacted_at IS NULL`,
		userID,
	).Scan(&pending); err != nil || pending != 2 {
		t.Errorf("pending redactions = %d (err %v), want 2", pending, err)
	}

	// The other user's fact is still active.
	var active bool
	if err := testPool.QueryRow(ctx, `SELECT active FROM chat_facts WHERE id = $1`, otherID).Scan(&active); err != nil || !active {
		t.Errorf("other user's fact active = %v (err %v), want true", active, err)
	}

	// Forgetting again is a no-op.
	again, err := svc.markForgotten(ctx, userID, []string{short(injuryID)})
	if err != nil || len(again) != 0 {
		t.Errorf("second markForgotten = %d facts (err %v), want 0", len(again), err)
	}
}

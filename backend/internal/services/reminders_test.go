package services_test

import (
	"context"
	"testing"
	"time"

	"github.com/grittyfitness/api/internal/services"
)

func TestReminderService_CreateAndListActive(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "reminder-list@example.com")
	svc := services.NewReminderService(testPool)

	ctx := context.Background()
	soon := time.Now().Add(1 * time.Hour)
	later := time.Now().Add(24 * time.Hour)

	if _, err := svc.Create(ctx, userID, "Wear new shoes", later); err != nil {
		t.Fatalf("Create later: %v", err)
	}
	if _, err := svc.Create(ctx, userID, "Pack gym bag", soon); err != nil {
		t.Fatalf("Create soon: %v", err)
	}

	got, err := svc.ListActive(ctx, userID)
	if err != nil {
		t.Fatalf("ListActive: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("ListActive len = %d, want 2", len(got))
	}
	// Ordered by remind_at ASC — "soon" should come first.
	if got[0].Content != "Pack gym bag" {
		t.Errorf("ListActive[0] = %q, want soonest first", got[0].Content)
	}
}

func TestReminderService_Cancel(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "reminder-cancel@example.com")
	svc := services.NewReminderService(testPool)
	ctx := context.Background()

	r, err := svc.Create(ctx, userID, "Drink water", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	removed, err := svc.Cancel(ctx, userID, r.ID)
	if err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if !removed {
		t.Fatal("Cancel returned false, want true")
	}

	// Second cancel finds nothing.
	removed, err = svc.Cancel(ctx, userID, r.ID)
	if err != nil {
		t.Fatalf("Cancel (2nd): %v", err)
	}
	if removed {
		t.Error("Cancel (2nd) returned true, want false")
	}
}

func TestReminderService_CancelDoesNotCrossUsers(t *testing.T) {
	cleanTables(t)
	owner := seedUser(t, "reminder-owner@example.com")
	attacker := seedUser(t, "reminder-attacker@example.com")
	svc := services.NewReminderService(testPool)
	ctx := context.Background()

	r, err := svc.Create(ctx, owner, "Owner's reminder", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	removed, err := svc.Cancel(ctx, attacker, r.ID)
	if err != nil {
		t.Fatalf("Cancel (other user): %v", err)
	}
	if removed {
		t.Error("Cancel cross-user returned true — IDOR")
	}

	// Owner can still cancel their own.
	removed, _ = svc.Cancel(ctx, owner, r.ID)
	if !removed {
		t.Error("Owner could not cancel own reminder")
	}
}

func TestReminderService_ListDueAndMarkDelivered(t *testing.T) {
	cleanTables(t)
	userID := seedUser(t, "reminder-due@example.com")
	svc := services.NewReminderService(testPool)
	ctx := context.Background()

	past, err := svc.Create(ctx, userID, "Past reminder", time.Now().Add(-1*time.Minute))
	if err != nil {
		t.Fatalf("Create past: %v", err)
	}
	if _, err := svc.Create(ctx, userID, "Future reminder", time.Now().Add(1*time.Hour)); err != nil {
		t.Fatalf("Create future: %v", err)
	}

	due, err := svc.ListDue(ctx, time.Now())
	if err != nil {
		t.Fatalf("ListDue: %v", err)
	}
	if len(due) != 1 {
		t.Fatalf("ListDue len = %d, want 1", len(due))
	}
	if due[0].ID != past.ID {
		t.Errorf("ListDue returned wrong reminder: got %s, want %s", due[0].ID, past.ID)
	}

	if err := svc.MarkDelivered(ctx, past.ID); err != nil {
		t.Fatalf("MarkDelivered: %v", err)
	}

	// After mark-delivered, the same query should be empty.
	due, _ = svc.ListDue(ctx, time.Now())
	if len(due) != 0 {
		t.Errorf("ListDue after delivery len = %d, want 0", len(due))
	}

	// ListActive also excludes delivered.
	active, _ := svc.ListActive(ctx, userID)
	if len(active) != 1 || active[0].Content != "Future reminder" {
		t.Errorf("ListActive after delivery = %v, want [Future reminder]", active)
	}
}

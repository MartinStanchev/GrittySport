package services_test

import (
	"context"
	"errors"
	"testing"

	"github.com/grittyfitness/api/internal/email"
	"github.com/grittyfitness/api/internal/services"
)

func cleanWishlist(t *testing.T) {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set")
	}
	_, _ = testPool.Exec(context.Background(), "DELETE FROM wishlist_signups")
}

func newWishlistService(mailer email.Sender, notifyTo string) *services.WishlistService {
	return services.NewWishlistService(testPool, mailer, notifyTo)
}

func TestWishlist_SubscribeNew_NormalizesAndNotifies(t *testing.T) {
	cleanWishlist(t)
	mock := &email.MockSender{}
	svc := newWishlistService(mock, "owner@example.com")

	if err := svc.Subscribe(context.Background(), "  Hello@Example.COM "); err != nil {
		t.Fatalf("Subscribe failed: %v", err)
	}

	got := mock.SentWishlist()
	if len(got) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(got))
	}
	if got[0].To != "owner@example.com" {
		t.Errorf("notify-to mismatch: %q", got[0].To)
	}
	if got[0].SignupEmail != "hello@example.com" {
		t.Errorf("signup email should be normalized lowercase: %q", got[0].SignupEmail)
	}

	var count int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM wishlist_signups WHERE email = $1`,
		"hello@example.com",
	).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 row, got %d", count)
	}
}

func TestWishlist_SubscribeDuplicate_NoSecondEmail(t *testing.T) {
	cleanWishlist(t)
	mock := &email.MockSender{}
	svc := newWishlistService(mock, "owner@example.com")

	if err := svc.Subscribe(context.Background(), "dupe@example.com"); err != nil {
		t.Fatalf("first Subscribe failed: %v", err)
	}
	if err := svc.Subscribe(context.Background(), "DUPE@example.com"); err != nil {
		t.Fatalf("second Subscribe failed: %v", err)
	}

	if got := mock.SentWishlist(); len(got) != 1 {
		t.Errorf("duplicate signup should not re-notify; got %d emails", len(got))
	}
}

func TestWishlist_InvalidEmail_ReturnsValidationError(t *testing.T) {
	cleanWishlist(t)
	mock := &email.MockSender{}
	svc := newWishlistService(mock, "owner@example.com")

	err := svc.Subscribe(context.Background(), "not-an-email")
	if err == nil {
		t.Fatal("expected validation error")
	}
	var valErrs *services.ValidationErrors
	if !errors.As(err, &valErrs) {
		t.Fatalf("expected *ValidationErrors, got %T", err)
	}
	if len(mock.SentWishlist()) != 0 {
		t.Errorf("invalid email should not trigger notification")
	}
}

func TestWishlist_EmptyNotifyTo_StillPersists(t *testing.T) {
	cleanWishlist(t)
	mock := &email.MockSender{}
	svc := newWishlistService(mock, "")

	if err := svc.Subscribe(context.Background(), "no-notify@example.com"); err != nil {
		t.Fatalf("Subscribe failed: %v", err)
	}
	if len(mock.SentWishlist()) != 0 {
		t.Errorf("missing notify-to should skip email; got %d", len(mock.SentWishlist()))
	}

	var count int
	if err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM wishlist_signups WHERE email = $1`,
		"no-notify@example.com",
	).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("row should still be persisted; got %d", count)
	}
}

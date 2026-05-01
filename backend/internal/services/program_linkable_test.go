package services

import (
	"testing"
	"time"

	"github.com/grittyfitness/api/internal/models"
)

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return d
}

func TestLinkableDatePriority(t *testing.T) {
	ref := mustDate(t, "2026-05-01")
	cases := []struct {
		date string
		want int // for windowDays=3: -1→0, -2→1, -3→2, today→3, +1→4, +2→5, +3→6
	}{
		{"2026-04-30", 0},
		{"2026-04-29", 1},
		{"2026-04-28", 2},
		{"2026-05-01", 3},
		{"2026-05-02", 4},
		{"2026-05-03", 5},
		{"2026-05-04", 6},
	}
	for _, c := range cases {
		got := linkableDatePriority(mustDate(t, c.date), ref, 3)
		if got != c.want {
			t.Errorf("priority(%s) = %d, want %d", c.date, got, c.want)
		}
	}
}

func makeCandidate(id, actType, date string, sameType bool, order int, t *testing.T) LinkableCandidate {
	return LinkableCandidate{
		Activity: models.LinkableActivityResponse{
			UpcomingActivityResponse: models.UpcomingActivityResponse{
				ID:           id,
				ActivityType: actType,
				Date:         date,
			},
			SameType: sameType,
		},
		Date:       mustDate(t, date),
		OrderIndex: order,
	}
}

func TestSortLinkableCandidates_OrderingIsSameTypeFirstThenPastFirst(t *testing.T) {
	ref := mustDate(t, "2026-05-01")

	// Mixed input: a same-type and a different-type at every offset in [-3,+3].
	items := []LinkableCandidate{
		makeCandidate("oa", "swim", "2026-05-04", false, 0, t),
		makeCandidate("ia", "run", "2026-05-04", true, 0, t),
		makeCandidate("ob", "swim", "2026-05-01", false, 0, t),
		makeCandidate("ib", "run", "2026-05-01", true, 0, t),
		makeCandidate("oc", "swim", "2026-04-30", false, 0, t),
		makeCandidate("ic", "run", "2026-04-30", true, 0, t),
		makeCandidate("od", "swim", "2026-04-28", false, 0, t),
		makeCandidate("id", "run", "2026-04-28", true, 0, t),
	}
	SortLinkableCandidates(items, ref, 3)

	wantIDs := []string{
		// same-type bucket: -1, -3, today, +3 (past first by recency, then today, then future)
		"ic", "id", "ib", "ia",
		// other-type bucket: same order
		"oc", "od", "ob", "oa",
	}
	for i, want := range wantIDs {
		if items[i].Activity.ID != want {
			t.Errorf("position %d: got %s, want %s", i, items[i].Activity.ID, want)
		}
	}
}

func TestSortLinkableCandidates_TieBreakerIsOrderIndex(t *testing.T) {
	ref := mustDate(t, "2026-05-01")
	items := []LinkableCandidate{
		makeCandidate("b", "run", "2026-05-01", true, 2, t),
		makeCandidate("a", "run", "2026-05-01", true, 1, t),
		makeCandidate("c", "run", "2026-05-01", true, 0, t),
	}
	SortLinkableCandidates(items, ref, 3)
	wantIDs := []string{"c", "a", "b"}
	for i, want := range wantIDs {
		if items[i].Activity.ID != want {
			t.Errorf("position %d: got %s, want %s", i, items[i].Activity.ID, want)
		}
	}
}

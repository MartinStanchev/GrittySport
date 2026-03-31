# Enriched Edit Proposals with Before/After Diffs

When Grit proposes changes to an active program via `edit_program`, the UI now shows rich before→after diffs instead of basic one-liners.

## Backend: Edit Enrichment

- **New model types** (`models/program.go`): `ActivitySnapshot`, `CriterionSnapshot`, `EditBeforeState`, `EnrichedEdit` (embeds `ProgramEdit` + optional `Before`)
- **`ResolveEditsBefore`** (`services/program.go`): Resolves the "before" state for each edit:
  - `update_activity`/`remove_activity` with ActivityID → `GetScheduledActivity`
  - `update_activity`/`remove_activity` with DayOfWeek → `sampleActivityByDay` (single-query LIMIT 1 helper)
  - `swap_day` → `sampleActivitiesByDay` for both days (correlated subquery helper)
  - `update_criteria` → pre-fetched criteria map lookup
  - `add_activity` → no before state (nil)
  - All errors non-fatal: Before stays nil, edit still included
- **Wired into `edit_program` handler** (`tools/tools.go`): Enriches edits after marshaling, falls back to raw edits on error
- **Backwards compatible**: `confirm_edit` deserializes `[]ProgramEdit` — Go's JSON decoder silently ignores the extra `before` field

## Frontend: Bifurcated Rendering

### Small edits (≤3) — Inline Detail Card
- Each edit rendered as an `EditDetailBlock` with before→after diffs
- **update**: dimmed old activity → arrow → highlighted new activity
- **remove**: dimmed removed activity with red tint
- **add**: highlighted new activity with green tint
- **swap**: two-column layout with swap icon showing both days' activities
- **criteria**: old value → new value per criterion
- Falls back to one-liner if `before` is missing

### Large edits (>3) — Compact Card + Full-Screen Review
- `CompactEditCard`: Badge, description, stats row, "REVIEW CHANGES" button
- `EditProposalReviewView`: Full-screen modal mirroring `ProposalReviewView` structure
  - Edits grouped by action type (Updates/Additions/Removals/Day Swaps/Other)
  - Collapsible groups
  - Sticky bottom bar: "APPLY CHANGES" + "LET'S DISCUSS"

## Key Files Changed

| File | Change |
|------|--------|
| `backend/internal/models/program.go` | New types: ActivitySnapshot, EditBeforeState, EnrichedEdit |
| `backend/internal/services/program.go` | `ResolveEditsBefore` + `sampleActivityByDay` + `sampleActivitiesByDay` |
| `backend/internal/tools/tools.go` | Wired enrichment into edit_program handler |
| `frontend/src/components/ProgramEditCard.tsx` | Bifurcated rendering, before/after blocks, shared helpers |
| `frontend/src/components/EditProposalReviewView.tsx` | New full-screen review modal |
| `frontend/src/screens/HomeScreen.tsx` | Review state + modal wiring |

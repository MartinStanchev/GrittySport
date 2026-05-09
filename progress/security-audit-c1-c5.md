# Security audit fixes — C1 through C5

Five critical vulnerabilities flagged in an external audit. All confirmed in
the code, all fixed.

## C1 — IDOR: workout linked to another user's scheduled activity

**Found**: `WorkoutService.Create` (`backend/internal/services/workout.go:75`)
inserted `scheduled_activity_id` from the request body without checking
ownership; same for `LinkToActivity`. An attacker could overwrite any victim's
`linked_workout_id` to point at the attacker's workout.

**Fix**: Added `verifyScheduledActivityOwnership` (joins `scheduled_activities
→ weeks → phases → programs.user_id`) called from both `Create` and
`LinkToActivity`. New sentinel `ErrScheduledActivityDenied` mapped to 403 in
`handlers/workout.go`. Same error returned for not-found and not-owned to
avoid existence leaks.

## C2 — Cross-user destructive write via LLM-controlled `draft_program_id`

**Found**: `ProgramService.SaveProgramWithCriteria`
(`backend/internal/services/program.go:240-260`). The `UPDATE programs … WHERE
id=$1 AND user_id=$2` was scoped, but `RowsAffected` was never checked, then
the subsequent `DELETE FROM phases WHERE program_id=$1` and `DELETE FROM
program_criteria WHERE program_id=$1` were unscoped. If the chat tool
`confirm_program_save` was prompt-injected to use a victim's program UUID, it
would delete the victim's phases/criteria and overwrite with the attacker's
content.

**Fix**: New `verifyProgramOwnershipTx` runs at the top of the draft branch
before any write; the UPDATE now also asserts `RowsAffected() != 0` as a
defence in depth.

## C3 — WS bearer JWT logged via chi.Logger query string

**Found**: `r.Use(chimw.Logger)` in `main.go:148` combined with the WS
handshake passing the JWT as `?token=…` (`handlers/chat.go:104-110`). Every
upgrade wrote the bearer to stdout, log aggregator, reverse-proxy access logs,
and would also flow through Referer/browser history.

**Fix**: New `internal/middleware/logger.go` (`RequestLogger`) — zerolog-based
mirror of chi.Logger that runs `redactQuery` over `r.URL.RawQuery`, replacing
values for `token`, `access_token`, `refresh_token`, and `code` with
`[REDACTED]`. Swapped into `main.go`. The handler still sees the original URL
because the redaction happens only at log emission.

## C4 — WS connection survives JWT expiry, logout, and account deletion

**Found**: `handlers/chat.go` validated the JWT once at upgrade
(`chat.go:112`) and never again, so a connection persisted for the
6-month-or-longer lifetime of the WS process. Worse, `JWTAuth` middleware
(`middleware/auth.go:34`) had no DB check, so a deleted user kept full API
access for the remainder of the access-token TTL.

**Fix**: Two changes.
1. `ValidateAccessToken` now takes a `context.Context` and runs `SELECT
   EXISTS(SELECT 1 FROM users WHERE id = $1)` after JWT parsing. Both the
   middleware and the WS upgrade use it.
2. Inside the WS read loop, every inbound frame re-runs
   `ValidateAccessToken`; on failure the server emits an `error` frame and
   closes. Catches expiry, logout, and deletion within one round-trip.

## C5 — Refresh tokens stored in plaintext, no reuse detection

**Found**: `db/migrations/002_create_refresh_tokens.sql` stored a UUID in the
`token` column; `services/auth.go` queried by raw value. A DB read (backup
exfiltration, replica access, future SQLi) handed an attacker working 180-day
session tokens for every user. No reuse detection either.

**Fix**:
- New migration `026_hash_refresh_tokens.sql`: `TRUNCATE` then drop `token`,
  add `token_hash TEXT NOT NULL`, `family_id UUID NOT NULL DEFAULT
  gen_random_uuid()`, `consumed_at TIMESTAMPTZ`. Two indexes (unique on hash,
  non-unique on family).
- `generateRefreshToken` returns 32 bytes of `crypto/rand` hex-encoded;
  `hashRefreshToken` is SHA-256 (high-entropy input — bcrypt's slowness isn't
  needed and would hurt every login).
- `RefreshToken` looks up by hash, marks `consumed_at = now()` instead of
  deleting, and issues the next token in the same `family_id`.
- **Reuse detection**: when `RefreshToken` finds a row whose `consumed_at IS
  NOT NULL`, it interprets that as theft-or-race and `DELETE`s every row
  sharing that `family_id`. The legitimate client and the attacker both lose
  the family — safe default.
- Per project policy ("no backwards compatibility"), the migration
  `TRUNCATE`s; existing sessions force a fresh OTP login.

## Validation

- `go build ./...` clean.
- `go vet ./...` clean.
- `golangci-lint run ./...` clean.
- `go test ./internal/services/... ./internal/middleware/... ./internal/handlers/...` passes.
- DB-backed tests (services/middleware) skip when `TEST_DATABASE_URL` is
  unset — the new `TestJWTAuth_DeletedUserRejected` exercises C4 against a
  real database when run with the env var.

## Key files changed

- `backend/internal/services/workout.go` — ownership check, new error.
- `backend/internal/handlers/workout.go` — error mapping to 403.
- `backend/internal/services/program.go` — tx-scoped ownership verification + `RowsAffected` assert.
- `backend/internal/middleware/logger.go` (new) — redacting access logger.
- `backend/main.go` — uses the new logger middleware.
- `backend/internal/services/auth.go` — `ValidateAccessToken(ctx, …)` with
  user-existence check; hashed refresh tokens; family-based reuse detection.
- `backend/internal/middleware/auth.go` — passes request context to validator.
- `backend/internal/handlers/chat.go` — re-validates JWT on every WS frame.
- `backend/internal/services/auth_test.go` — updated for new signature and column.
- `backend/internal/middleware/auth_test.go` — DB-backed valid/deleted-user tests.
- `db/migrations/026_hash_refresh_tokens.sql` (new).

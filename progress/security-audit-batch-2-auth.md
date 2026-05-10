# Security Audit Batch 2 — Auth Hardening

Second batch from the full security audit. Eleven fixes across the auth surface,
the WebSocket entry point, the consent flow, and the usage limiter. Bundles
the one Critical (CSWSH) plus the auth-cluster Highs and Mediums.

## Findings closed

| ID | Severity | One-line |
|----|----------|----------|
| C1 | Critical | WebSocket `CheckOrigin` returned `true` — CSWSH wide open |
| H5 | High     | No per-IP rate limit on `/api/auth/*` (OTP mail-bomb, refresh brute force) |
| H6 | High     | Account deletion didn't purge `email_otps`; redeemable OTP could resurrect a deleted account |
| H8 | High     | `clientIP` helper re-read `X-Forwarded-For` — spoofable GDPR audit IP |
| M1 | Medium   | OTP attempt counter check-then-update race — N parallel guesses bypass the 5-attempt cap |
| M2 | Medium   | Refresh-token concurrent-consume race — false-positive logout for legit parallel refreshes |
| M3 | Medium   | No JWT revocation — `RevokeAll` left access tokens valid for ≤15 min |
| M4 | Medium   | `consents_completed_at` not enforced by middleware — un-consented users could call every endpoint |
| M5 | Medium   | Consent endpoint accepted client-supplied `version`; duplicates allowed; `birth_year` re-attestable |
| M11| Medium   | `propose_program` didn't validate `draft_program_id` ownership upfront |
| M12| Medium   | Chat rate-limit was check-then-increment without atomicity |

## Implementation

### C1 — WebSocket origin allowlist
- `handlers/chat.go`: moved `upgrader` from package var into `ChatHandler` field.
- New constructor parameter `allowedOrigins map[string]struct{}` mirrors the REST CORS allowlist.
- `CheckOrigin` allows empty Origin (native mobile clients send none) and otherwise requires allowlist match.
- `main.go` passes `corsAllowed` into `NewChatHandler`.

### H5 — Per-IP rate limit on /api/auth/*
- New file `middleware/ratelimit.go`: in-process token bucket, 30-burst + 0.5/s refill, 10-min idle prune.
- Wired in `main.go` as `r.Use(authLimiter.Middleware)` on the `/api/auth` route group.
- Acceptable at single-replica scale; comment notes Redis swap when scaling horizontally.

### H6 — Purge OTPs on account deletion
- `services/user.go::Delete` now `SELECT email FROM users` first, then `DELETE FROM email_otps WHERE email = $1` inside the same tx.
- `email_otps` is keyed by email (not user_id), so the cascade FK on `users` doesn't reach it.

### H8 — Drop spoofable clientIP helper
- `handlers/consent.go`: removed local `clientIP(r)` that re-read `X-Forwarded-For`.
- Switched to `r.RemoteAddr` (already normalized by `chimw.RealIP`).
- Added `stripPort` helper because `r.RemoteAddr` is `host:port` and the `INET` column rejects ports.

### M1 — OTP race
- Added `FOR UPDATE` to the OTP `SELECT` so concurrent guesses serialise on the row lock.
- Kept the explicit `ErrOTPLocked` semantics; the race fix is purely in the row lock.

### M2 — Refresh-token race
- `RefreshToken` consume `UPDATE` now has `WHERE … AND consumed_at IS NULL` and asserts `RowsAffected() == 1`.
- Two parallel refreshes of the same token can no longer both succeed.

### M3 — `token_version` JWT revocation
- New migration `028_security_batch_2.sql`: `users.token_version INT NOT NULL DEFAULT 0`.
- `generateAccessToken(user, tv)` embeds `tv` claim.
- `issueTokensInFamily` reads the current `token_version` from the tx and passes it.
- `ValidateAccessToken` reads `token_version` from DB and rejects mismatches; legacy tokens (no `tv` claim) decode as `0` and validate until natural expiry.
- `RevokeAllRefreshTokens` now wraps the delete + `UPDATE users SET token_version = token_version + 1` in a tx.

### M4 — Consent gate middleware
- New `middleware.RequireConsents(consentChecker)` returns 403 + `{"code":"consents_required"}` when `consents_completed_at IS NULL`.
- `services/user.go` exposes `HasCompletedConsents(ctx, userID) (bool, error)`.
- Routes split: `users/me` GET/PUT/DELETE + `POST /consents` are exempt; everything else under `/api/v1` is gated.

### M5 — Consent versioning + immutable birth_year
- New `canonicalConsentVersions` map keyed by consent type (sourced from `models.TermsVersion` etc.).
- `validateRequired` rejects mismatched/stale `version` strings with `ErrConsentVersionMismatch` (422).
- INSERT uses canonical version + `ON CONFLICT (user_id, consent_type, version) WHERE withdrawn_at IS NULL DO NOTHING` against the new partial unique index.
- `UPDATE users` uses `birth_year = COALESCE(birth_year, $2)` and `consents_completed_at = COALESCE(...)` so neither can be re-attested.

### M11 — `propose_program` ownership check
- `tools/tools.go::propose_program` now calls `programSvc.VerifyProgramOwnership(ctx, draftProgramID, userID)` upfront when present.
- Mirrors the existing pattern in `edit_program`.

### M12 — Atomic chat rate-limit
- `usage/service.go::CheckAndIncrement` collapsed two-step (SELECT FOR UPDATE → UPDATE) into single `UPDATE … WHERE col < limit RETURNING col`.
- `pgx.ErrNoRows` from `RETURNING` means the cap was reached → `(false, 0, nil)`.

## Schema

`db/migrations/028_security_batch_2.sql`:
- `ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0`
- `CREATE UNIQUE INDEX ux_user_consents_active_version ON user_consents(user_id, consent_type, version) WHERE withdrawn_at IS NULL`

## Tests

- All existing unit + integration tests still green (integration suite runs in CI with `TEST_DATABASE_URL`).
- `consent_test.go`: replaced placeholder `Version: "v1"` strings with the canonical constants; added `TestRecordConsents_StaleVersion_Rejects` and `TestRecordConsents_BirthYearImmutableAfterFirstSet` to lock in the new contracts.
- OTP attempt-counter tests untouched — the `FOR UPDATE` change preserves their semantics.

## Files changed

Backend Go:
- `backend/internal/handlers/chat.go`
- `backend/internal/handlers/consent.go`
- `backend/internal/middleware/auth.go`
- `backend/internal/middleware/ratelimit.go` (new)
- `backend/internal/services/auth.go`
- `backend/internal/services/consent.go`
- `backend/internal/services/user.go`
- `backend/internal/services/consent_test.go`
- `backend/internal/tools/tools.go`
- `backend/internal/usage/service.go`
- `backend/main.go`

DB:
- `db/migrations/028_security_batch_2.sql` (new)

## Deviations from the original audit recommendation

- **M11** suggested also enforcing one in-flight proposal per user (409 on race). Skipped: the LLM legitimately re-proposes during a single conversation when the user requests changes, so the lock would break the happy path. Upfront ownership validation closes the actual confused-deputy concern.
- **M3** kept `tv` decoded as `float64` (JSON number default) and tolerated missing claim as `0` rather than forcing a hard fail, so tokens minted before the rollout don't all simultaneously bounce to login.
- **L1** (per-IP OTP-rate-limit replication concern) is partially addressed by H5's per-IP middleware — full Redis migration deferred until horizontal scaling is on the table.

## Remaining work

Subsequent batches (per the audit aggregate):
- Batch 1: server hardening (body cap, WS frame cap, server timeouts, security headers, custom recoverer, compose binding, Dockerfile)
- Batch 3: AI/prompt-injection surface (WS token out of URL, sanitize `save_user_preference` content, sanitize tool summaries, scope chat-history `before` cursor, frontend Markdown link allowlist)
- Batch 4: misc/low (push-token global UNIQUE, frontend file/zip caps, weekly-effort goal upper bound, etc.)

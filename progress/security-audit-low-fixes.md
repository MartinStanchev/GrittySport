# Security audit — low-severity fixes (defense-in-depth)

Five low-severity findings from the security audit, all closed for defense-in-depth.

## L1 — `GetActivityDetail` not user-scoped at SQL
- `services/program.go::GetActivityDetail` previously queried by `sa.id` only and relied on a single in-memory `activity.UserID != userID` check at the handler.
- Added `WHERE p.user_id = $2` to the SQL and threaded `userID` through the function signature.
- `handlers/program.go::GetActivity` drops the redundant in-memory ownership check (SQL now returns no row).
- `handlers/program.go::UpdateActivity` keeps the `oldActivity.ProgramID != programID` check (URL-contract guard, not security).

## L2 — JWT method check accepted any HMAC variant
- `services/auth.go::ValidateAccessToken` previously matched `*jwt.SigningMethodHMAC` (HS256/384/512). We only ever sign HS256, so a forger could try downgrading.
- Tightened to `t.Method != jwt.SigningMethodHS256`.

## L3 — Timing leak in OTP verify on no-row
- `services/auth.go::VerifyOTP` previously returned `ErrInvalidOTP` immediately on `pgx.ErrNoRows`, while the success path takes ~50 ms in bcrypt — leaking "is there a pending OTP for this email".
- Added `dummyOTPHash` precomputed once in `NewAuthService`. The no-row branch runs `bcrypt.CompareHashAndPassword(dummy, code)` to match the success-path timing.

## L4 — CORS `Access-Control-Allow-Origin: *`
- Safe today (Bearer tokens, no cookies) but would become catastrophic if cookie auth were ever added.
- Replaced wildcard with an env-driven allowlist. `CORS_ALLOWED_ORIGINS` is a comma-separated list; if unset, the default covers Expo web (8081/19006/19000), Next dev (3000), and the API (8080) on `localhost`/`127.0.0.1`.
- Echoes the matching `Origin` back and adds `Vary: Origin` for cache correctness.

## L5 — `JWT_SECRET=your-secret-key-here` placeholder accepted at startup
- Added `validateJWTSecret`: rejects empty, known placeholders (case-insensitive), and secrets shorter than 32 chars.
- `.env.example` now ships a placeholder that's also on the rejection list and instructs `openssl rand -hex 32`.

## Files changed
- `backend/internal/services/auth.go` — HS256 pin, dummy bcrypt timing match, `dummyOTPHash` field.
- `backend/internal/services/program.go` — `GetActivityDetail(ctx, activityID, userID)` signature + scoped SQL; two internal callers updated.
- `backend/internal/handlers/program.go` — pass `userID` to `GetActivityDetail`; drop redundant ownership check.
- `backend/main.go` — `validateJWTSecret`, `parseCORSOrigins`, allowlist `corsMiddleware(allowed)`.
- `backend/main_test.go` — new tests for `validateJWTSecret` and `parseCORSOrigins`.
- `.env.example` — new placeholder + `CORS_ALLOWED_ORIGINS` documentation.

## Validation
- `go build ./...` clean
- `golangci-lint run ./...` clean
- `go test ./...` all packages pass

## Operator note
- Existing dev `.env` files with a JWT_SECRET shorter than 32 characters or matching a known placeholder will now fail to boot. Regenerate with `openssl rand -hex 32` and update `.env`.

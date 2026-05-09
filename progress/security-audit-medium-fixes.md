# Security Audit — Medium-Severity Fixes

Addressed seven medium-severity findings from a backend security audit.
Fixes prioritize fail-safe defaults (fail closed on errors, fail fast on
unsafe configurations) and tighten the authentication surface.

## What changed

### M1 — PII out of debug logs
- `handlers/chat.go`: stop emitting raw user message content; log only
  `content_len`. The user_id is enough to correlate; the actual content
  lives in the DB if a debugger really needs it.
- `ai/gemini.go`: tool-call args and results are now gated behind
  `appconfig.IsDevelopment()`. In prod the tool name + round are logged;
  full payloads only appear in dev.

### M2 — Email sender fails fast in prod
- `email.New` now returns `(Sender, error)`. When `RESEND_API_KEY` is
  unset and `APP_ENV` is not `development`/`dev`/`local`, it returns
  `ErrMissingAPIKey` so `main.go` aborts rather than silently dropping
  in MockSender (which logs codes to stdout).
- New `internal/config/env.go` exposes `IsDevelopment()` as the single
  source of truth for env-gated behavior.

### M3 — Usage quota fails closed
- `usage.Service.CheckAndIncrement`: every DB error path now returns
  `(false, 0, err)` instead of `(true, -1, nil)`. A database hiccup
  blocks the LLM call rather than handing the user unlimited Gemini.
- `CanCreateProgram` / `CanCreateDraft`: same shift to fail-closed.
- Callers (`handlers/chat.go`, `review/scheduler.go`) now check the
  error and surface a generic service error instead of silently
  treating it as "rate limit reached".

### M4 — TriggerReview ownership before quota
- `handlers/workout.TriggerReview`: synchronous `WorkoutService.GetByID`
  ownership check before `CheckAndIncrement`. Calling the endpoint with
  someone else's workout ID returns 404 and never burns the
  `post_workout_review` counter.

### M5 — Refresh token reuse detection
- Already in-flight (`migrations/026_hash_refresh_tokens.sql` + the
  rotation logic in `services/auth.go`): tokens are stored as SHA-256
  hashes, every refresh row carries a `family_id`, rotated rows stay
  with `consumed_at` set, and replaying a consumed token deletes the
  whole family. No additional change required for this fix.

### M6 — Bound user input
- New `internal/validate` package centralizes string-length and
  numeric-range checks (timezone, body metrics, names, notes,
  criterion label/value, push tokens).
- `handlers/user.UpdateMe` validates every optional field, including
  `time.LoadLocation` for the timezone.
- `handlers/program.Create` / `UpdateProgram` / `UpdateCriteria`
  enforce string limits and array caps.
- `handlers/notification.RegisterToken` / `DeleteToken` cap push token
  length at 256 chars.

### M7 — Single active OTP per email
- `services.AuthService.RequestOTP` now wraps the insert in a
  transaction that first marks every prior unconsumed login OTP for the
  same email as `consumed_at = now()`. Combined with the existing
  per-row attempt counter, this restores the design intent: an attacker
  can no longer multiply guesses by requesting fresh codes between
  attempts.

## Key files changed

- `backend/internal/config/env.go` — new
- `backend/internal/validate/validate.go` — new
- `backend/internal/email/sender.go`, `sender_test.go`
- `backend/internal/usage/service.go`
- `backend/internal/services/auth.go`
- `backend/internal/handlers/chat.go`, `workout.go`, `user.go`,
  `program.go`, `notification.go`
- `backend/internal/ai/gemini.go`
- `backend/internal/review/scheduler.go`
- `backend/main.go` (consume new email.New error)

## Operational note

Setting `APP_ENV=development` (or `dev` / `local`) preserves the old
behavior for local work: MockSender activates, full tool-call payloads
appear in debug logs. Production must leave `APP_ENV` unset or set to
anything else.

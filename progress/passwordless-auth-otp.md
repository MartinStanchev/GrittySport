# Passwordless Auth (Email OTP via Resend)

Phase 1 of the auth modernization: replace password-based registration/login with email OTP. SSO (Apple/Google) and passkeys are planned for later phases; the schema is built so they can be added without re-shaping the model. Pre-production rip-out — no backwards compatibility, no data migration.

## What changed

- **Passwords removed entirely.** No `password_hash`, no bcrypt-on-login, no register/login endpoints.
- **One unified OTP flow** for both signup and login. The frontend sends `email → /otp/request` (always 204), then `email + code → /otp/verify` (returns `AuthResponse`). The backend creates a user on first verify (implicit signup) and reuses on subsequent verifies (login).
- **Auto-linking by email.** A user that already exists with a given email but no email auth_identity (e.g. future SSO signup) gets the email identity silently linked on first OTP verify. No "email already in use" error path.
- **6-month sessions.** Refresh-token TTL bumped from 30 days to 180 days, configurable via `REFRESH_TOKEN_TTL_DAYS`. Access token TTL unchanged at 15 min.
- **Resend** as the email provider. Falls back to a `MockSender` when `RESEND_API_KEY` is unset, so dev/tests just log the code.
- **In-memory rate limit:** 1 send per email per 60s, max 5/hour. Resets on process restart (acceptable at current scale).
- **OTP rows** carry attempt counters; locked at 5 wrong guesses (force re-request). Codes are bcrypt-hashed at rest, expire in 10 min, can be consumed once.

## DB schema (migration 023)

- `users.password_hash` dropped.
- New `auth_identities` table — one row per (user, provider) pair. `provider` ∈ `{email, google, apple}` (last two unused in phase 1 but in the CHECK to forward-proof). `UNIQUE (provider, provider_user_id)` enforces "one user per (provider, identifier)".
- New `email_otps` table — one row per OTP send, keyed by email (not user_id, since signup-OTPs predate user creation). `attempts`, `expires_at`, `consumed_at` columns drive the verify-time state machine.

## Frontend flow

- `LoginScreen.tsx`, `RegisterScreen.tsx`, `AuthStackNavigator.tsx` — all deleted.
- New `AuthScreen.tsx` — single screen with two steps (email → code), 30s resend cooldown, "Change email" back-button. Uses `autoComplete="one-time-code"` so iOS surfaces the code from the email automatically.
- After verify, the `profile_completed=false` gate in `App.tsx` routes to `ProfileSetupScreen` as before — that screen now also captures `name` (previously collected at registration).
- `AuthContext` swapped `signIn`/`signUp` for `requestOtp`/`verifyOtp`.
- `apiFetch` learned to handle 204 No Content (returns `undefined as T`) for the OTP-request endpoint.

## Recovery model (per discussion)

- **Multi-method nudge** (planned for SSO phase): after first signup, prompt to add a second auth method.
- **Trusted-device fallback** (planned): on a device with a recent valid session, allow adding a new email/SSO without OTP.
- **Manual support recovery** for genuine lockouts (no method, no recent session).
- **Single-method users with lost email** is an accepted residual risk — signup ToS will say so.
- No recovery codes (users don't save them; they become a phishing surface).

## Env vars added

| Var | Default | Purpose |
|------|---------|---------|
| `RESEND_API_KEY` | unset → MockSender | Resend HTTP API key |
| `EMAIL_FROM` | `Gritty Fitness <noreply@grittyfitness.app>` | From address |
| `REFRESH_TOKEN_TTL_DAYS` | 180 | Session length |

## Key files

**Backend**
- `db/migrations/023_passwordless_auth.sql` — drop password_hash, add auth_identities + email_otps
- `backend/internal/email/{sender,resend,mock}.go` + tests — new package, HTTP-direct, no SDK
- `backend/internal/services/auth.go` — `RequestOTP`, `VerifyOTP`, `findOrCreateUserByEmail`, in-memory `checkRateLimit`/`recordSend`, `issueTokens` factored out
- `backend/internal/handlers/auth.go` — `/otp/request`, `/otp/verify`, `/refresh`
- `backend/internal/models/{auth_identity,email_otp}.go`
- `backend/main.go` — wires `email.New(...)`, reads `REFRESH_TOKEN_TTL_DAYS`
- `backend/internal/usage/service_test.go` — fix to drop `password_hash` from test seed

**Frontend**
- `frontend/src/screens/auth/AuthScreen.tsx` — new
- `frontend/src/screens/auth/{LoginScreen,RegisterScreen}.tsx` — deleted
- `frontend/src/navigation/AuthStackNavigator.tsx` — deleted
- `frontend/src/screens/auth/ProfileSetupScreen.tsx` — added `name` field
- `frontend/src/contexts/AuthContext.tsx` — `requestOtp`/`verifyOtp`
- `frontend/src/services/api.ts` — `requestOtp`/`verifyOtp` exports + 204 handling in `apiFetch`
- `frontend/App.tsx` — renders `<AuthScreen />` directly when unauthenticated

## Tests

- 17 new auth service tests (OTP request, verify happy/sad paths, attempt counting, lockout, expiry, consumed-code reuse, refresh rotation, identity linking).
- 6 new handler tests covering the new endpoints + refresh.
- 5 email package tests (Resend HTTP shape, error paths, mock recording).
- All existing middleware tests still pass (JWT validation unchanged).
- `golangci-lint` clean. Frontend `tsc`/`expo lint` introduce no new issues.

## Deviations from the original plan

- Dropped `OTPPurposeAddMethod` from the Go constants (kept in the DB CHECK constraint for forward-proofing only — Go side will add the constant when SSO ships).
- Dropped `AuthIdentity` model struct + Google/Apple constants — nothing reads them yet; will reintroduce when SSO ships.
- The `ProfileSetupScreen` "Skip for now" button still works, so users who skip have an email-derived name (`stanchev.martin` from `stanchev.martin@gmail.com`) until they edit it in Settings. Acceptable — name validation only applies to the "Continue" path.

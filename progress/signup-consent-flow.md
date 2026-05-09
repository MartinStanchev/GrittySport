# Signup Consent Flow

GDPR + German legal compliance: a new user must give explicit consent before we process anything beyond email + auth. Auditable trail stored in `user_consents` (history-friendly: one row per acceptance/withdrawal event), gated by a denormalized `users.consents_completed_at` flag the frontend reads on every launch. Pre-launch with no real users — all existing test users will hit the gate on next sign-in (intentional).

## What we collect

Four required acceptances + one optional:

1. **AGB + Datenschutzerklärung** — combined into one row in the UI (one acceptance, two link-outs to the marketing site). Stored as two separate rows in the DB (`terms` and `privacy`).
2. **Health-data processing (GDPR Art. 9)** — explicit consent. Without this we can't legally process heart rate / training performance / body metrics under "performance of contract."
3. **Age 16+ confirmation** — required for §8 GDPR information-society services in Germany.
4. **Marketing emails (optional)** — separately ticked, defaults off. Stored only if accepted.

Each row also captures the version string at acceptance time (so a future version bump can detect users still on the old version), plus IP and User-Agent for proof.

## Flow

1. User submits OTP → backend creates the user, returns `is_new_user: true`, `user.consents_completed_at = null`.
2. `App.tsx` routes to `ConsentScreen` for any signed-in user without `consents_completed_at` (covers new signups + grandfathered test users).
3. User ticks the required boxes (and optionally marketing) → `POST /api/v1/consents` records all rows + sets `consents_completed_at = now()` in one transaction.
4. `refreshUser()` re-fetches `/users/me` → routing falls through to `ProfileSetupScreen`.

If a required consent is missing in the request the handler returns 422 and the transaction rolls back — no partial state.

## Schema (migration 024)

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('terms','privacy','health_data','age_16_plus','marketing')),
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT
);

ALTER TABLE users ADD COLUMN consents_completed_at TIMESTAMPTZ;
```

History model: a fresh row is inserted on every acceptance event. To withdraw (e.g. unsubscribe from marketing), set `withdrawn_at` on the most-recent row for that (user, type). Current state for any (user, type) = the most-recent row with `withdrawn_at IS NULL`.

## Versioning

Versions live in two places — backend (`models.TermsVersion`, etc.) and frontend (`ConsentVersions`) — intentionally. Each side records the version it shipped with. When legal text changes, bump both. Future enhancement (not built): backend can compare the current required versions against each user's stored versions and re-prompt if outdated.

## Required vs optional

`models.RequiredConsents` lists the four required types. `ConsentService.RecordConsents` rejects any submission missing any of them. Marketing is silently accepted if present, silently absent if not.

## Key files

**Backend**
- `db/migrations/024_user_consents.sql`
- `backend/internal/models/consent.go` — type + version constants, `RequiredConsents` slice, `UserConsent` struct.
- `backend/internal/services/consent.go` — `ConsentService.RecordConsents`, validation, IP/UA pass-through.
- `backend/internal/handlers/consent.go` — `POST /api/v1/consents`, `clientIP` helper (X-Forwarded-For first hop, fallback to RemoteAddr).
- `backend/internal/services/consent_test.go` — 4 tests: happy path, missing required, optional marketing, unknown type.
- `backend/internal/services/auth.go` — `findOrCreateUserByEmail` returns `(UserResponse, isNew, error)`; verify response carries `IsNewUser`. `consents_completed_at` plumbed through SELECT/RETURNING column lists.
- `backend/internal/services/user.go` — same column-list extension on `GetByID` and `Update`.
- `backend/internal/models/{user,token}.go` — `ConsentsCompletedAt` on User/UserResponse, `IsNewUser` on AuthResponse.
- `backend/main.go` — wired `consentService` + `consentHandler`, added route.

**Frontend**
- `frontend/src/screens/auth/ConsentScreen.tsx` — form with 4 checkboxes (terms+privacy combined, health-data, age 16+, marketing optional). German legal labels per requirement. Links out to `LEGAL_URLS`.
- `frontend/src/constants/consents.ts` — `ConsentVersions` mirror of backend.
- `frontend/src/services/api.ts` — `recordConsents()`, `ConsentInput` type, `is_new_user`/`consents_completed_at` fields on responses.
- `frontend/src/contexts/AuthContext.tsx` — exposed `refreshUser`.
- `frontend/App.tsx` — gate inserted between auth and profile-completed checks.

## Open follow-ups (not in this task)

- "Delete account" in Settings (GDPR Art. 17) — being worked on separately.
- Data export (GDPR Art. 20) — being worked on separately.
- Version-bump re-prompt — when legal text changes, compare current vs accepted version and route back to `ConsentScreen`. Currently we only check the boolean flag.
- Marketing opt-out toggle in Settings — not needed yet (no marketing emails being sent), but the schema supports it via `withdrawn_at`.

## Feature 33: Direct Strava Upload (Phase 2 of Workout Sharing)

### Goal
One-tap "Share to Strava" from a completed workout — no detour through the OS share sheet, no manual file picking. The user connects their Strava account once in Settings, then every workout detail screen gets a dedicated **Share to Strava** button that uploads the activity directly via Strava's API.

Phase 1 (GPX/TCX export via the OS share sheet) is already shipped — see [progress/workout-export-and-share.md](../progress/workout-export-and-share.md). That stays in place as a fallback for users who haven't connected Strava (or who want to send to Garmin Connect, AirDrop, etc.).

### Why this approach
- The Phase 1 share sheet works but is friction-heavy: tap Share → tap Strava → tap Upload → confirm activity name/type. Direct upload reduces that to one tap and feels native, which matters for the social-sharing reflex (users who don't share immediately after finishing a workout usually never share).
- Strava is by far the dominant destination among the fitness audience we're targeting — supporting it natively is high-leverage even if we skip Garmin Connect direct integration for now.
- The Strava API is free; the only real cost is the time to register, comply with branding rules, and apply for the production access tier (see "Strava registration prerequisites" below).
- Storing OAuth tokens on the backend (not the device) means we can also support **automatic upload** later (toggle: "Auto-share to Strava after every workout"), which is a natural follow-up after this lands.

### Strava registration prerequisites (do this BEFORE coding)
1. Register an API application at https://developers.strava.com → get Client ID + Client Secret. Free.
2. Set OAuth redirect URIs: `grittyfitness://strava/callback` (mobile deep link) and `https://api.grittyfitness.app/v1/integrations/strava/callback` (backend, used if we ever do a web-side flow).
3. Comply with Strava's [Brand Guidelines](https://developers.strava.com/guidelines/) — the "Connect with Strava" button must use their official orange button asset; any UI that displays Strava data must show a "Powered by Strava" or "Compatible with Strava" badge.
4. Apply for production-tier access (default new apps are capped at 1 authenticated athlete). Submit screenshots of our connect UI, share-to-Strava UI, and link to our privacy policy. Approval is free but manual — budget 1-3 weeks of wait time. **Do this immediately after we have real users so the review process runs in parallel with everything else.**

### Out of scope
- **Auto-upload after every workout.** Manual one-tap only in this task. Auto-upload is a follow-up because it changes the consent / privacy story.
- **Reading activities back from Strava** (importing a user's existing Strava history into Gritty). Strava's data-storage rules get strict when you read activity data; out of scope.
- **Garmin Connect / Apple Health / Polar direct upload.** Out of scope — they still go through the Phase 1 share sheet.
- **Strava webhooks** (subscribe to athlete activity events). Useful for auto-import but not needed for one-way upload.
- **Disconnecting / token revocation flow beyond a Settings toggle.** Basic "Disconnect Strava" button only.

### Dependency
- None of the other open tasks block this. The only blocker is the Strava production-access approval (see above).
- Phase 1 (already shipped) provides the TCX builder we'll re-use for the upload body — no need to write a new exporter.

---

### Task 33.1: Backend — OAuth schema + Strava client

**Migration `0XX_strava_integration.sql`:**

```sql
CREATE TABLE strava_integrations (
    user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    strava_athlete_id BIGINT NOT NULL UNIQUE,                -- Strava's internal user id
    access_token      TEXT NOT NULL,                          -- short-lived (~6h)
    refresh_token     TEXT NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,
    scope             TEXT NOT NULL,                          -- comma-list, must contain 'activity:write'
    connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at      TIMESTAMPTZ
);
```

Tokens are stored at-rest in plaintext for v1 (same posture as our other secrets). If we ever add field-level encryption, this table is a candidate.

**`backend/internal/integrations/strava/client.go`** (new package):
- `ExchangeCode(code string) (TokenResponse, error)` — POST `https://www.strava.com/oauth/token` with `grant_type=authorization_code`.
- `RefreshToken(refresh string) (TokenResponse, error)` — POST same endpoint with `grant_type=refresh_token`. Called transparently when `expires_at` is within 5 minutes.
- `UploadActivity(token, tcxBytes []byte, name, activityType, externalID string) (uploadID int64, err error)` — multipart POST to `https://www.strava.com/api/v3/uploads` with `data_type=tcx`. Returns Strava's upload ID.
- `GetUploadStatus(token string, uploadID int64) (UploadStatus, error)` — GET `https://www.strava.com/api/v3/uploads/{id}` to poll until `status == "Your activity is ready."` or `error != null`.
- Standard `http.Client` with sane timeouts (10s connect, 30s read). No external dependency — `net/http` is enough.
- Centralised env-driven config: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (server-only, never sent to client).

---

### Task 33.2: Backend — connect / disconnect / upload endpoints

**`backend/internal/handlers/strava.go`** (new):

- `GET /api/v1/integrations/strava/authorize` — returns `{ url }` where `url` is the Strava authorize URL with `client_id`, `redirect_uri=grittyfitness://strava/callback`, `response_type=code`, `scope=activity:write`, `approval_prompt=auto`, and a random CSRF `state` value stored in `oauth_states` (short-lived in-memory or Redis if we add it later).
- `POST /api/v1/integrations/strava/callback` — body `{ code, state }`. Validates `state`, exchanges `code` for tokens via the Strava client, upserts a row in `strava_integrations`. Returns `{ status: 'connected' }`.
- `DELETE /api/v1/integrations/strava` — deletes the row + revokes the token at Strava (`POST https://www.strava.com/oauth/deauthorize`).
- `POST /api/v1/workouts/:id/share/strava` — body `{ activity_name?, description? }`. Loads the workout (ownership-checked), builds a TCX via the existing exporter logic (extracted from frontend to backend OR re-implemented; see Open Questions), refreshes the token if expired, POSTs to Strava `/uploads`, polls until `Your activity is ready.` or `error != null` (max 30s with backoff), returns `{ strava_activity_id, strava_url }` or `{ error }`.

**Rate limiting:** /api/v1/integrations/strava/* gets the existing per-IP limit + a per-user "max 5 uploads/min" cap to stay well clear of Strava's 200/15min ceiling.

**No PII in logs:** redact `access_token` / `refresh_token` in all log lines.

---

### Task 33.3: Backend — TCX builder (server-side)

**Critical decision:** the existing TCX builder lives in `frontend/src/services/workoutExport.ts`. The backend upload endpoint needs to produce the same TCX server-side because we can't trust the client to upload a tampered file under another user's name.

Port the TCX-building logic to `backend/internal/services/workout_export.go`. The Go version operates directly on the `Workout` struct (already has `GPSRoute json.RawMessage`, `HeartRateData json.RawMessage`, etc.) — no need to round-trip through the client.

Cover the same cases the frontend version covers:
- GPS workouts with HR + cadence
- GPS-only workouts
- HR-only workouts (TCX without `<Position>`)
- Multi-lap workouts (`gps_route.laps` → one `<Lap>` per recorded lap)
- Single-lap fallback

Mirror the test cases from `frontend/src/__tests__/workoutExport.test.ts` in Go. Both implementations stay aligned via shared test fixtures (small JSON files with example workouts + expected TCX snippets in `backend/internal/services/testdata/`).

---

### Task 33.4: Frontend — Settings "Connect Strava" row

**`frontend/src/screens/SettingsScreen.tsx`** (modify):
- Add an "Integrations" section above the existing AI / Account sections.
- Row: "Strava" with status text — "Not connected" / "Connected as &lt;athlete first name&gt;" — and the official orange "Connect with Strava" button (asset from Strava's brand kit, bundled in `frontend/assets/strava/`). For the disconnected state.
- For the connected state: same row shows "Connected as &lt;name&gt;" + a small "Disconnect" link.

**Connect flow:**
1. Tap "Connect with Strava" → call `GET /api/v1/integrations/strava/authorize` → open the returned URL in an in-app browser (`expo-web-browser`'s `openAuthSessionAsync`).
2. Strava redirects back to `grittyfitness://strava/callback?code=...&state=...`.
3. App deep-link handler parses the params, POSTs to `/callback`, updates the user state to show "Connected as …".

**Disconnect flow:**
1. Tap "Disconnect" → confirm modal ("Disconnect Strava? Your workouts will stop syncing.") → `DELETE /integrations/strava` → row reverts to "Not connected."

Requires:
- `expo-web-browser` (`npx expo install expo-web-browser`)
- Add `grittyfitness://` URL scheme to `frontend/app.json` if not already declared, register `strava/callback` in the deep-link router.

---

### Task 33.5: Frontend — "Share to Strava" button on WorkoutDetailScreen

**`frontend/src/screens/WorkoutDetailScreen.tsx`** (modify):
- Above the existing "Share Workout" button (which opens the format chooser sheet from Phase 1), add a primary-styled **Share to Strava** button — ONLY shown when:
  - The workout can be exported (`canExportWorkout(workout)`), AND
  - The user has a Strava integration (`user.strava_connected === true`, exposed via `/users/me`).
- Tapping it shows a small bottom sheet with:
  - Editable activity name (default: `<Sport> on <Date>`).
  - Optional description.
  - "Upload" + "Cancel".
- On Upload: POST `/api/v1/workouts/:id/share/strava`. Show an inline progress indicator. On success: toast "Uploaded to Strava" + a "View on Strava" deep link to the `strava_url`. On failure: alert with the error from Strava ("Duplicate of activity X", "Invalid file", etc.).

**Branding compliance:** the button uses Strava orange (#FC4C02) and the "Compatible with Strava" badge appears in the bottom sheet header.

If the user hasn't connected Strava yet, the existing "Share Workout" button (Phase 1 file export) covers the gap. No need to surface "Connect Strava" from the workout detail screen — keep that flow in Settings.

---

### Task 33.6: Frontend — expose `strava_connected` in user payload

**`backend/internal/handlers/user.go`** (modify):
- `GET /users/me` response gains a boolean `strava_connected` (true if a `strava_integrations` row exists). Don't expose the athlete ID, tokens, or scope to the client.

**`frontend/src/services/api.ts`** + `AuthContext` (modify):
- Add `strava_connected: boolean` to the `User` type.
- After connect/disconnect flows, refetch `/users/me` to update the cached value.

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `db/migrations/0XX_strava_integration.sql` | Create |
| `backend/internal/integrations/strava/client.go` | Create — token exchange/refresh, upload, status poll |
| `backend/internal/handlers/strava.go` | Create — connect/callback/disconnect/upload handlers |
| `backend/internal/services/workout_export.go` | Create — Go port of `frontend/src/services/workoutExport.ts` TCX builder |
| `backend/internal/services/testdata/*.json` | Create — shared fixtures for FE+BE TCX parity |
| `backend/internal/handlers/user.go` | Modify — include `strava_connected` in `/users/me` |
| `backend/main.go` | Modify — register `/api/v1/integrations/strava/*` and `/workouts/:id/share/strava` routes |
| `backend/.env.example` | Modify — add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` |
| `frontend/src/screens/SettingsScreen.tsx` | Modify — add Integrations section + Connect/Disconnect Strava |
| `frontend/src/screens/WorkoutDetailScreen.tsx` | Modify — add "Share to Strava" button + upload sheet |
| `frontend/src/services/api.ts` | Modify — `getStravaAuthURL`, `submitStravaCallback`, `disconnectStrava`, `shareToStrava`, `strava_connected` on User |
| `frontend/src/contexts/AuthContext.tsx` | Modify — refresh user on connect/disconnect |
| `frontend/app.json` | Modify — register deep-link `grittyfitness://strava/callback` (if not already) |
| `frontend/assets/strava/btn_strava_connect_with_orange@2x.png` | Add — official asset from Strava brand kit |
| `frontend/src/navigation/...` (deep-link handler) | Modify — parse `strava/callback`, route to Settings |

---

### How to Test

1. **OAuth happy path:** in Settings, tap Connect with Strava → in-app browser opens Strava authorize page → approve → redirected back via `grittyfitness://strava/callback` → row inserted in `strava_integrations`, Settings shows "Connected as <name>".
2. **CSRF state mismatch:** craft a callback request with a wrong `state` → backend returns 400, no row inserted.
3. **Token refresh:** manually expire `expires_at` in DB → trigger an upload → backend refreshes silently before uploading.
4. **Upload happy path:** complete a GPS run → on WorkoutDetailScreen tap Share to Strava → enter a name → upload → poll succeeds → toast appears with View on Strava link → activity visible on the user's Strava profile.
5. **HR-only upload:** record a strength workout with an HR sensor → upload → succeeds (TCX without Position) → Strava shows it as "Workout" with HR chart.
6. **Duplicate detection:** upload the same workout twice → second attempt returns Strava's `Duplicate of activity ID xxx` error → frontend shows it cleanly without retrying.
7. **Disconnect:** Settings → Disconnect → row deleted + Strava token revoked → subsequent upload attempts fail with `not_connected` error → "Share to Strava" button hides until reconnect.
8. **Per-user rate limit:** trigger 6 uploads in 60s → 6th returns 429.
9. **Token redaction in logs:** trigger connect + upload, grep logs for the access/refresh token strings → not present.
10. **Ownership check:** user A attempts `POST /workouts/<userBWorkoutId>/share/strava` → 404 (don't reveal existence).
11. **TCX parity:** for the same workout JSON, frontend `buildTCX` and backend `buildTCX` produce byte-identical output (run the shared fixtures through both).
12. **Lint + tests:** `golangci-lint run`, new Go handler/integration tests, `npx eslint .` + `npm test` in `frontend/`.
13. **Branding check:** screenshots of Settings + Share sheet pass Strava's brand guideline review (orange button, official badge, no off-brand colors on Strava elements).

---

### Open Questions

- **Server-side TCX builder vs trusted client upload:** porting the TCX builder to Go is correct for security (don't trust the client to upload a file under another user's name). But it doubles the maintenance surface. Alternative: keep TCX generation client-side, have the client POST the TCX bytes to our backend, our backend verifies the workout ID belongs to the user, then forwards to Strava. Less code but adds an attack surface (client could send arbitrary content). Recommend the server-side build approach — confirm with user before coding.
- **Activity name default:** "<Sport> on <Date>" or use the user's workout notes if present? Strava's default is "<Time of day> <Sport>" (e.g., "Morning Run"). Match Strava's convention.
- **Activity type mapping for Strava:** Strava has its own taxonomy (Run, TrailRun, Ride, VirtualRide, Swim, etc.) that's richer than our internal types. Map `run` → `Run`, `cycling` → `Ride`, `swim` → `Swim`, `strength` → `WeightTraining`, others → `Workout`. The TCX `Sport` attribute is ignored by Strava in favor of the per-upload type — pass the explicit type as a form field on `/uploads`.
- **Description content:** include the AI review summary from `progress/post-workout-review-ux.md` as the description? Could be a nice touch (Strava users get a paragraph of analysis automatically), but might feel intrusive. Default to empty, let the user opt in via a checkbox.
- **Auto-upload toggle (future task, not this one):** once manual upload works, add a Settings toggle "Auto-share completed workouts to Strava." Trigger from the same place as auto-reviews. Out of scope for v1.
- **Brand-kit asset:** download once from Strava's brand kit, bundle in repo. Re-check yearly for guideline changes.
- **Production access timing:** apply on the same day this task starts so the manual review runs in parallel. Single-athlete-only dev mode is fine for end-to-end testing on the developer's own Strava account.

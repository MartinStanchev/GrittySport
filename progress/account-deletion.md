# Account Deletion (GDPR Art. 17)

Self-service account deletion in Settings. All user-scoped data is purged via FK cascade from `users.id`. The one exception is `user_consents`: rows survive but are anonymized (user_id NULL via `ON DELETE SET NULL`, ip_address and user_agent cleared in the same transaction) so we keep aggregate proof of consent under GDPR Art. 7(1) without retaining personal identifiers.

## UX

Settings → bottom of the screen, below "Log Out" → a `Delete Account` button outlined in `colors.error`.

Tap opens a custom modal (not `Alert.alert` — we need a `TextInput`):
- Warning icon + headline.
- Bullet list of what gets removed (profile/settings, programs, workouts, chat + memory, devices/notifications).
- TextInput; "Delete forever" button stays disabled until input.trim().toLowerCase() === "delete".
- On confirm: spinner; on success the auth state flips to logged-out and `App.tsx` routes back to the auth stack.

## Flow

1. Frontend calls `DELETE /api/v1/users/me`.
2. Backend opens a transaction:
   - `UPDATE user_consents SET ip_address = NULL, user_agent = NULL WHERE user_id = $1`
   - `DELETE FROM users WHERE id = $1` — FK cascades wipe programs, workouts, chat_messages, chat_segments, chat_facts, refresh_tokens, push_tokens, notification_preferences, usage_tracking, auth_identities. The same DELETE causes Postgres to NULL the consent rows' `user_id` via the new `ON DELETE SET NULL`.
3. Returns 204.
4. Frontend clears tokens (SecureStore / localStorage), wipes the offline cache (cache_kv + pending_workouts on native; all `gritty:cache:*` keys on web), and sets the auth user to null.

## Why anonymize rather than purge consents

Under GDPR Art. 7(1) the controller carries the burden of proving consent was given. If a former user later complains they never consented to marketing, we need *some* record. Keeping `consent_type`, `version`, `accepted_at` (and `withdrawn_at` if applicable) without `user_id` / `ip_address` / `user_agent` gives us aggregate proof without retaining personal data — the standard middle path between "right to erasure" and "burden of proof."

## Schema (migration 025)

```sql
ALTER TABLE user_consents ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE user_consents DROP CONSTRAINT user_consents_user_id_fkey;
ALTER TABLE user_consents
    ADD CONSTRAINT user_consents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

The existing `idx_user_consents_user_type` index works fine with NULLs.

## Key files

**Backend**
- `db/migrations/025_account_deletion.sql`
- `backend/internal/services/user.go` — `UserService.Delete` (txn: anonymize consents → DELETE user → cascade).
- `backend/internal/handlers/user.go` — `UserHandler.DeleteMe` returns 204; `pgx.ErrNoRows` → 404; logs the deletion event.
- `backend/main.go` — `r.Delete("/users/me", userHandler.DeleteMe)`.
- `backend/internal/services/user_test.go` — verifies ErrNoRows for missing user, cascade of refresh_tokens, and consent anonymization (5 rows survive with NULL user_id/IP/UA, type+version preserved).

**Frontend**
- `frontend/src/components/DeleteAccountModal.tsx` — typed-confirmation modal, themed with `colors.error`.
- `frontend/src/screens/SettingsScreen.tsx` — "Delete Account" button below Logout, opens the modal.
- `frontend/src/contexts/AuthContext.tsx` — `deleteAccount()` method exposed via context; calls API, clears tokens, clears all offline data, sets user null.
- `frontend/src/services/api.ts` — `deleteMe()`.
- `frontend/src/services/offlineStorage.{native,web,ts}.ts` — new `clearAllLocalData()` helper (drops cache_kv + pending_workouts on native; clears all `gritty:cache:*` keys on web).

## Notes

- No server-side session table — JWTs are stateless and refresh_tokens cascade-delete with the user, so existing tokens become unusable the moment the user row is gone.
- Logging only the userID + a single "account deleted" line. No separate audit table; the surviving anonymized consent rows + the log line are sufficient.
- This addresses one of the open follow-ups from the signup-consent-flow task.

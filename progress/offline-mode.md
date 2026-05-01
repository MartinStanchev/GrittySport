# Offline Mode (Task 15.1 + 15.3 polish)

Cold-start of the app required network: a single `getMe()` failure on launch
left `user = null` and bounced the user to the login screen, even though their
tokens were still valid in SecureStore. Mid-session network blips during
`/api/auth/refresh` had the same effect because the refresh path treated
"unreachable" the same as "rejected". This change keeps the user signed in,
shows cached program data, and surfaces a small offline banner.

## What changed

**SQLite key-value cache (`cache_kv`)**
- Added a second table to the existing `gritty.db` (alongside `pending_workouts`).
- Helpers `setCached<T>` / `getCached<T>` / `clearCached` in
  `frontend/src/services/offlineStorage.native.ts`.
- Web variant uses `localStorage` with a `gritty:cache:` prefix so the same API
  works in dev/web. The neutral `.ts` fallback returns no-ops.

**Auth refresh no longer logs the user out on network errors**
- `attemptRefresh()` now throws on network errors and only returns `false` for
  explicit server rejections.
- `getValidAccessToken()` and the 401-retry block in `apiFetch` catch network
  errors separately and leave tokens intact.
- `AuthContext.checkAuthState` falls back to a cached `UserResponse` only when
  tokens are still on disk (a missing token still means the user is genuinely
  signed out — fresh install or rejected refresh).

**Active program + upcoming activities cached for offline reads**
- `ProgramContext.refreshProgram` / `refreshUpcoming` write to cache on success.
- On a network failure (distinguished from `ApiError` / `AuthError`) they
  restore the cached snapshot instead of clearing state.

**Offline banner**
- New `useNetworkStatus` hook subscribes to `@react-native-community/netinfo`.
- `OfflineBanner` (warning-coloured strip) renders above the bottom-tab
  navigator in `App.tsx` whenever `isConnected` is false.

## Out of scope (intentionally)

- Skeleton loaders (Task 15.4): existing `ActivityIndicator`s and inline
  loading are sufficient; replacing with shimmer skeletons is significant churn
  for marginal polish.
- `expo-splash-screen` programmatic hold (Task 15.5): current splash + font
  bootstrap doesn't visibly flash, so no extra dependency was added.
- Permission-denial screens (Task 15.3): GPS / HealthKit / BLE flows already
  degrade gracefully; revisit when there's a concrete UX complaint.
- Task 15.2 (chat unread badge) was already implemented end-to-end via
  `useChatWebSocket` → `ProgramContext.chatUnreadCount` → bottom-tab badge.

## Files changed

- `frontend/src/services/offlineStorage.native.ts` — `cache_kv` table + helpers
- `frontend/src/services/offlineStorage.web.ts` — `localStorage`-backed helpers
- `frontend/src/services/offlineStorage.ts` — neutral no-op stubs
- `frontend/src/services/api.ts` — refresh path distinguishes network vs auth
- `frontend/src/contexts/AuthContext.tsx` — cache write on fetch / cache fall back on offline boot
- `frontend/src/contexts/ProgramContext.tsx` — same pattern for program + upcoming
- `frontend/src/hooks/useNetworkStatus.ts` — new
- `frontend/src/components/OfflineBanner.tsx` — new
- `frontend/App.tsx` — mount `OfflineBanner` above the tab navigator

## How to test

1. Launch the app online, let the home screen populate, then enable airplane
   mode and force-quit + relaunch. The home screen should still render the
   active program and upcoming activities; the offline banner should appear.
2. While signed in, toggle airplane mode mid-session. No spurious logout; UI
   stays put. Disable airplane mode, take any action, requests resume.
3. Sign out (online) → cache is cleared. Re-launching offline shows the auth
   stack as expected.

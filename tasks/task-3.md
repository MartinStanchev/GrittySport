## Feature 3: Minimal User Profile and Settings

### Goal
After registration, users go straight to the main tab navigator — no profile setup screen, no onboarding gate. The users table only stores truly user-level preferences (timezone, units). Sport-specific data (experience, equipment, goals) is stored as program criteria tied to each program (see Task 5).

### Task 3.1: Database Migration — Extend Users (Minimal)
- Create migration `003_extend_users_minimal.sql`:
  ```sql
  ALTER TABLE users
    ADD COLUMN timezone VARCHAR(100),
    ADD COLUMN units_preference VARCHAR(10) NOT NULL DEFAULT 'metric';
  ```
- No sport, experience_level, training_days_per_week, equipment, injuries, goal, event_date, or profile_complete fields. Those belong to program criteria.

### Task 3.2: Backend — User Model Updates
- Update `/backend/internal/models/user.go`:
  - Add `Timezone *string` and `UnitsPreference string` fields to `User` struct
  - Add these fields to `UserResponse` struct
- Update any existing queries that SELECT from the users table to include the new columns

### Task 3.3: Backend — User Profile Endpoints
- Create `/backend/internal/handlers/user.go` and `/backend/internal/services/user.go`
- Implement `GET /api/v1/users/me`:
  - Returns the authenticated user's data: `{ "id", "email", "name", "timezone", "units_preference" }`
- Implement `PUT /api/v1/users/me`:
  - Accepts partial updates for `name`, `timezone`, `units_preference`
  - Returns the updated user object
- Register routes in `backend/main.go` under the existing `/api/v1` protected group

### Task 3.4: Frontend — AuthContext Updates
- Expand the `User` interface in `AuthContext.tsx` to include `timezone` and `units_preference`
- After login/register, call `GET /api/v1/users/me` to populate the full user object in context
- On first login, auto-detect timezone from device using `Intl.DateTimeFormat().resolvedOptions().timeZone` and send it via `PUT /api/v1/users/me` if not already set

### Task 3.5: Frontend — Settings Screen
- Replace the placeholder `SettingsScreen` with a real one:
  - **Account section**: Display email (read-only), editable name field
  - **Preferences section**: Units toggle (Metric / Imperial), timezone (auto-detected, with option to change)
  - **Save button**: Calls `PUT /api/v1/users/me`
  - **Log Out button**: Existing `signOut()` behavior from AuthContext
- No "Edit Profile" screen for sport/fitness data — that lives in program criteria (Task 5)

### Navigation Flow
- No change to `App.tsx`. The existing two-state flow remains:
  - Not authenticated → AuthStack
  - Authenticated → BottomTabNavigator
- No third state. No `profile_complete` gate.

### How to Test
- Register a new account — after registration you land directly on the Home tab (no profile setup screen)
- Go to Settings — you see your name, email, units toggle, timezone, and log out button
- Change units to Imperial, save — setting persists after app restart
- Log out, log back in — you go directly to tabs

---

## Feature 3: User Profile and Onboarding

### Goal
After registration (or for existing users with incomplete profiles), the app shows a profile setup flow. The profile data is needed before Grit can create a program. Users can also edit their profile from Settings later.

### Task 3.1: Database Migration — Extend Users Table
- Create migration `002_extend_users_profile.sql`:
  ```sql
  ALTER TABLE users
    ADD COLUMN sport VARCHAR(255),
    ADD COLUMN experience_level VARCHAR(50),
    ADD COLUMN training_days_per_week INTEGER,
    ADD COLUMN hours_per_session NUMERIC(3,1),
    ADD COLUMN equipment_access TEXT,
    ADD COLUMN injuries TEXT,
    ADD COLUMN goal TEXT,
    ADD COLUMN event_date DATE,
    ADD COLUMN timezone VARCHAR(100),
    ADD COLUMN units_preference VARCHAR(10) DEFAULT 'metric',
    ADD COLUMN profile_complete BOOLEAN DEFAULT FALSE;
  ```

### Task 3.2: Profile API Endpoints
- Implement `GET /api/users/me`:
  - Returns the full user object (all profile fields) for the authenticated user
  - Response: `{ "id", "email", "name", "sport", "experience_level", "training_days_per_week", "hours_per_session", "equipment_access", "injuries", "goal", "event_date", "timezone", "units_preference", "profile_complete" }`
- Implement `PUT /api/users/me`:
  - Accepts partial updates — only the fields present in the request body are updated
  - If all required profile fields are now non-null (`sport`, `experience_level`, `training_days_per_week`, `hours_per_session`, `goal`), set `profile_complete = TRUE`
  - Return the updated full user object

### Task 3.3: Profile Setup Screen
- This screen is **not** part of the tab navigator. It is shown after login/registration if `profile_complete` is `false`.
- The screen is a single scrollable form with the following fields:
  - **Sport / Fitness Focus** — text input, placeholder "e.g., Running, Swimming, Powerlifting, General Fitness"
  - **Experience Level** — picker/segmented control with options: Beginner, Intermediate, Advanced, Elite
  - **Training Days per Week** — numeric stepper, range 1–7
  - **Hours per Session** — numeric stepper, range 0.5–4.0, step 0.5
  - **Equipment Access** — text input, placeholder "e.g., Full gym, Home dumbbells only, Pool access"
  - **Injuries / Limitations** — text input (optional), placeholder "e.g., Recovering from knee surgery, none"
  - **Primary Goal** — text input, placeholder "e.g., Run a sub-25 min 5K, Squat 150 kg"
  - **Target Event Date** — date picker (optional), label "Training for a specific date?"
  - **Units** — segmented control: Metric / Imperial
  - **Timezone** — auto-detected from device using `Intl.DateTimeFormat().resolvedOptions().timeZone`, shown as read-only text with a "Change" option
- "Save Profile" button at bottom calls `PUT /api/users/me` with all fields
- On success, navigate to the main tab navigator

### Task 3.4: Navigation Flow Update
- Update `App.tsx` to add a third state: authenticated but profile incomplete
- Flow: Splash → (not authenticated → Auth Stack) | (authenticated, profile incomplete → Profile Setup Screen) | (authenticated, profile complete → Tab Navigator)
- After the user completes the profile, `AuthContext` updates the user state and the navigation switches to the Tab Navigator
- Store the user object (including `profile_complete`) in the AuthContext so it's accessible everywhere

### Task 3.5: Edit Profile from Settings
- Replace the Settings placeholder with a real `SettingsScreen` that has the following sections:
  - **Profile** — tapping opens an `EditProfileScreen` which is identical to the Profile Setup Screen but pre-filled with current values. Save calls `PUT /api/users/me`.
  - **Log Out** — button that calls `signOut()` from AuthContext
- `EditProfileScreen` reuses the same form component as Profile Setup but with a different title ("Edit Profile" vs "Complete Your Profile")

### How to Test
- Register a new account — after registration you see the Profile Setup screen (not the tabs)
- Fill in all required fields, tap Save — you land on the Home tab
- Go to Settings → Profile → change your sport → Save — returns to Settings
- Log out, log back in — you go directly to tabs (profile is already complete)

---
## Feature 8: Activity Recording — Manual Logging

### Goal
Users can record gym-based workouts (strength training, mobility, drills) by logging their actual performance against the prescription. No GPS yet — that's Feature 9.

### Task 8.1: Database Migration — Workouts Table
- Create migration `006_create_workouts.sql`:
  ```sql
  CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_activity_id UUID REFERENCES scheduled_activities(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL,
    recorded_data JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'gps', 'garmin', 'apple_health')),
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    gps_route JSONB,
    heart_rate_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_workouts_user_id ON workouts(user_id);
  CREATE INDEX idx_workouts_scheduled_activity ON workouts(scheduled_activity_id);
  CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at);
  ```

### Task 8.2: Workout API Endpoints
- Implement `POST /api/workouts`:
  - Request body: `{ "scheduled_activity_id": "uuid (optional)", "activity_type": "string", "recorded_data": {}, "source": "manual|gps", "started_at": "iso8601", "finished_at": "iso8601", "notes": "string (optional)" }`
  - Saves to `workouts` table
  - Returns `201` with the saved workout including ID
  - Triggers post-workout review (Task 8.4 placeholder — full implementation in Feature 11)
- Implement `GET /api/workouts`:
  - Query params: `limit` (default 20), `offset`, `activity_type` (optional), `from` date (optional), `to` date (optional)
  - Returns paginated list ordered by `started_at` desc
- Implement `GET /api/workouts/:id`:
  - Returns full workout detail including `recorded_data`, `gps_route`, `heart_rate_data`

### Task 8.3: Manual Recording Screen
- Create `RecordManualScreen` at `/src/screens/RecordManualScreen.tsx`:
  - Receives optional `scheduled_activity_id` as a navigation parameter
  - If linked to a scheduled activity: fetch the activity and pre-fill the form with the prescribed exercises/values as placeholders. Show the prescription in a "Target" column alongside the "Actual" input column.
  - If no scheduled activity (unscheduled workout): show a type picker (Strength Training, Mobility/Recovery, Sport-Specific Drill) and blank form
  - **Strength Training form**:
    - List of exercises. Each exercise has:
      - Exercise name (pre-filled from prescription, editable)
      - For each set: a row with Reps input (number), Weight input (number with unit kg/lb), RPE selector (1-10), and a checkmark to mark set complete
      - "Add Set" button per exercise
      - "Add Exercise" button at the bottom
    - A running timer displayed at the top showing total elapsed time since the user tapped "Start Workout"
    - A rest timer: tapping "Rest" starts a countdown (default from prescription rest_seconds, editable)
  - **Mobility/Recovery form**:
    - List of exercises with a timer for each (pre-filled duration from prescription)
    - User taps "Start" on each exercise timer, it counts down
    - Checkbox to mark each exercise complete
  - **Sport-Specific Drill form**:
    - Drill name and description displayed
    - Duration timer
    - Free-text notes field for the user to log what they did
  - "Finish Workout" button:
    - Sets `finished_at` to current time
    - Shows a summary screen with all logged data
    - "Save" button calls `POST /api/workouts`
    - "Discard" button discards without saving (with confirmation dialog)

### Task 8.4: Navigate to Recording from Home and Activity Detail
- On Home screen upcoming activity cards, the "Record" button:
  - If activity type is strength, mobility, or drill → navigate to `RecordManualScreen` with the `scheduled_activity_id`
  - If activity type involves GPS (run, cycling, swim outdoors) → navigate to `RecordGPSScreen` (implemented in Feature 9; show a "Coming soon" placeholder for now)
- On Activity Detail screen, the "Record This Activity" button works the same way
- Add a floating action button (FAB) on the Home screen: "+" icon that shows options "Record Activity" (manual) and "Import Activity" (placeholder for Feature 10)

### How to Test
- Open an upcoming strength training activity from Home — tap "Record"
- You see the manual recording screen with prescribed exercises pre-filled
- Start the workout timer, log sets with actual weights and reps
- Use the rest timer between sets
- Tap "Finish Workout" — see summary
- Tap "Save" — workout is saved, you return to Home
- Check that the workout appears in the History tab (basic list for now, polished in Feature 12)

---
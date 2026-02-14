## Feature 10: Wearable Import (Garmin + Apple Health)

### Goal
Users can import workouts from Garmin Connect (via webhook) and Apple Health (via on-device read). Imported workouts are mapped to scheduled activities.

### Task 10.1: Garmin Integration — Backend
- Create migration `007_create_garmin_connections.sql`:
  ```sql
  CREATE TABLE garmin_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    oauth_token TEXT NOT NULL,
    oauth_token_secret TEXT NOT NULL,
    garmin_user_id VARCHAR(255),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX idx_garmin_connections_user ON garmin_connections(user_id);
  ```
- Implement Garmin OAuth 1.0a flow (Garmin uses OAuth 1.0a, not 2.0):
  - `GET /api/garmin/auth` — generates a request token, stores it temporarily, and returns the Garmin authorization URL for the client to open in a browser
  - `GET /api/garmin/callback` — receives the OAuth verifier, exchanges for access token, stores in `garmin_connections`, and redirects to a deep link back into the app (`grittyfitness://garmin-connected`)
- Implement `POST /api/garmin/webhook`:
  - Garmin sends activity summary webhooks when users upload activities
  - Validate the request (Garmin does not sign webhooks in the same way; verify by checking the registered callback URL or use IP allowlisting)
  - Extract the Garmin user ID from the webhook payload
  - Look up the internal user via `garmin_connections`
  - Fetch the full activity detail from Garmin's API using the stored OAuth tokens
  - Store the raw Garmin data in a `garmin_pending_imports` table:
    ```sql
    CREATE TABLE garmin_pending_imports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      garmin_activity_id VARCHAR(255) NOT NULL,
      activity_data JSONB NOT NULL,
      imported BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
  - Send a push notification: "New activity detected from Garmin. Tap to import."

### Task 10.2: Garmin Connection in Settings
- In the Settings screen, add a "Connected Devices" section:
  - **Garmin**: shows "Not Connected" with a "Connect" button, or "Connected" with a "Disconnect" button
  - "Connect" opens the Garmin auth URL in an in-app browser (`expo-web-browser`)
  - Handle the deep link callback to close the browser and refresh connection status
  - "Disconnect" calls `DELETE /api/garmin/connection` which deletes the `garmin_connections` row and revokes the token

### Task 10.3: Apple Health Integration
- Install `react-native-health` (requires development build)
- Configure HealthKit entitlement in Xcode and add `NSHealthShareUsageDescription` in `app.json`
- Request read permissions for: `HKWorkoutType`, `HKQuantityTypeIdentifierHeartRate`, `HKSeriesType.workoutRoute`, `HKQuantityTypeIdentifierActiveEnergyBurned`
- In Settings → Connected Devices:
  - **Apple Health**: shows "Not Connected" with an "Enable" button, or "Enabled" with a status
  - Tapping "Enable" triggers the HealthKit permission request
  - Store the enabled state in `AsyncStorage` (Apple Health doesn't use OAuth)

### Task 10.4: Import Activity Screen
- Create `ImportActivityScreen` at `/src/screens/ImportActivityScreen.tsx`:
  - Two sections: "From Garmin" and "From Apple Health"
  - **Garmin section**:
    - If not connected: show "Connect Garmin in Settings"
    - If connected: call `GET /api/garmin/pending-imports` to list unimported activities
    - Each item shows: activity type, date, duration, distance
    - Tapping an item shows a detail view and a picker to map it to a scheduled activity (dropdown of upcoming scheduled activities with matching or compatible types) or "Log as Unscheduled"
    - "Import" button calls `POST /api/workouts/import` with the Garmin data and optional `scheduled_activity_id`
  - **Apple Health section**:
    - If not enabled: show "Enable Apple Health in Settings"
    - If enabled: query HealthKit for workouts in the last 7 days that haven't been imported (track imported HealthKit workout UUIDs in local SQLite)
    - Same mapping and import flow as Garmin
    - Apple Health data is read on-device and sent to the backend via `POST /api/workouts/import`
- Implement `POST /api/workouts/import`:
  - Request body: `{ "source": "garmin|apple_health", "scheduled_activity_id": "uuid (optional)", "activity_type": "string", "recorded_data": {}, "started_at": "iso8601", "finished_at": "iso8601", "gps_route": [] (optional), "heart_rate_data": [] (optional) }`
  - Saves as a workout with the specified source
  - If Garmin: marks the `garmin_pending_imports` row as `imported = true`
  - Triggers the post-workout review flow (Feature 11)

### How to Test
- Go to Settings → Connected Devices → Connect Garmin (requires a Garmin developer account and test device or simulator)
- Upload an activity to Garmin Connect → push notification arrives → open Import screen → see the activity → map to a scheduled session → import
- Go to Settings → Enable Apple Health → go to Import screen → see recent Apple Watch workouts → import one
- Imported workouts appear in History with their source badge (Garmin icon / Apple Health icon)

---
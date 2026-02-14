## Feature 9: Activity Recording — GPS Tracking

### Goal
Users can record GPS-based workouts (running, cycling) with live map, pace, distance, and optional heart rate from a BLE monitor. Offline recording works without internet.

### Task 9.1: GPS Recording Setup
- Install required packages:
  - `expo-location` for GPS
  - `react-native-maps` for live map display
  - `react-native-ble-plx` for Bluetooth Low Energy heart rate monitor connectivity (requires development build, not Expo Go)
- Configure `app.json` for location permissions:
  - `NSLocationWhenInUseUsageDescription`: "Gritty Fitness uses your location to track your workout route, distance, and pace."
  - `NSLocationAlwaysAndWhenInUseUsageDescription`: "Gritty Fitness uses background location to continue tracking your workout when the app is in the background."
  - Enable `UIBackgroundModes: ["location"]` for background GPS recording
- Switch from Expo Go to a development build (`npx expo prebuild`, then build with EAS or Xcode) since BLE requires native modules

### Task 9.2: GPS Recording Screen
- Create `RecordGPSScreen` at `/src/screens/RecordGPSScreen.tsx`:
  - Receives optional `scheduled_activity_id` as a navigation parameter
  - Top section: live map (MapView) showing the user's current position and drawn route polyline
  - Metrics panel below the map showing live data:
    - Current pace (min/km or min/mile based on user's unit preference)
    - Average pace
    - Distance covered (km or miles)
    - Elapsed time (HH:MM:SS)
    - Current heart rate (shown only if HR monitor connected, otherwise hidden)
    - Average heart rate
  - If linked to a scheduled activity: show the target metrics from the prescription above the actuals (e.g., "Target: 5:30/km | Current: 5:22/km")
  - Control buttons at the bottom:
    - Before start: "Start" button (large, green)
    - While recording: "Pause" and "Stop" buttons
    - While paused: "Resume" and "Stop" buttons
    - Tapping "Stop" shows a confirmation dialog, then navigates to the workout summary
- GPS data collection:
  - Request foreground location permission on screen mount. If recording in background, request always-on permission.
  - Use `expo-location` `watchPositionAsync` with `accuracy: Location.Accuracy.BestForNavigation` and `distanceInterval: 5` (meters) and `timeInterval: 1000` (ms)
  - Store each location update as: `{ lat, lng, altitude, timestamp, speed, accuracy }`
  - Filter out GPS points with accuracy > 30 meters
  - Calculate distance incrementally using the Haversine formula between consecutive points
  - Calculate current pace from the speed of the last 10 GPS points (rolling average)
- Heart rate (BLE):
  - On screen mount, scan for BLE devices advertising the Heart Rate Service (UUID `0x180D`)
  - If a device is found, show a "Connect HR Monitor" button. On tap, connect and subscribe to the Heart Rate Measurement characteristic (UUID `0x2A37`)
  - Parse the heart rate value from the BLE notification (handle both uint8 and uint16 formats per the BLE spec)
  - Store each HR reading with timestamp
  - If no BLE device is found or the user doesn't connect, HR fields are simply hidden

### Task 9.3: Local Storage for Offline Recording
- Install `react-native-sqlite-storage` or use `expo-sqlite`
- Create a local SQLite database with tables:
  ```sql
  CREATE TABLE pending_workouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scheduled_activity_id TEXT,
    activity_type TEXT NOT NULL,
    recorded_data TEXT NOT NULL,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    gps_route TEXT,
    heart_rate_data TEXT,
    notes TEXT,
    synced INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
  ```
  - All JSONB fields are stored as JSON strings in SQLite
- On "Save" from the workout summary:
  - Always save to local SQLite first
  - If internet is available (check with `@react-native-community/netinfo`), immediately upload via `POST /api/workouts`. On success, mark `synced = 1`.
  - If offline, save with `synced = 0`. Show a "Saved offline — will sync when connected" message.
- Create a sync service at `/src/services/syncService.ts`:
  - On app foreground and on network status change to "connected", query all `pending_workouts` where `synced = 0`
  - Upload each one via `POST /api/workouts`
  - On success, mark as synced
  - On failure, retry on next sync trigger

### Task 9.4: GPS Workout Summary Screen
- After tapping "Stop" on the GPS recording screen, navigate to a `WorkoutSummaryScreen`:
  - Shows a static map with the full route drawn
  - Summary metrics: total distance, total time, average pace, best pace (fastest km/mile split), elevation gain, average heart rate, max heart rate
  - If linked to a scheduled activity, show a comparison: Target vs Actual for distance and pace with green (met/exceeded) or red (below) indicators
  - Notes text input
  - "Save" and "Discard" buttons

### How to Test
- From Home, tap "Record" on an upcoming Run activity — GPS recording screen opens
- Tap "Start" — map shows your position, route draws as you move, metrics update live
- Walk/run for a bit — distance and pace update
- Tap "Pause" then "Resume" — timer pauses and resumes, no GPS points during pause
- Tap "Stop" — summary screen shows route map, distance, pace
- Save — workout is stored
- Turn on airplane mode, start a new GPS recording, finish and save — "Saved offline" message appears
- Turn off airplane mode — workout syncs automatically (verify via API or History)

---
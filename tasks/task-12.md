## Feature 12: History Screen

### Goal
A complete, filterable history of all workouts. Each entry links to a detail view.

### Task 12.1: History Screen Implementation
- Replace the History tab placeholder with the real `HistoryScreen`:
  - A `FlatList` showing all workouts ordered by `started_at` desc
  - Each row shows:
    - Date and day of week (e.g., "Mon, Feb 10")
    - Activity type icon and name
    - Key metrics: distance + pace (for cardio), total volume (for strength), duration (for all)
    - Source badge: small icon indicating manual, GPS, Garmin, or Apple Health
    - Completion status: green checkmark (completed and met targets), yellow warning (completed but below targets), red X (missed)
  - Pagination: load 20 workouts at a time, load more on scroll to bottom
  - Pull-to-refresh

### Task 12.2: History Filters
- A filter bar at the top of the History screen with:
  - **Activity Type**: horizontal scrollable chips — "All", "Run", "Strength", "Swim", "Cycling", "Drill", "Mobility", "Other". Tapping a chip filters the list.
  - **Date Range**: tapping a date range button opens a date range picker. Options: "This Week", "This Month", "Last 30 Days", "All Time", "Custom Range"
- Filters are applied as query params to `GET /api/workouts`

### Task 12.3: Workout Detail Screen
- Create `WorkoutDetailScreen` at `/src/screens/WorkoutDetailScreen.tsx`:
  - Shows all recorded data for a workout
  - If GPS data exists: map with the route drawn, splits table (per-km or per-mile)
  - If heart rate data exists: a simple heart rate chart (time on X axis, BPM on Y axis) using `react-native-chart-kit` or `victory-native`
  - If strength data: exercise list with all sets, reps, weight, RPE
  - If linked to a scheduled activity: a "Prescribed vs Actual" comparison section
  - Notes displayed at the bottom

### How to Test
- After recording several workouts (manual + GPS + imported), go to History tab
- See all workouts listed with correct icons, metrics, and source badges
- Tap a filter chip (e.g., "Run") — only runs are shown
- Select "This Week" date range — list narrows
- Tap a workout — full detail screen with map (if GPS), HR chart (if available), and all data

---
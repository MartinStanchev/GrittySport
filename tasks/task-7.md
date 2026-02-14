## Feature 7: Activity Detail and Manual Program Editing

### Goal
Users can view full details of any scheduled activity and manually edit prescription values in their program.

### Task 7.1: Activity Detail Screen
- Create `ActivityDetailScreen` at `/src/screens/ActivityDetailScreen.tsx`:
  - Receives `activity_id` as a navigation parameter
  - Calls `GET /api/activities/:id` to fetch the full scheduled activity
  - Displays:
    - Activity type with icon and name (e.g., "🏋️ Upper Body Strength")
    - Date and day of week
    - Phase and week context (e.g., "Base Building — Week 2")
    - Full prescription details, rendered based on activity type:
      - **Run**: Distance, target pace, heart rate zone, terrain
      - **Interval Run**: Warmup, interval table (distance, pace, rest), cooldown
      - **Strength Training**: Exercise list with sets × reps × weight, RPE, rest
      - **Swim**: Distance, stroke, pace, drills
      - **Cycling**: Distance, target power, duration, terrain
      - **Sport-Specific Drill**: Drill name, duration, description, focus area
      - **Mobility/Recovery**: Exercise list with durations
      - **Rest Day**: Simple "Rest Day" display
    - Notes field (if any)
    - Two action buttons at bottom: "Record This Activity" (navigates to Record screen) and "Edit" (enters edit mode)

### Task 7.2: Manual Activity Editing
- Implement `PUT /api/programs/:id/activities/:aid`:
  - Accepts a partial `prescription` JSON update and optional `notes`, `day_of_week`, `activity_type` changes
  - Validates that the activity belongs to the specified program and the program belongs to the authenticated user
  - Returns the updated activity
- In the Activity Detail screen, "Edit" mode:
  - The prescription fields become editable inputs (same types as the display but as form fields)
  - The user can change target values (pace, distance, weight, sets, reps, etc.)
  - The user can change the day of week
  - The user can add/edit notes
  - "Save" button commits changes via the API
  - "Cancel" button discards changes
- Show a confirmation dialog: "Editing this activity will override Grit's prescription. Grit will be informed of your changes. Continue?"

### Task 7.3: Inform Grit of Manual Edits
- When a manual edit is saved, the backend inserts a system message into `chat_messages`:
  - Role: `system`, context: `free_chat`
  - Content: "The user manually edited the activity '[activity_type]' on [date]. Changes: [diff description]. Take this into account in future conversations."
- This ensures Grit has awareness of manual changes in subsequent conversations without requiring an immediate chat interaction.

### How to Test
- From the Home screen, tap an upcoming activity card — see full activity details with specific prescriptions
- Tap "Edit" — fields become editable
- Change the target distance of a run from 5 km to 4 km — save
- Return to activity detail — it shows 4 km
- Open chat, ask Grit about today's run — Grit should acknowledge the edited values

---
## Feature 6: Program Creation

### Goal
Users can create a program through a guided chat with Grit. Grit asks the configurable intake questions, generates a program, and saves it. The program appears on the Home screen and the Programs List.

### Task 6.1: Database Migration — Intake Questions
- Create migration `005_create_intake_questions.sql`:
  ```sql
  CREATE TABLE intake_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('free_text', 'single_choice', 'numeric')),
    validation_rules JSONB,
    order_index INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- Seed the 8 default intake questions defined in the Design Document (Section 5.3) with appropriate `response_type` and `order_index` values.

### Task 6.2: Program Creation API Support
- Implement `GET /api/intake-questions`:
  - Returns all active intake questions ordered by `order_index`
  - Response: `{ "questions": [{ "id", "question_text", "response_type", "validation_rules", "order_index" }] }`
- Implement `GET /api/programs`:
  - Returns all programs for the authenticated user, ordered by `created_at` desc
  - Each program includes: `id`, `name`, `sport`, `goal_description`, `start_date`, `end_date`, `status`
- Implement `GET /api/programs/:id`:
  - Returns the full program including nested `phases` → `weeks` → `scheduled_activities`
- Implement `PUT /api/programs/:id`:
  - Allows updating `status` (to archive) or `name`
  - Enforce: only one program can have `status = 'active'` per user. If setting a program to active, archive the current active program.

### Task 6.3: Program Creation Chat Flow
- Update the system prompt construction for `program_creation` context:
  - Include the list of intake questions (fetched from DB) in the system prompt
  - Instruct Grit: "You are helping the user create a new training program. Ask the following questions one at a time, in order. After each answer, acknowledge it briefly and move to the next question. If an answer is vague, ask a natural follow-up to clarify. Once all questions are answered, use the generate_program tool to signal that you have all the information, then generate a detailed training program structure and present a summary to the user. When the user confirms, use the save_program tool to save it."
  - Include specific instructions for program generation: "When generating the program, create a realistic, periodized plan. Include specific prescriptions: exact distances and paces for runs, specific exercises with sets/reps/weights for strength work, drill descriptions for sport-specific sessions. The program should span 4–16 weeks depending on the user's goal and event date. Divide it into phases (e.g., Base, Build, Peak, Taper for endurance sports; Hypertrophy, Strength, Peaking for strength sports). Each week should have the exact number of training days the user specified."
  - Include the JSON schema that `save_program` expects so Grit produces valid program structures
- The `generate_program` MCP tool, when called, stores the intake answers in the user's chat metadata and returns a confirmation. Grit then generates the program inline as text first (for the user to review) and as a structured JSON for `save_program`.
- When `save_program` is called successfully, the Go backend:
  - Saves the program to DB
  - Returns the program with all generated IDs
  - Sends a WebSocket message: `{ "type": "program_created", "program_id": "uuid" }` so the client can update state

### Task 6.4: Program Creation Entry Point on Home Screen
- On the Home screen, when the user has no active program:
  - The top zone shows: "Welcome to Gritty Fitness" heading, "Let Grit build your personalized training program" subtitle, and a large "Create Your Program" button
  - Tapping the button opens the chat in full-screen mode with `context: "program_creation"`
  - The chat automatically sends a system-initiated first message from Grit (the Go backend sends an initial greeting when a `program_creation` context chat is started with no prior messages)
- When a program is created (client receives `program_created` WebSocket message):
  - Close the chat overlay
  - Refresh the Home screen to show the program summary in the top zone
  - Show a success toast: "Your program is ready!"

### Task 6.5: Home Screen — Active Program and Upcoming Activities
- When the user has an active program, the Home screen top zone shows:
  - Program name (e.g., "Marathon Training Plan")
  - Current phase name and progress (e.g., "Base Building — Week 3 of 4")
  - A progress bar showing overall program completion (weeks elapsed / total weeks)
- Implement `GET /api/activities/upcoming`:
  - Returns the next 5 scheduled activities from the active program based on current date
  - Each includes: `id`, `activity_type`, `day_of_week`, `prescription` summary, `week_number`, `phase_name`, the actual calendar date
- The middle zone shows the upcoming activities as cards:
  - Each card: activity type icon + name (e.g., "🏃 Easy Run"), date ("Mon, Mar 2"), key prescription summary ("5 km at 5:30/km"), and a "Record" button
  - Tapping the card navigates to the Activity Detail screen (implemented in Feature 7)
  - Tapping "Record" navigates to the Record Activity screen (implemented in Feature 8)

### Task 6.6: Programs List Screen
- Replace the Programs tab placeholder with the real `ProgramsListScreen`:
  - Lists all programs with the active one highlighted (green badge "ACTIVE")
  - Each item shows: program name, sport, date range, status
  - Tapping a program navigates to `ProgramDetailScreen`
  - A "Create New Program" button at the top starts a new program creation chat
  - Long-press or swipe on an inactive program to delete/archive it
  - Tapping "Set as Active" on an archived program reactivates it (archives the current active one)

### Task 6.7: Program Detail Screen
- Create `ProgramDetailScreen`:
  - Header: program name, sport, goal, date range
  - Body: collapsible sections for each phase. Each phase shows its weeks. Each week shows its scheduled activities.
  - Each activity row shows: day, activity type, and prescription summary
  - Tapping an activity opens the Activity Detail screen

### How to Test
- Open the app with a completed profile but no program — Home shows "Create Your Program"
- Tap it — chat opens, Grit greets you and asks the first intake question
- Answer all questions one by one — Grit asks follow-ups when needed
- Grit generates a program and presents a summary — you see tool call indicators for generate_program and save_program
- Confirm — program is saved, chat closes, Home now shows your program name, phase, and upcoming activities
- Go to Programs tab — your program is listed as Active
- Tap it — you see the full program detail with phases, weeks, and activities

---
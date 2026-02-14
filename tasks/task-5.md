## Feature 5: MCP Server, Programs, and Conversational Program Creation

### Goal
The Node.js MCP server runs with tool definitions. The Go backend acts as an MCP client and includes tool definitions in Gemini requests. Users create programs through a natural conversation with Grit, who asks contextually relevant questions, generates a periodized plan, and saves it along with the criteria gathered. Program criteria are visible, editable, and changes trigger Grit to suggest adjustments.

This task merges the original Task 5 (MCP infrastructure) and Task 6 (program creation) with the new program criteria concept replacing the old profile-based approach.

### Task 5.1: Database Migration — Programs, Criteria, and Related Tables
- Create migration `005_create_programs.sql`:
  ```sql
  CREATE TABLE programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      sport VARCHAR(255),
      goal_description TEXT,
      start_date DATE NOT NULL,
      end_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'archived', 'draft')),
      created_by VARCHAR(20) NOT NULL DEFAULT 'grit'
          CHECK (created_by IN ('grit', 'user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_programs_user_id ON programs(user_id);
  CREATE INDEX idx_programs_user_status ON programs(user_id, status);

  CREATE TABLE program_criteria (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      label VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      value_type VARCHAR(20) NOT NULL DEFAULT 'text'
          CHECK (value_type IN ('text', 'number', 'date', 'choice')),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(program_id, key)
  );

  CREATE INDEX idx_program_criteria_program_id ON program_criteria(program_id);

  CREATE TABLE phases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      order_index INTEGER NOT NULL,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_phases_program_id ON phases(program_id);

  CREATE TABLE weeks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      start_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_weeks_phase_id ON weeks(phase_id);

  CREATE TABLE scheduled_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      activity_type VARCHAR(50) NOT NULL,
      prescription JSONB NOT NULL DEFAULT '{}',
      notes TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_scheduled_activities_week_id ON scheduled_activities(week_id);
  ```

#### Program Criteria Design
- Uses a **key-value pattern** rather than fixed columns, so Grit can store whatever criteria are relevant for the sport
- Each criterion has a human-readable `label` for display (e.g., key=`experience_level`, label=`Experience Level`, value=`Intermediate`)
- `display_order` controls how criteria appear in the UI
- `UNIQUE(program_id, key)` prevents duplicate keys per program
- Standard criteria keys guided by the system prompt (not enforced in schema):
  - `sport` — Sport / Activity (e.g., "Swimming")
  - `experience_level` — Experience Level (e.g., "Intermediate")
  - `training_days_per_week` — Training Days / Week (e.g., "5")
  - `hours_per_session` — Hours per Session (e.g., "1.5")
  - `equipment_access` — Equipment Access (e.g., "Full gym, 50m pool")
  - `injuries` — Injuries / Limitations (e.g., "None")
  - `goal` — Primary Goal (e.g., "Qualify for nationals in 200m freestyle")
  - `event_date` — Target Event Date (e.g., "2026-07-15")
- Grit may add sport-specific criteria beyond these (e.g., `pool_length`, `current_5k_time`, `max_squat`)

### Task 5.2: MCP Server Init
- Create a `/mcp-server` directory at the project root
- Initialize a Node.js project with TypeScript: `npm init`, install `@modelcontextprotocol/sdk`, `pg` (node-postgres), `typescript`, `tsx`
- Create `src/index.ts` as the MCP server entry point:
  - Uses the MCP SDK `Server` class with `stdio` transport (the Go backend launches it as a subprocess)
  - Connects to PostgreSQL using the same `DATABASE_URL`
  - Registers the following tools (all with JSON Schema parameter definitions):
    1. **get_user_profile** — params: `{ user_id: string }` — queries `users` table, returns minimal profile JSON (name, email, timezone, units_preference)
    2. **get_active_program** — params: `{ user_id: string }` — queries `programs` joined with `phases`, `weeks`, `scheduled_activities`, and `program_criteria` where `status = 'active'`, returns full nested program JSON including criteria
    3. **get_program_criteria** — params: `{ program_id: string }` — queries `program_criteria` for a specific program, returns criteria array
    4. **save_program_with_criteria** — params: `{ user_id: string, program: object, criteria: array }` — inserts into `programs`, `phases`, `weeks`, `scheduled_activities`, and `program_criteria` in a transaction. Sets the program as active and archives any previously active program. Returns the saved program with IDs.
    5. **update_program_criteria** — params: `{ program_id: string, criteria: array }` — upserts criteria for a program (insert or update on conflict). Returns updated criteria.
    6. **adjust_program** — params: `{ user_id: string, adjustments: object }` — the `adjustments` object contains `activity_ids` (array of scheduled_activity IDs to modify) and updated `prescription` fields for each. Updates in a transaction. Returns updated activities.
    7. **get_activity_history** — params: `{ user_id: string, date_from?: string, date_to?: string, activity_type?: string }` — queries `workouts` with optional filters, returns array
    8. **get_scheduled_activity** — params: `{ activity_id: string }` — queries `scheduled_activities` joined with `weeks` and `phases` for context, returns full detail
  - Each tool handler executes the database operation and returns a JSON result
- Add the MCP server to `docker-compose.yml` as a service (or configure the Go backend to spawn it as a subprocess)
- Create a `Dockerfile` for the MCP server

### Task 5.3: Go MCP Client Integration
- Create `/internal/mcp/client.go`:
  - Launches the MCP server as a subprocess (using `exec.Command` with `node` or `tsx` to run the MCP server's entry point)
  - Communicates over stdin/stdout using the MCP protocol (JSON-RPC over stdio)
  - On startup: calls `tools/list` to fetch all available tool definitions and caches them
  - Exposes `GetToolDefinitions() []ToolDefinition` — returns the cached tool list in a format suitable for Gemini's tool/function calling feature
  - Exposes `CallTool(name string, params map[string]any) (string, error)` — sends a `tools/call` request to the MCP server and returns the result
- Update the Gemini integration in `/internal/ai/gemini.go`:
  - When constructing the Gemini request, include the tool definitions from the MCP client as Gemini function declarations
  - Handle Gemini's function call responses:
    1. When Gemini returns a function call instead of text, extract the tool name and parameters
    2. Send a WebSocket message to the client: `{ "type": "tool_call", "tool": "tool_name", "status": "calling" }`
    3. Call the tool via the MCP client
    4. Send: `{ "type": "tool_call", "tool": "tool_name", "status": "completed", "result_summary": "brief description" }`
    5. Feed the tool result back to Gemini as a function response and continue generation
    6. Repeat if Gemini calls another tool
  - Support up to 5 sequential tool calls in a single conversation turn (to prevent infinite loops)

### Task 5.4: Update Chat UI for Tool Calls
- In the chat view, when a `tool_call` message is received:
  - Show a subtle inline status indicator in the chat
  - Map tool names to human-readable descriptions:
    - `get_user_profile` → "Checking your info..."
    - `get_active_program` → "Looking at your program..."
    - `get_program_criteria` → "Reviewing your program settings..."
    - `save_program_with_criteria` → "Saving your program..."
    - `update_program_criteria` → "Updating your program settings..."
    - `adjust_program` → "Adjusting your program..."
    - `get_activity_history` → "Reviewing your workout history..."
    - `get_scheduled_activity` → "Checking your scheduled workout..."
  - When `status: "completed"`, replace the indicator with a brief completed status, then continue rendering streamed text

### Task 5.5: Program Creation Chat Flow
- Update the system prompt construction for `program_creation` context:
  - Instruct Grit:
    ```
    You are Grit, an AI fitness coach. You are helping the user create a new training program.

    Your job is to gather the information you need to build a great, personalized program. Here are the types of things you typically need to know:
    - What sport or activity they want to train for
    - Their experience level
    - How many days per week they can train
    - How long each session can be
    - What equipment they have access to (ask only if relevant to their sport)
    - Any injuries or limitations
    - Their primary goal
    - Whether they have a target event date

    However, DO NOT ask all of these as a rigid checklist. Have a natural conversation. Ask questions that are relevant based on what the user tells you. For example:
    - If they say "I want to get better at swimming", ask about pool access and whether they have equipment like a pull buoy, but don't ask about gym equipment unless they mention dryland training.
    - If they mention an upcoming race, ask about the date and their goal time.
    - If they say "general fitness", skip sport-specific questions and focus on preferences and goals.
    - If they go to a public gym, don't ask about equipment — assume standard gym access.

    After you have enough information, generate a realistic, periodized program. Include specific prescriptions: exact distances and paces for runs, specific exercises with sets/reps/weights for strength work, drill descriptions for sport-specific sessions. The program should span 4–16 weeks depending on the user's goal and event date. Divide it into phases (e.g., Base, Build, Peak, Taper for endurance; Hypertrophy, Strength, Peaking for strength sports). Each week should have the exact number of training days the user specified.

    Use the save_program_with_criteria tool to save both the program structure AND the criteria you gathered. Present a summary to the user after saving.

    The JSON schema for the program is:
    {program_json_schema}

    The criteria array should include each piece of information you gathered:
    {criteria_json_schema}
    ```
  - Include the user's name, timezone, and units preference from their profile
- When `save_program_with_criteria` is called successfully, the Go backend:
  - Saves the program, criteria, phases, weeks, and activities to DB
  - Returns the program with all generated IDs
  - Sends a WebSocket message: `{ "type": "program_created", "program_id": "uuid" }` so the client can update state

### Task 5.6: Program Creation Entry Point on Home Screen
- On the Home screen, when the user has no active program:
  - The top zone shows: "Welcome to Gritty Fitness" heading, "Let Grit build your personalized training program" subtitle, and a large "Create Your Program" button
  - Tapping the button opens the chat in full-screen mode with `context: "program_creation"`
  - The chat automatically sends a system-initiated first message from Grit: "Hey {name}! I'm excited to build a training program for you. What sport or activity are you looking to train for?"
- When a program is created (client receives `program_created` WebSocket message):
  - Close the chat overlay
  - Refresh the Home screen to show the program summary in the top zone
  - Show a success toast: "Your program is ready!"

### Task 5.7: Home Screen — Active Program and Upcoming Activities
- When the user has an active program, the Home screen top zone shows:
  - Program name (e.g., "Marathon Training Plan")
  - Current phase name and progress (e.g., "Base Building — Week 3 of 4")
  - A progress bar showing overall program completion (weeks elapsed / total weeks)
- Implement `GET /api/v1/activities/upcoming`:
  - Returns the next 5 scheduled activities from the active program based on current date
  - Each includes: `id`, `activity_type`, `day_of_week`, `prescription` summary, `week_number`, `phase_name`, the actual calendar date
- The middle zone shows the upcoming activities as cards:
  - Each card: activity type icon + name (e.g., "Easy Run"), date ("Mon, Mar 2"), key prescription summary ("5 km at 5:30/km"), and a "Record" button
  - Tapping the card navigates to the Activity Detail screen (implemented in a later task)
  - Tapping "Record" navigates to the Record Activity screen (implemented in a later task)

### Task 5.8: Program CRUD API Endpoints
- Create `/backend/internal/handlers/program.go` and `/backend/internal/services/program.go`:
- Implement `GET /api/v1/programs`:
  - Returns all programs for the authenticated user, ordered by `created_at` desc
  - Each program includes: `id`, `name`, `sport`, `goal_description`, `start_date`, `end_date`, `status`
- Implement `GET /api/v1/programs/:id`:
  - Returns the full program including nested `phases` → `weeks` → `scheduled_activities` AND `criteria`
- Implement `PUT /api/v1/programs/:id`:
  - Allows updating `status` (to archive) or `name`
  - Enforce: only one program can have `status = 'active'` per user. If setting a program to active, archive the current active program.
- Implement `GET /api/v1/programs/:id/criteria`:
  - Returns all criteria for the specified program
- Implement `PUT /api/v1/programs/:id/criteria`:
  - Accepts an array of criteria to upsert (insert or update on key conflict)
  - Returns updated criteria array

### Task 5.9: Programs List Screen
- Replace the Programs tab placeholder with the real `ProgramsListScreen`:
  - Lists all programs with the active one highlighted (green badge "ACTIVE")
  - Each item shows: program name, sport, date range, status
  - Tapping a program navigates to `ProgramDetailScreen`
  - A "Create New Program" button at the top starts a new program creation chat
  - Long-press or swipe on an inactive program to delete/archive it
  - Tapping "Set as Active" on an archived program reactivates it (archives the current active one)

### Task 5.10: Program Detail Screen
- Create `ProgramDetailScreen`:
  - Header: program name, sport, goal, date range
  - **Program Criteria Section**: Shows the criteria Grit used to build this program in a card layout. Each criterion displays its label and value. An "Edit Settings" button opens the criteria editor.
  - Body: collapsible sections for each phase. Each phase shows its weeks. Each week shows its scheduled activities.
  - Each activity row shows: day, activity type, and prescription summary
  - Tapping an activity opens the Activity Detail screen (implemented in a later task)

### Task 5.11: Edit Criteria → Grit Adjustment Flow
- When the user taps "Edit Settings" on the ProgramDetailScreen criteria section:
  1. A modal/screen shows all criteria as editable fields (text inputs, number inputs, date pickers based on `value_type`)
  2. User modifies one or more criteria and taps "Save & Update Program"
  3. Frontend calls `PUT /api/v1/programs/:id/criteria` to persist the changes
  4. Frontend then opens the chat overlay with `context: "criteria_edit"` and `program_id` set
  5. Backend detects the `criteria_edit` context and sends a Grit message acknowledging the changes
  6. Grit uses `get_active_program` and `get_program_criteria` to see the current state, then suggests adjustments
  7. If the user agrees, Grit calls `adjust_program` to modify the scheduled activities
- System prompt for `criteria_edit` context:
  ```
  You are Grit. The user has just edited their program criteria. The following criteria were changed:
  {changed_criteria_summary}

  Review the current program and suggest specific adjustments based on the changes. Be concise and actionable. If the changes are minor (e.g., a slight change in available hours), explain why the current program still works or suggest small tweaks. If significant changes are needed (e.g., different sport, major goal change), describe what you'd adjust and ask the user to confirm before making changes using the adjust_program tool.
  ```

### How to Test
- Open the app with a completed auth but no program — Home shows "Create Your Program"
- Tap it — chat opens, Grit greets you and asks what sport you want to train for
- Answer questions naturally — Grit asks follow-ups relevant to your sport (e.g., pool access for swimming, not for running)
- Grit generates a program and saves it — chat closes, Home now shows your program name, phase, and upcoming activities
- Go to Programs tab — your program is listed as Active
- Tap it — you see the full program detail with phases, weeks, activities, AND the criteria section showing what Grit asked
- Tap "Edit Settings" on criteria — change training days from 5 to 3 — save
- Chat opens, Grit acknowledges the change and suggests reducing weekly volume — confirm — program is adjusted

---

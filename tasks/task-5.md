## Feature 5: MCP Server and Grit's Tools

### Goal
The Node.js MCP server is running with all tool definitions. The Go backend acts as an MCP client and includes tool definitions in Gemini requests. Grit can call tools during conversations.

### Task 5.1: MCP Server Init
- Create a `/mcp-server` directory at the project root
- Initialize a Node.js project with TypeScript: `npm init`, install `@modelcontextprotocol/sdk`, `pg` (node-postgres), `typescript`, `tsx`
- Create `src/index.ts` as the MCP server entry point:
  - Uses the MCP SDK `Server` class with `stdio` transport (the Go backend launches it as a subprocess)
  - Connects to PostgreSQL using the same `DATABASE_URL`
  - Registers the following tools (all with JSON Schema parameter definitions):
    1. **get_user_profile** — params: `{ user_id: string }` — queries `users` table, returns full profile JSON
    2. **get_active_program** — params: `{ user_id: string }` — queries `programs` joined with `phases`, `weeks`, `scheduled_activities` where `status = 'active'`, returns full nested program JSON
    3. **get_activity_history** — params: `{ user_id: string, date_from?: string, date_to?: string, activity_type?: string }` — queries `workouts` with optional filters, returns array
    4. **generate_program** — params: `{ user_id: string, intake_answers: object }` — does NOT generate the program itself (Gemini does that); this tool returns a confirmation that the intake answers have been recorded, signaling Grit to now produce the program structure in its response
    5. **save_program** — params: `{ user_id: string, program: object }` — inserts into `programs`, `phases`, `weeks`, `scheduled_activities` in a transaction. Sets the program as active and archives any previously active program. Returns the saved program with IDs.
    6. **adjust_program** — params: `{ user_id: string, adjustments: object }` — the `adjustments` object contains: `activity_ids` (array of scheduled_activity IDs to modify), and for each, the updated `prescription` fields. Updates the specified activities in a transaction. Returns the updated activities.
    7. **get_scheduled_activity** — params: `{ activity_id: string }` — queries `scheduled_activities` joined with `weeks` and `phases` for context, returns full detail
    8. **get_workout_result** — params: `{ workout_id: string }` — queries `workouts`, returns full recorded data
    9. **update_user_profile** — params: `{ user_id: string, updates: object }` — updates specified fields on the `users` table, returns updated profile
  - Each tool handler executes the database operation and returns a JSON result
- Add the MCP server to `docker-compose.yml` as a service (or configure the Go backend to spawn it as a subprocess)
- Create a `Dockerfile` for the MCP server

### Task 5.2: Database Migration — Programs, Phases, Weeks, Activities
- Create migration `004_create_programs.sql`:
  ```sql
  CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sport VARCHAR(255),
    goal_description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by VARCHAR(20) NOT NULL DEFAULT 'grit' CHECK (created_by IN ('grit', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_programs_user_id ON programs(user_id);
  CREATE INDEX idx_programs_user_status ON programs(user_id, status);

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
  - Show a subtle inline status indicator in the chat: "🔧 Looking up your profile..." / "🔧 Saving your program..." etc.
  - Map tool names to human-readable descriptions:
    - `get_user_profile` → "Checking your profile..."
    - `get_active_program` → "Looking at your program..."
    - `get_activity_history` → "Reviewing your workout history..."
    - `generate_program` → "Recording your preferences..."
    - `save_program` → "Saving your program..."
    - `adjust_program` → "Updating your program..."
    - `get_scheduled_activity` → "Checking your scheduled workout..."
    - `get_workout_result` → "Reviewing your workout data..."
    - `update_user_profile` → "Updating your profile..."
  - When `status: "completed"`, replace the indicator with a brief completed status, then continue rendering streamed text

### How to Test
- Start the full stack (Go backend launches MCP server as subprocess)
- Open chat, type "What's my profile look like?" — Grit should call `get_user_profile`, you see the tool call indicator, then Grit summarizes your profile data in conversation
- Type "What sport am I training for?" — Grit should reference your sport from the profile tool result
- Check the MCP server logs to verify tool calls are being received and executed correctly

---
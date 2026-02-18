# Progress

## Task 1: Project Scaffolding and Base App Shell — Done
- Expo React Native app in `frontend/` with TypeScript, bottom tab navigation (Home, History, Programs, Settings) using Ionicons, color palette in `src/constants/colors.ts`
- Go backend in `backend/` with chi router, `GET /api/health` endpoint, zerolog logging, multi-stage Dockerfile
- Docker Compose at root: postgres:16 + api service, `db/migrations/` ready
- **Deviation:** Used `frontend/` + `backend/` layout instead of task's suggested `gritty-fitness` app name for the Expo directory

## Task 2: User Authentication — Done
- Backend: SQL migrations for `users` and `refresh_tokens` tables, Go auth service with register/login/refresh/JWT validation, HTTP handlers, JWT middleware, bcrypt password hashing, token rotation
- Frontend: API client with token storage (SecureStore), automatic 401 refresh retry, AuthContext provider with JWT-based session restoration, Login/Register screens, AuthStack navigation, logout on Settings screen
- Integration and unit tests for service layer, handlers, and middleware
- **Code simplification pass:** Extracted shared auth screen styles to `authStyles.ts`, consolidated duplicated `AuthStackParamList` type into `AuthStackNavigator.tsx`, fixed hardcoded API URL in AuthContext to use exported `API_BASE_URL`, extracted `userFromToken` helper to deduplicate JWT payload parsing, used `errors.As` consistently in Go tests, removed unnecessary comments across backend and frontend

## Bug Fix: Registration/Login network failures — Done
- Added CORS middleware to Go backend (`main.go`) — browser was blocking cross-origin requests from Expo web
- Added `EXPO_PUBLIC_API_URL` env var support for native devices only; web always uses `localhost:8080`
- Fixed `expo-secure-store` crash on web — platform-aware storage layer (`localStorage` on web, SecureStore on native) in `api.ts`, removed direct SecureStore import from `AuthContext.tsx`

## Task 3: Minimal User Profile and Settings — Done
- Migration `003_extend_users_minimal.sql`: added `timezone` and `units_preference` columns to users table (no sport/fitness fields — those belong to program criteria)
- Backend: `UserService` with `GetByID`/`Update`, `UserHandler` with `GET /api/v1/users/me` and `PUT /api/v1/users/me`, `User.ToResponse()` helper, updated all auth queries to include new columns
- Frontend: `getMe()`/`updateMe()` API functions, `AuthContext` fetches full profile via `/users/me` after auth (replaces JWT-only parsing), auto-detects timezone on first login, exposes `updateUser()` to context
- Settings screen: editable name, metric/imperial toggle, timezone field, save button with dirty-checking, log out
- **Code simplification pass:** Removed duplicate `User` interface in AuthContext (reuses exported `UserResponse` from api.ts), simplified state setters to pass API response directly

## Task 4: Chat with Grit (Basic Free Chat) — Done
- Migration `004_create_chat_messages.sql`: `chat_messages` table with role/context constraints, indexes on user_id, (user_id, context), program_id
- Backend: `ChatMessage` model in `models/chat.go`, `ChatService` with `SaveMessage`/`GetHistory`/`GetRecentMessages` (cursor-based pagination) in `services/chat.go`
- Backend: `GeminiClient` in `ai/gemini.go` using `google.golang.org/genai` SDK, `StreamChat` with `gemini-2.5-flash` model, system prompt with user name and program context placeholders
- Backend: `ChatHandler` with WebSocket endpoint (`GET /api/ws/chat`) using gorilla/websocket — auth via `?token=` query param, streams AI chunks as JSON, saves both user and assistant messages; REST `GET /api/v1/chat/history` for paginated history
- **Deviation:** WS endpoint at `/api/ws/chat` (outside JWT middleware group) instead of `/api/v1/chat` — browser WebSocket doesn't send Authorization header
- Frontend: `useChatWebSocket` hook managing WS lifecycle with exponential backoff reconnection, streaming message assembly, `sendMessage`/`loadHistory` API
- Frontend: HomeScreen rewrite with three zones (header + program placeholder, "Coming up" placeholder, chat bar), slide-up chat overlay with animated `Animated.View`, `FlatList` message display, real-time streamed text rendering, typing indicator, connection status dot
- Frontend: `getChatHistory()` and `getWsBaseUrl()` added to `api.ts`
- **Code simplification pass:** Extracted shared `queryMessages`/`reverseMessages` helpers in chat service, simplified userName assignment in handler, removed unused `useAuth` import from HomeScreen

## Task 5: Programs, Tool Calling, and Conversational Program Creation — Done
- Migration `005_create_programs.sql`: `programs`, `program_criteria` (key-value pattern), `phases`, `weeks`, `scheduled_activities` tables with indexes and constraints
- Backend: `Program`, `ProgramCriterion`, `Phase`, `Week`, `ScheduledActivity` models with nested response types and input types in `models/program.go`
- Backend: `ProgramService` with full CRUD — `GetActiveProgram`, `GetByID`, `ListByUser`, `SaveProgramWithCriteria` (transactional with auto-archive), `UpdateProgram`, `GetCriteria`, `UpsertCriteria`, `AdjustActivities`, `GetUpcomingActivities`, `GetScheduledActivity`
- Backend: REST endpoints — `GET/PUT /api/v1/programs/:id`, `GET /api/v1/programs`, `GET/PUT /api/v1/programs/:id/criteria`, `GET /api/v1/activities/upcoming`
- Backend: Tool calling via Gemini native function calling (no MCP server) — `tools/registry.go` with `Registry` converting to `genai.FunctionDeclaration`, `tools/tools.go` with 9 tools (get_user_profile, get_active_program, get_program_criteria, propose_program, confirm_program_save, propose_adjustment, confirm_adjustment, update_program_criteria, get_scheduled_activity)
- Backend: `ProposalStore` in-memory map for preview+confirm pattern — `propose_*` stores but doesn't save, `confirm_*` persists. 30-minute expiry.
- Backend: `ChatWithTools` in `ai/gemini.go` — non-streaming `GenerateContent` for tool-calling rounds (max 5), function call/response loop, streams final text response. Context-specific prompts for `program_creation`, `criteria_edit`, `free_chat`.
- Backend: Extended WebSocket protocol — new message types: `tool_call`, `program_proposal`, `adjustment_proposal`, `program_created`, `adjustment_applied`, `proposal_response`. Thread-safe `wsWriter` for concurrent writes.
- Frontend: Extended `useChatWebSocket` hook — handles `tool_call`, `program_proposal`, `adjustment_proposal`, `program_created` WS messages. Added `respondToProposal()` method. Callbacks for `onProgramCreated` and `onAdjustmentApplied`.
- Frontend: `ToolCallIndicator` component — inline spinner with human-readable tool status labels
- Frontend: `ProgramProposalCard` component — structured preview card with phase/week summary, Accept/Deny buttons, expandable phase details
- Frontend: `ProgramContext` — manages `activeProgram` and `upcomingActivities` state, fetched on auth
- Frontend: HomeScreen — shows active program (name, sport, progress bar) or "Create Your Program" CTA. Upcoming activities rendered as `UpcomingActivityCard`s. Chat modal supports `program_creation` context with auto-trigger. Renders tool calls and proposals inline.
- Frontend: `ProgramsScreen` — real program list with ACTIVE/ARCHIVED badges, long-press for archive/reactivate. `ProgramsStackNavigator` for list→detail navigation.
- Frontend: `ProgramDetailScreen` — full program view with criteria cards, collapsible phases→weeks→activities. "Edit Settings" button opens `CriteriaEditorModal`.
- Frontend: `CriteriaEditorModal` — editable fields based on value_type, dirty-checking, calls `PUT /api/v1/programs/:id/criteria`
- Frontend: Program API functions added to `api.ts` — `getPrograms`, `getProgram`, `updateProgram`, `getProgramCriteria`, `updateProgramCriteria`, `getUpcomingActivities` with full TypeScript interfaces
- **Deviation:** No MCP server — tools implemented directly in Go using Gemini's native function calling. Simpler architecture, no Node.js subprocess.
- **Deviation:** Two-tool preview+confirm pattern (propose_program/confirm_program_save) instead of direct save — all changes go through user review

## Task 6: Conversational Program Creation Improvements — Done
- Fixed streaming: `ChatWithTools` final text response now uses `GenerateContentStream` for real token-by-token streaming to the UI (previously sent entire response as one chunk)
- Extracted system prompts to `backend/prompts/` template files (free_chat.txt, program_creation.txt, criteria_edit.txt) using Go `text/template`; extracted questions to `backend/prompts/questions.json` with ~18 categorized questions; `PromptLoader` loads at startup
- Program creation prompt now enforces "one question at a time" conversation rule
- Mandatory cross-training questions: strength & conditioning, stretching/mobility, complementary activities always asked
- Current date/time injected into all system prompts in user's timezone
- Markdown rendering in chat: installed `react-native-markdown-display`, assistant messages render bold, lists, headings, code blocks
- Yes/No quick reply buttons: backend detects yes/no questions via `isYesNoQuestion()`, sends `yes_no: true` in done frame; frontend shows pill buttons above input
- Clear chat + long-term memory: migration `006_create_chat_memory.sql`, `SummarizeConversation` uses `gemini-2.0-flash-lite` to generate 2-3 sentence summary, saved as `chat_memory` (UPSERT per user+context), loaded into system prompt as `{{.Memory}}`
- AppState listener clears chat on app background; clear chat button (trash icon) with confirmation dialog in chat header
- Keyboard dismiss: `keyboardDismissMode="on-drag"` on FlatList, chevron-down dismiss button next to input when keyboard visible
- Updated Dockerfile to COPY prompts directory into runtime image

## Chat Bug Fixes: Proposals, Drafts, Tool UI, Clear Chat — Done
- Fixed program proposal showing raw JSON: `ChatWithTools` now tracks `hasProposal` bool; after `propose_program`/`propose_adjustment`, skips re-streaming and sends non-streaming text directly, preventing duplicate verbose JSON output alongside the ProgramProposalCard
- Fixed clear chat trash icon on web: platform-aware confirmation — `window.confirm()` on web (Alert.alert callbacks unreliable on Expo web), `Alert.alert` on native. Added `setHistoryLoaded(false)` to prevent stale messages reloading
- Tool call indicators moved from inline messages to typing area: `activeToolAction` state in `useChatWebSocket` hook, tool_call messages no longer added to messages array, typing indicator shows labeled spinner (e.g., "Preparing your program...") during tool execution. Deleted `ToolCallIndicator.tsx` component (dead code)
- Tool labels extracted to `frontend/src/constants/toolLabels.ts` for shared use
- Incremental draft program creation: `CreateDraftProgram`/`GetDraftProgram` service methods, three new tools (`get_draft_program`, `create_draft_program`, `save_draft_criterion`), `SaveProgramWithCriteria` accepts optional `draftProgramID` to promote draft to active. `PendingProposal` stores `DraftProgramID`. System prompt instructs Grit to check for/create drafts and save criteria incrementally
- **Deviation:** Draft tools are transparent background operations — no special WS messages needed, Grit's text naturally acknowledges saved state

## Feature Flag: Chat Memory — Done
- Chat memory/summarization gated behind `ENABLE_CHAT_MEMORY` env var (default off). When disabled, memory is not loaded, conversations are not summarized on clear, and no memory is injected into prompts. Set to `"false"` in docker-compose.yml.

## Task 7: Activity Detail and Manual Program Editing — Done
- Backend: `ActivityDetailResponse` model with enriched fields (program_id, program_name, phase_name, week_number, calculated date). `GetActivityDetail` service method with JOIN across scheduled_activities→weeks→phases→programs. `UpdateActivity` service method with ownership verification and partial field updates (prescription, notes, day_of_week, activity_type)
- Backend: `GET /api/v1/activities/{activityId}` and `PUT /api/v1/programs/{id}/activities/{activityId}` endpoints. ProgramHandler extended with chatService for system message insertion
- Backend: On manual edit, inserts system message into chat_messages (role=system, context=free_chat) with diff description so Grit is informed of changes
- Frontend: `ActivityDetailScreen` with rich prescription display by activity type (run, interval, strength, swim, cycling, mobility, rest, drill) and inline edit mode with form fields, day-of-week picker, notes editor, confirmation dialog
- Frontend: `PrescriptionDisplay` component for read-only rendering, `PrescriptionEditor` component with type-specific form fields (add/remove exercises, intervals)
- Frontend: `HomeStackNavigator` wrapping HomeScreen so ActivityDetail is reachable from Home tab. ActivityDetail also added to ProgramsStackNavigator
- Frontend: UpcomingActivityCard now tappable (Pressable with chevron), navigates to ActivityDetail from HomeScreen. Activity rows in ProgramDetailScreen also tappable
- Frontend: Shared utilities extracted to `activityIcons.ts` (icon mapping, formatPrescriptionSummary, dayAbbrev, formatActivityDate)
- **Code simplification pass:** Removed duplicated DAY_NAMES/DAY_LABELS and formatPrescription from ProgramDetailScreen and ActivityDetailScreen in favor of shared activityIcons.ts utilities. Simplified UpcomingActivityCard Pressable wrapping. Removed unused parameter from Go buildActivityDiff function

## Bug Fixes: Chat Keyboard, Typing Indicator, Multiple Programs — Done
- **Keyboard/scroll (mobile):** Replaced manual `paddingBottom` root container with `KeyboardAvoidingView` (`behavior="padding"` on iOS, `"height"` on Android). Changed `keyboardDismissMode` from `"on-drag"` to `"none"` — keyboard no longer closes when scrolling through messages. Bottom padding moved to input container only.
- **Unified typing indicator:** Removed the two-state dots/spinner switch. Now always shows a single `ActivityIndicator` with a dynamic label ("Thinking..." when idle, tool name label during tool calls). Eliminates the flickering component swap between tool phases.
- **Multiple programs per chat:** Added `ONE PROGRAM PER CONVERSATION` section to `program_creation.txt` — Grit is instructed to call `create_draft_program` only once, never propose a second program, and switch to coaching mode after `confirm_program_save` succeeds.

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

## Training Plan UX Overhaul + Program Editing Improvements — Done
- **Bug fix: Upcoming activities not showing** — `GetUpcomingActivities` SQL query now uses `COALESCE(w.start_date, p.start_date + ((week_number-1)*7 days))` to handle NULL week start dates (AI often omits them). Threshold changed from "today" to "start of current week" (Monday) so current-week activities always appear.
- **Training plan view redesign** — `ProgramDetailScreen` now shows a horizontal scrollable week selector (pills with W1…Wn + date) that auto-scrolls to the current week. Below it, a day-by-day (Mon–Sun) view shows each day's activity icon, type, and prescription summary; today is highlighted; past days are greyed; rest days shown explicitly. Activities are tappable → `ActivityDetailScreen`.
- **Criteria edits notify Grit** — `PUT /api/v1/programs/:id/criteria` now fetches old criteria before saving, builds a diff, and inserts a `system` chat message so Grit is aware of changed settings.
- **Post-edit chat redirect** — After saving criteria edits or activity edits, the app navigates to the Home tab and auto-opens the Grit chat (via `openChatRequest` state in `ProgramContext` + `useFocusEffect` in `HomeScreen`). Grit has already received a system message about the change.
- **Deviation:** No schema changes — activity dates in the training plan are derived on the frontend from `week.start_date` (or program start + week offset), avoiding a backend migration.

## Task 8: Activity Recording — Manual Logging — Done
- **Migration** `007_create_workouts.sql`: `workouts` table with `recorded_data JSONB`, `source` (manual/gps/garmin/apple_health), timestamps, indexes
- **Backend**: `models/workout.go` (Workout + SaveWorkoutInput), `services/workout.go` (Create/GetByID/ListByUser with extracted `workoutColumns` + `scanWorkout` helpers), `handlers/workout.go` (POST/GET /api/v1/workouts, GET /api/v1/workouts/{workoutId})
- **RecordManualScreen**: Two-phase screen (type-select → recording → summary). Activity type selector for free-form workouts; prescription pre-fill when linked via `scheduledActivityId`. Strength form: exercise list with sets/reps/weight/RPE, checkmarks, rest timer modal. Mobility form: per-exercise countdown timers with play/pause/complete. Drill form: name, description, free-text notes. Summary phase shows logged data with notes field + Save/Discard.
- **HistoryScreen**: Replaced placeholder with real FlatList of workouts from `GET /api/v1/workouts`, showing icon, type, date, duration, key stat (sets for strength, completion for mobility). Pull-to-refresh + empty state.
- **Entry points**: (1) HomeScreen program card "Log Workout" outline button; (2) HomeScreen FAB "+" (bottom-right, above chat bar); (3) UpcomingActivityCard "Log" pill button (manual types) / disabled "GPS" pill (GPS types); (4) ActivityDetailScreen "Record This Activity" button (enabled for manual, "Coming Soon" alert for GPS); (5) ProgramDetailScreen day view record icon on each manual activity row.
- **Helpers**: `isManualActivity()` and `isGPSActivity()` added to `activityIcons.ts`; `WorkoutResponse`/`SaveWorkoutInput` interfaces + `saveWorkout`/`getWorkouts`/`getWorkout` functions added to `api.ts`. `RecordManual` route added to both `HomeStackNavigator` and `ProgramsStackNavigator`.
- **Code simplifier**: Removed duplicate `WorkoutResponse` model (identical to `Workout`); extracted `workoutColumns` const and `scanWorkout` helper in service; removed local `DAY_NAMES` from ProgramDetailScreen (now uses shared `dayAbbrev()`); `inferWorkoutType` moved to module scope; removed empty style objects.
- **Deviation**: Migration is `007_create_workouts.sql` (not `006` as in task spec — `006` is already taken by chat memory).

## Bug Fixes: Task 8 Post-Implementation — Done
- **WorkoutContext** (`contexts/WorkoutContext.tsx`): Global workout state (ActiveWorkout, ExerciseLog, MobilityExerciseLog types) — moves all workout state out of RecordManualScreen so it persists across navigation
- **ActiveWorkoutBanner** (`components/ActiveWorkoutBanner.tsx`): Persistent banner at app top during recording — shows elapsed timer (derived from `startedAt`, accurate after nav away), taps to return via `navigationRef`
- **App.tsx**: Added `WorkoutProvider` + `navigationRef`, `ActiveWorkoutBanner` rendered above `BottomTabNavigator`
- **RecordManualScreen rewrite**: All workout state now from `WorkoutContext`; timer bar hidden during type-select phase (was shown twice redundantly); resumes existing workout on mount if context has one
- **HomeScreen scroll + FAB fix**: Wrapped header + comingUp in `ScrollView` to restore scrollability; FAB moved from `position: absolute` (floating too high) to inline `fabRow` View directly above chat bar, right-aligned

## Program Delete in Detail View + Grit Memory Management — Done
- **Backend**: `ClearMemory` service method + `DELETE /api/v1/chat/memory` endpoint wipes all `chat_memory` rows for a user. `clearChatMemory()` added to `api.ts`.
- **ProgramDetailScreen**: Trash icon in header (set via `navigation.setOptions` headerRight). Tapping shows delete confirmation; after deletion refreshes ProgramContext and offers "Clear Grit's Memory?" prompt so Grit starts fresh with the new program.
- **ProgramsScreen**: Delete flow now also calls `offerMemoryClear()` after successful deletion.
- **SettingsScreen**: New "Grit AI" section with "Clear Grit's Memory" button + explanation text + confirmation dialog. Memory is gated (feature flag) but the clear endpoint always works.
- **Architecture note**: `chat_memory` is per `(user_id, context)`, not per-program — clearing all memory is the correct approach when a program is deleted, since summaries may reference program-specific details that would mislead Grit after deletion.

## Log Activity + Workout Detail + Delete Program — Done
- **Backend**: `DeleteProgram` service method + `Delete` handler (`DELETE /api/v1/programs/{id}`, returns 200+JSON); cascades to child tables via DB constraints. `deleteProgram()` added to `api.ts`.
- **LogActivityScreen** (`screens/LogActivityScreen.tsx`): Form-based (no live timer) after-the-fact activity logger. Step 1: type picker (run/cycling/swim/strength/mobility/drill). Step 2: date (prev/next day arrows), duration (hours+minutes), type-specific fields (distance+auto-pace for run, distance+speed for cycling, distance+laps for swim, exercise list for strength, mobility exercise list), and notes. Saves via `saveWorkout()`.
- **WorkoutDetailScreen** (`screens/WorkoutDetailScreen.tsx`): Read-only view of a saved workout. Shows icon, type label, date, duration, and type-specific data (run stats, cycling stats, swim stats, strength exercise+sets table, mobility exercise list with completion). Uses `normalizeActivityType()` helper to avoid duplicate branch logic.
- **HistoryStackNavigator** (`navigation/HistoryStackNavigator.tsx`): New stack wrapping HistoryScreen + WorkoutDetailScreen + LogActivityScreen. `BottomTabNavigator` updated to use this instead of bare HistoryScreen.
- **HistoryScreen**: Each workout row now wrapped in `Pressable` → `WorkoutDetail`. Added "+" header button → `LogActivity`. Focus listener refreshes list on return from child screens.
- **HomeStackNavigator**: Added `LogActivity` screen. FAB "+" now shows Alert with "Record Workout (Live)" vs "Log Past Activity" options.
- **ProgramsScreen**: Long-press context menu now includes "Delete" (destructive) in both active and archived states; calls `deleteProgram()` with nested confirmation alert.
- **Code simplifier**: `buildRecordedData` signature simplified to take pre-computed `dist`/`durationSec`; `normalizeActivityType` extracted in WorkoutDetailScreen to deduplicate branch logic; `formatDateRange` moved to module scope in ProgramsScreen; long-press options array consolidated; HistoryScreen initial `useEffect` load removed (focus listener handles both initial and subsequent loads).

## Bug Fixes: Chat Keyboard, Typing Indicator, Multiple Programs — Done
- **Keyboard/scroll (mobile):** Replaced manual `paddingBottom` root container with `KeyboardAvoidingView` (`behavior="padding"` on iOS, `"height"` on Android). Changed `keyboardDismissMode` from `"on-drag"` to `"none"` — keyboard no longer closes when scrolling through messages. Bottom padding moved to input container only.
- **Unified typing indicator:** Removed the two-state dots/spinner switch. Now always shows a single `ActivityIndicator` with a dynamic label ("Thinking..." when idle, tool name label during tool calls). Eliminates the flickering component swap between tool phases.
- **Multiple programs per chat:** Added `ONE PROGRAM PER CONVERSATION` section to `program_creation.txt` — Grit is instructed to call `create_draft_program` only once, never propose a second program, and switch to coaching mode after `confirm_program_save` succeeds.

## Task 9: GPS Activity Tracking — Done
- **Dependencies**: `expo-location`, `react-native-maps`, `expo-sqlite`, `@react-native-community/netinfo`, `react-native-ble-plx` (dev build required for BLE + maps). Location/BLE permissions + background location mode added to `app.json`.
- **GPS Types** (`types/gps.ts`): `GPSPoint`, `HRReading`, `Lap`, `GPSRouteData`, `HRData`, `GPSSummaryData`, `HRZoneDistribution` interfaces.
- **GPS Utilities** (`services/gpsUtils.ts`): Haversine distance, rolling pace (10-point window), current speed, altitude smoothing (sliding median), cumulative elevation gain (1m threshold), lap computation, HR zone distribution (5-zone model), `buildFinalGPSPayload()`, sport classification helpers.
- **Backend**: `GPSRoute` + `HeartRateData json.RawMessage` added to `Workout` and `SaveWorkoutInput` models. `workoutColumns`, `scanWorkout`, and `Create()` INSERT updated. No migration needed (columns already existed in `007_create_workouts.sql`).
- **Offline Storage** (`services/offlineStorage.ts`): SQLite `pending_workouts` table; `savePendingWorkout`, `getPendingWorkouts`, `markSynced`, `clearSynced`.
- **Sync Service** (`services/syncService.ts`): Uploads unsynced pending workouts to API; triggered from `App.tsx` via AppState (foreground) and NetInfo (reconnect) listeners.
- **BLE Service** (`services/bleService.ts`): Singleton scanning for Heart Rate Profile (UUID `0x180D`), connects to `0x2A37` characteristic, parses uint8/uint16 HR measurement format per BLE GATT spec. Gracefully degrades (try/catch) in Expo Go.
- **WorkoutContext extended**: Added `ActiveGPSWorkout` state branch, `startGPSWorkout`/`updateGPSWorkout`/`clearGPSWorkout`, and derived `workoutMode: 'manual'|'gps'|null` — no changes to existing manual workout types.
- **RecordGPSScreen**: Full-screen map (Apple Maps on iOS, OpenStreetMap UrlTile on Android), live route polyline, metrics panel (distance hero metric, pace/speed, time, HR with zone colour, avg pace/speed, elevation gain, lap counter), idle→recording→paused→stopped state machine, auto-pause (3 consecutive points < 0.5 m/s), auto-lap (every 1 km) + manual lap button, BLE HR modal, discard confirmation.
- **WorkoutSummaryScreen**: Static route map, stats grid (distance, time, avg pace/speed, best lap, elevation, HR), HR zone bar chart, lap splits table with colour-coded lap times, notes input, offline-first save (tries API → falls back to SQLite + "Saved offline" banner).
- **ActiveWorkoutBanner updated**: GPS mode shows distance + location-pin icon and navigates to `RecordGPS`; manual mode unchanged.
- **UpcomingActivityCard**: GPS pill now enabled and calls `onRecordGPS` prop.
- **ActivityDetailScreen**: GPS activities navigate to `RecordGPS` (removed "Coming Soon" alert).
- **HomeScreen FAB**: Added "Start GPS Activity" option; `UpcomingActivityCard` gets `onRecordGPS` prop.
- **WorkoutDetailScreen**: GPS workouts show static route map + lap splits table above existing stats.
- **HistoryScreen**: GPS workouts show `distance_km` as key stat.
- **Navigation**: `RecordGPS` + `WorkoutSummary` added to all three stack navigators (Home, Programs, History).
- **Deviation**: OpenStreetMap tiles via `react-native-maps UrlTile` instead of Google Maps (no API key required). Map provider: Apple Maps on iOS (default), OSM UrlTile on Android.
- **Deviation**: BLE + maps require `npx expo prebuild` + native dev build — not compatible with Expo Go.
- **Platform fix**: `react-native-maps`, `react-native-ble-plx`, and `expo-sqlite` are native-only. Created `.native.ts(x)` + `.web.ts(x)` platform-specific files for `NativeMap`, `bleService`, and `offlineStorage` so `expo start --tunnel` (web bundler) no longer fails.

## GPS Activity UX Fixes — Done
- **Banner crash fixed**: `RecordGPSScreen` now derives `activityType` and `scheduledActivityId` from route params with safe fallback to existing `activeGPSWorkout` context — no crash when navigating back via the red `ActiveWorkoutBanner`.
- **Grey header removed**: Replaced the redundant semi-transparent `rgba(0,0,0,0.5)` header bar with a small circular close button (top-left of map area).
- **Map default location**: On mount, fetches current location (no prompt if permission not yet granted) and pans the map there. Fallback changed from London to world-level view.
- **Concurrent workout guard**: `WorkoutContext` uses refs to detect active sessions — `startGPSWorkout` returns early if a manual workout is running; `startWorkout` returns early if a GPS session is running. Both entry screens show an alert and navigate back if the other mode is active.
- **Unified activity type selector**: `RecordManualScreen` now shows all activity types in two sections — Outdoor GPS (Run, Walk, Cycling with GPS badge) and Indoor & Gym (Indoor Run, Indoor Cycling, Strength, Mobility, Drill). Selecting a GPS type navigates directly to `RecordGPS`. "Start GPS Activity" FAB option removed.
- **New activity types**: `walk`, `indoor_run`, `indoor_cycling` added to `activityIcons.ts` with correct GPS/manual classification. `LogActivityScreen` also updated.
- **Custom FAB action sheet** (`components/FABActionSheet.tsx`): Replaces plain `Alert.alert`. Animated bottom sheet springs up from the "+" button with two rows: "Start Workout" and "Log Past Activity". Tapping the backdrop dismisses it.

## Task 9.5: GPS & Workout UX Additional Fixes — Done
- **Workout-program linking**: Backend `ActivityDetailResponse` now includes `linked_workout_id/source/recorded_at` via LEFT JOIN on workouts table. New `PUT /api/v1/workouts/{id}/link` endpoint (`LinkToActivity` service). Frontend: `ActivityDetailScreen` shows "View Recording" button if linked; after GPS/log save, offers to link to today's scheduled activity via Alert; `WorkoutDetailScreen` shows "Link to Program" button for unlinked workouts. `WorkoutDetail` route added to Home + Programs stacks.
- **GPS activity locking**: `RecordGPSScreen` mount effect blocks navigation to a different GPS activity while one is recording — shows "GPS Session Active" alert and navigates back.
- **Map centering with 5s delay**: `followsUserLocation` removed; `onPanDrag` handler sets a `userMovedMapRef` flag; `handleNewPoint` skips `animateToRegion` for 5 seconds after user manually pans. Auto-following resumes after the cooldown.
- **Pre-start GPS state**: `startGPSWorkout` moved from mount effect to `handleStart` — the GPS workout context (and red banner) is only created when user actually presses Start. Pressing back before Start navigates cleanly with no orphaned state. `handleDiscard` skips confirmation alert in pre-start mode.

## GPS Bug Fix + Testing Infrastructure — Done
- **Critical auto-pause fix**: `location.coords.speed` returns `-1` on iOS when unknown (not `null`), causing `?? 0` to pass through `-1`, which is below the 0.5 m/s threshold — auto-pause fired on every point, silently stopping recording after 3 GPS callbacks. Fixed by computing instantaneous speed from haversine distance between consecutive points (same approach as Strava), skipping auto-pause check when there is insufficient data (`timeDelta < 0.5 s`).
- **Relaxed accuracy filter**: `MAX_ACCURACY_METRES` raised from 30 to 50 to allow points during GPS cold-start (first 30–60 s when accuracy is often 30–50 m).
- **Dev GPS simulation**: `frontend/src/services/gpsSimRoute.ts` generates a synthetic 1 km circular route (200 points, ~3 m/s jogging pace). `RecordGPSScreen` shows a "Sim Route (Dev)" button in `__DEV__` mode that feeds points into `handleNewPoint` at 50 ms intervals (33× real-time), exercising the full recording pipeline without going outdoors.
- **Unit tests**: `frontend/src/__tests__/gpsUtils.test.ts` — 32 Jest tests for all pure functions in `gpsUtils.ts`. Jest configured via `jest.config.js` + `ts-jest`; `"test"` script added to `package.json`.

## Unified System Prompt with On-Demand Skills — Done
- **Replaced 3 context-based prompts with 1 unified prompt + skills**: Deleted `free_chat.txt`, `program_creation.txt`, `criteria_edit.txt`. New `backend/prompts/system.md` (unified) + `backend/prompts/skills/program_creation.md` and `criteria_edit.md` (on-demand skills).
- **`read_skill` tool**: New Gemini function-calling tool that Grit calls to load skill instructions when it detects user intent (e.g., "create a program"). `SkillLoader` in `ai/gemini.go` loads `.md` skill files at startup and renders `{{.Criteria}}` from `questions.json`.
- **Simplified `PromptLoader`**: Removed `BuildFreeChatPrompt`/`BuildProgramCreationPrompt`/`BuildCriteriaEditPrompt`, replaced with single `BuildSystemPrompt`. Removed `ProgramContext` field from `PromptParams` (Grit fetches program data on demand via `get_active_program` tool).
- **Removed chat contexts**: Backend no longer switches prompts based on context. All messages saved with `context="chat"` (single stream). Frontend removed `chatContext` state, `chatContextRef`, and context parameters from `sendMessage`/`respondToProposal`/`clearChat`.
- **`ProgramContext.tsx`**: `openChatRequest` simplified from `string` to `boolean`.
- **Deviation**: Users can now say "create me a program" in free chat and Grit handles it directly via skill loading, instead of being told to tap a button.

## Fix Program Creation: Session State + Tool Call Persistence — Done
- **Root cause**: Tool call results (draft IDs, loaded skills) were lost between WS turns — only assistant text was saved to `chat_messages`. Grit forgot its draft program ID and created multiple drafts, re-read skills unnecessarily, and tried to confirm without proposing.
- **Session state tracking** (`handlers/chat.go`): New `sessionState` struct (`activeDraftID`, `activeSkill`) persists across the WS connection loop. The `executeTool` callback captures state from `create_draft_program`, `get_draft_program`, `read_skill`, and `confirm_program_save` results. State is injected into the system prompt as an "Active session context" section so Grit knows the current draft ID and loaded skill without re-calling tools.
- **Tool call summaries**: After each `ChatWithTools` turn with tool calls, a system message is saved to `chat_messages` summarizing which tools were called and the active draft ID. This provides context even after WS reconnect.
- **Better error for confirm without propose**: `confirm_program_save` now returns an actionable error telling Grit to call `propose_program` first.
- **Prompt improvements**: `program_creation.md` — reinforced ONE question per message rule, added 100-word limit during question phase, added "immediately call `propose_program`" instruction (don't describe program in text first), added "Handling large programs" section requiring every week to have activities. `system.md` — tightened default response limit from 200 to 100 words.
- **Gemini role mapping**: `messagesToContents` maps "system" → "user" for Gemini compatibility (Gemini only accepts "user" and "model"). Added consecutive same-role message merging to satisfy alternating turn requirement.

## Fix Program Proposal Modification + WS Reconnect — Done
- **MALFORMED_FUNCTION_CALL handling** (`ai/gemini.go`): When Gemini tries to generate a tool call with output too large (e.g., regenerating a 19-week program JSON), it returns `MALFORMED_FUNCTION_CALL`. Extended the fallback mechanism to handle this on any round (not just round 0) — retries without tools using the original message history, with a hint telling Grit the tool call failed and to respond in text instead.
- **`modify_pending_proposal` tool** (`tools/tools.go`): New tool allowing Grit to apply targeted edits to a pending program proposal without regenerating the entire program. Supports `swap_day`, `change_activity`, `update_prescription`, `remove_activity`, `add_activity` actions. Can target specific phases/weeks or apply changes across all weeks via `apply_to_all_weeks`. WS notification sends updated proposal to frontend.
- **Prompt update**: `program_creation.md` — added "Modifying a proposed program" section instructing Grit to use `modify_pending_proposal` instead of re-calling `propose_program` for changes.
- **WS reconnect fix** (`useChatWebSocket.ts`): Added `authFailedRef` to stop reconnect loop when `getValidAccessToken()` returns null (expired token + failed refresh). Prevents zombie reconnect loops. Ref resets on component mount (login). Added `__DEV__` console logs for WS connect/disconnect/auth-failure events.

## Phase-Based Program Proposal — Done
- **Problem**: `propose_program` required Gemini to generate entire program (phases→weeks→activities) in a single tool call. For 12-20 week programs, this exceeded Gemini's output token limits → `MALFORMED_FUNCTION_CALL`.
- **Solution**: Split into two-step flow: `propose_program` creates skeleton (metadata, phase names/dates, criteria, NO weeks) → `add_proposal_phase` called once per phase with weeks and activities. Proposal auto-sent to frontend when all phases populated.
- **`proposals.go`**: Added `TotalPhases` field to `PendingProposal` and `AllPhasesComplete()` method that checks all phases have non-empty weeks arrays.
- **`tools.go`**: Removed nested `weeks` schema from `propose_program` phases — phases now only have `name`, `order_index`, `start_date`, `end_date`. Handler stores skeleton with empty `weeks: []` arrays and returns phase names/indices. New `add_proposal_phase` tool: takes `phase_index` + `weeks[]` array, populates the target phase, returns completion status (`phases_completed`/`phases_total`/`remaining_phases`).
- **`chat.go`**: `propose_program` no longer sends `program_proposal` WS message. New `add_proposal_phase` case sends `program_proposal` only when `AllPhasesComplete()` returns true.
- **`program_creation.md`**: Rewrote program generation section with two-step instructions (skeleton → per-phase population). Kept `modify_pending_proposal` instructions for post-proposal changes.
- **Frontend**: Added `add_proposal_phase` tool label. No other changes — `ProgramProposalCard` renders the same full program JSON.

## Task 9.6: Heart Rate Sensor & Post-Activity Summary — Done
- **Backend**: Migration `009_add_max_heart_rate.sql` adds `max_heart_rate` column to users table. Updated `User` model, `ToResponse()`, all auth queries, and `UpdateUserInput`/UPDATE in user service.
- **Dependencies**: `react-native-gifted-charts`, `react-native-svg`, `expo-sensors` installed.
- **HRSensorModal** (`components/HRSensorModal.tsx`): Reusable BLE scanning/connection modal extracted from RecordGPSScreen. Used in both Settings and RecordGPSScreen.
- **Settings HR section**: Max heart rate numeric input (dirty-checked, saves via updateUser), HR monitor connect/disconnect row opening HRSensorModal.
- **Cadence detection** (`services/cadenceService.ts`): Accelerometer-based step cadence for run/walk using `expo-sensors`. Peak detection on acceleration magnitude at ~50Hz, 3-second sliding window for SPM. Web stub provided.
- **WorkoutContext**: Added `cadenceReadings`, `currentCadence`, `avgCadence` to `ActiveGPSWorkout`.
- **Swipeable metrics panel**: RecordGPSScreen metrics panel now horizontally swipeable (2 pages) — numeric metrics + LiveHRChart. Page indicator dots. Cadence row shown for run/walk activities. All hardcoded `185` maxHR replaced with `user.max_heart_rate`.
- **LiveHRChart** (`components/LiveHRChart.tsx`): Real-time HR line chart using react-native-gifted-charts with zone-colored data points and BPM overlay.
- **WorkoutCharts** (`components/WorkoutCharts.tsx`): 4 chart components (HROverTimeChart, PaceOverTimeChart, SpeedOverTimeChart, CadenceChart) added to WorkoutSummaryScreen and WorkoutDetailScreen. Sport-specific rendering (pace for runs, speed for cycling).
- **gpsUtils extensions**: `downsample<T>` (generic), `computePaceTimeSeries`, `computeSpeedTimeSeries`, `getHRZone`, `getHRZoneColor`, `HR_ZONE_COLORS`. `buildFinalGPSPayload` accepts optional cadenceReadings with avg/max cadence stats.
- **Types**: `CadenceReading` added to `gps.ts`, cadence fields added to `GPSRouteData`, `GPSSummaryData`, `HRData`.
- **Code simplifier**: Consolidated `downsampleReadings`/`downsampleCadence` into generic `downsample<T>`, extracted shared `getHRZoneColor`/`HR_ZONE_COLORS` to gpsUtils (removed duplicates from LiveHRChart and WorkoutCharts).
- **Tests**: 17 new tests (49 total) covering `downsample`, `getHRZone`, `getHRZoneColor`, `computePaceTimeSeries`, `computeSpeedTimeSeries`. All passing.
- **Linting**: Go build + golangci-lint clean. Frontend lint: 0 errors, pre-existing warnings only.

## Template-Week Program Proposal — Done
- **Problem**: Program creation via Gemini tool calls kept failing — even per-phase `add_proposal_phase` calls produced output too large or caused `unexpected EOF`.
- **Solution**: Replaced two-step `propose_program` (skeleton) + `add_proposal_phase` (per-phase) with a single `propose_program` call using template weeks. Each phase has `duration_weeks` + `template_week` (single Mon-Sun pattern). Templates expanded into real weeks at save time.
- **Backend**: `proposals.go` — removed `TotalPhases` and `AllPhasesComplete()`. `tools.go` — rewrote `propose_program` schema with `template_week`/`duration_weeks` per phase, removed `add_proposal_phase` tool entirely, rewrote `modify_pending_proposal` to operate on template activities (`applyTemplateModifications`), added `expandTemplatesToSaveInput()` for `confirm_program_save`. `chat.go` — `propose_program` sends WS `program_proposal` immediately, removed `add_proposal_phase` case, merged `propose_program`/`modify_pending_proposal` into single case.
- **Frontend**: `ProgramProposalCard` — replaced `weeks[]` with `template_week`/`duration_weeks`, shows "Template week · repeats Xw" in expanded phase view. `toolLabels.ts` — removed `add_proposal_phase` entry.
- **Prompt**: `program_creation.md` — single `propose_program` call with template week example JSON, updated `modify_pending_proposal` docs (removed `week_number`/`apply_to_all_weeks`).
- **Trade-off**: All weeks within a phase are identical at creation (no progressive overload). Users edit individual activities post-save, and Grit uses `propose_adjustment`.
- **Code simplifier**: Deduplicated `DAY_NAMES` in ProposalCard (uses shared `dayAbbrev()`), merged duplicate WS notification cases in chat.go, consistent error variable naming in tools.go.

## Date Bug Fix + Start-Today Feature — Done
- **Root cause**: `ScheduledActivityResponse` had no `date` field; both backend and frontend computed `date = weekStart + day_of_week` directly, which was off by 1 (e.g. Monday activity with `day_of_week=1` on a Monday `weekStart` gave Tuesday). Correct offset is `dow == 0 ? 6 : dow - 1` (Monday-based).
- **Backend**: Added `DowOffset(dow int) int` helper to `models/program.go`. Added `Date string` to `ScheduledActivityResponse`. Replaced `ToResponse()` on `ScheduledActivity` with `ToResponseWithDate(weekStart time.Time)`. Updated `Week.ToResponse(programStart)`, `Phase.ToResponse(programStart)`, and `Program.ToDetailResponse` to thread the program start date through so every activity gets a computed `date`. Fixed same formula in `GetUpcomingActivities` and `GetActivityDetail`.
- **Frontend**: Added `date: string` to `ScheduledActivityResponse` type. `ProgramDetailScreen` now derives `weekMonday` from `activity.date` (backend source of truth) instead of computing it client-side. `WeekView` uses `activity.date` for days that have activities; falls back to `weekMonday + offset` only for rest days.
- **Start-today feature**: Added `start_program_today` tool to `tools.go`. When Grit detects it is not Monday after a user accepts a proposal, it asks "Start today or next Monday?" If today: Grit calls `start_program_today(activities_this_week)` with the activities from the current day_of_week through Sunday. The tool prepends a "Current Week" partial phase (duration 1 week) to the proposal and updates `start_date` to this week's Monday. Updated `program_creation.md` with instructions for the question and tool usage.

## Task 9.7: Activity Tracking + Program Improvements — Done
- **GPS route on activity detail**: Backend `GetActivityDetail` now JOINs `workouts.gps_route` → `linked_gps_route` field on `ActivityDetailResponse`. New `RouteMapPreview` component renders a static route polyline; shown on `ActivityDetailScreen` when a linked GPS workout has route data. `WorkoutDetailScreen` refactored to use `RouteMapPreview` instead of inline map code.
- **Multiple activities per day**: `ProgramDetailScreen` `byDay` map changed from `Map<number, Activity>` to `Map<number, Activity[]>`. `WeekView`/`DayRow` redesigned — each day renders a column of individual tappable activity rows, each with its own record button. The add (+) button is always visible per day.
- **Program data freshness (v2)**: Added centralized `programDataVersion` counter + `notifyProgramDataChanged()` to `ProgramContext`. All screens that modify activities/programs call `notifyProgramDataChanged()` instead of individual refresh functions. `ProgramDetailScreen` now uses `useFocusEffect` to refetch on navigation back, plus a version watcher for external changes (e.g. Grit). `ProgramsScreen` also watches version for Grit-initiated changes. Workout screens (`RecordManualScreen`, `WorkoutSummaryScreen`, `LogActivityScreen`) also notify on save. `refreshProgram` removed from context exports (internal only).
- **Clear chat modal z-order fix**: `ClearChatModal` moved inside the chat `<Modal>` so it renders above the chat overlay instead of behind it.
- **Grit program editing**: New `propose_program_modification` + `confirm_program_modification` tools in `tools.go`. New `ModifyProgram()` service method applies structural changes (swap_day, change_activity, add_activity, remove_activity) across all weeks of a saved program. New `backend/prompts/skills/program_modification.md` skill. `system.md` updated with trigger condition. Frontend: new `ProgramModificationCard` component for proposal display; `useChatWebSocket` detects `{type: "program_modification"}` data and routes to the new card.
- **Unread chat indicator**: `useChatWebSocket` tracks `unreadCount` (incremented when Grit finishes streaming while chat is closed). Red badge on chat bar avatar + placeholder text changes to "Grit replied..." when unread > 0. `markRead()` / `markClosed()` called on chat open/close.
- **Code simplifier**: Replaced custom `joinStrings` with `strings.Join`; simplified IIFE in tool handler; removed unused `clearChatMemory` import; deduplicated `saveButton`/`primaryButton` styles.

## Manual Program Creation Flow — Done
- **Backend**: Moved template types (`TemplateProgramInput`, `TemplatePhaseInput`, `TemplateWeek`, `TemplateActivity`) and `ExpandTemplatesToSaveInput` from `tools.go` to `models/template.go` so both AI tools and HTTP handlers can use them. Updated `tools.go` to reference `models.*` types. Added `CreatedBy` field to `SaveProgramInput` with `"grit"` default; service `SaveProgramWithCriteria` uses it dynamically.
- **Backend**: New `POST /api/v1/programs` endpoint in `handlers/program.go` (`Create` handler). Accepts template-based program input (name, sport, goal, start_date, end_date, phases with template weeks), expands templates, sets `created_by = "user"`, saves via `SaveProgramWithCriteria`. Registered in `main.go`.
- **Frontend**: New `createProgram()` API function + `CreateProgramInput`/`CreateProgramPhaseInput` types in `api.ts`.
- **Frontend**: 3-step wizard flow: (1) `CreateProgramBasicsScreen` — name, sport (with quick-pick chips), goal, start date (week-shift arrows, defaults to next Monday), step indicator. (2) `CreateProgramScheduleScreen` — phase management (horizontal tabs, add/rename/delete, duration stepper, "Base/Build/Peak" preset), weekly template grid (Mon-Sun rows, add/edit activities via bottom sheet with activity type picker + `PrescriptionEditor`). (3) `CreateProgramReviewScreen` — summary header, phase cards with activity list, "Create Program" button with loading state, navigates to `ProgramDetailScreen` on success and triggers `notifyProgramDataChanged()`.
- **Frontend**: "Create" button added to `ProgramsScreen` header + prominent CTA in empty state. All 3 screens registered in `ProgramsStackNavigator`.
- **Code simplifier**: Extracted `StepIndicator` to `components/StepIndicator.tsx`, extracted `formatDateRange` to `utils/dates.ts`, changed `created_by` from raw userID to `"user"` label.

## Program Detail Date Calculation Overhaul — Done
- **Root cause**: Week `start_date` values in the DB were not always Mondays (AI-generated dates could be any day), but `DowOffset` and `ToResponseWithDate` assumed Monday-based offsets. Additionally, `GetUpcomingActivities` SQL used raw `day_of_week` as offset instead of `DowOffset` logic. Frontend mixed backend activity dates with locally-computed rest-day dates, causing inconsistent display.
- **Backend**: Added `MondayOf(t time.Time)` helper to `models/program.go` — normalizes any date to its week's Monday. `Week.ToResponse` now always normalizes `weekStart` to Monday before computing activity dates, and always returns `start_date` in `WeekResponse` (changed from `*string` to `string`). `GetActivityDetail` and `GetUpcomingActivities` both normalize via `MondayOf` before applying `DowOffset`. Fixed `GetUpcomingActivities` which was using raw `day_of_week` as day offset instead of the Monday-based `DowOffset`.
- **Frontend**: `ProgramDetailScreen` — removed `mondayOf()` and `weekMondayFromWeek()` helper functions (fragile fallback chain). `flatWeeks` now uses `week.start_date` from the backend directly. `WeekView` always computes all day dates (including rest days) from `weekMonday + offset`, never from individual activity dates. `WeekResponse.start_date` changed from optional to required in `api.ts`.
- **Tests**: 5 new tests in `backend/internal/models/program_test.go` covering `DowOffset`, `MondayOf`, `WeekToResponse` normalization (non-Monday start, fallback from program start, Sunday activities).
- **Code simplifier**: `MondayOf` reuses `DowOffset` (one-liner). Removed format/parse round-trip in `GetUpcomingActivities`. `tools.go` uses `MondayOf` helper. Fixed Sunday exclusion bug in week pill current-week highlight.
- **"Coming up" fix**: Changed filter threshold from start-of-week (Monday) to today — only shows activities from today onward. Fixed sort: SQL `ORDER BY day_of_week` put Sunday (0) before Monday (1); replaced with in-memory sort by computed calendar date. Increased default limit from 5 to 6.

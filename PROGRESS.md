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

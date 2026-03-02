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

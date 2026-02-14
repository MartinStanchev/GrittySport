## Feature 4: Chat with Grit (Basic Free Chat)

### Goal
Users can chat with Grit from the Home screen. Messages are sent via WebSocket, streamed back in real-time, and persisted. No MCP tools yet — this is the raw conversational foundation.

### Task 4.1: Database Migration — Chat Messages
- Create migration `003_create_chat_messages.sql`:
  ```sql
  CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    context VARCHAR(30) NOT NULL DEFAULT 'free_chat' CHECK (context IN ('free_chat', 'program_creation', 'post_workout')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
  CREATE INDEX idx_chat_messages_user_context ON chat_messages(user_id, context);
  ```

### Task 4.2: Gemini 3 Flash Integration in Go
- Add the Google Generative AI Go SDK: `github.com/google/generative-ai-go` and `google.golang.org/api/option`
- Add `GEMINI_API_KEY` to the environment variables
- Create a `/internal/ai/gemini.go` module that:
  - Initializes a Gemini client using the API key
  - Exposes a function `StreamChat(ctx, systemPrompt string, messages []ChatMessage) (<-chan string, error)` that:
    - Constructs the Gemini request with the system prompt and message history
    - Uses the `gemini-3-flash` model identifier
    - Returns a channel that emits response text chunks as they stream in
  - Each message in the history has a role (`user` or `model`) and content
- Build the system prompt for free chat:
  ```
  You are Grit, an AI fitness coach in the Gritty Fitness app. Your personality is adaptable: you are encouraging and celebratory when the user works hard and hits their goals, and you become more direct and challenging when they slack off or skip sessions. You are never hostile or shaming, but you are firm and honest. You speak like a knowledgeable, experienced coach — not overly formal, not too casual. You use the user's name when it feels natural.

  You have access to the user's profile:
  - Name: {name}
  - Sport: {sport}
  - Experience Level: {experience_level}
  - Training Days/Week: {training_days_per_week}
  - Hours/Session: {hours_per_session}
  - Equipment: {equipment_access}
  - Injuries: {injuries}
  - Goal: {goal}
  - Event Date: {event_date or "none"}

  The user currently has {active_program_status}. You are in free chat mode. The user may ask you anything about training, nutrition, recovery, or their program. Answer helpfully and concisely. Keep responses under 200 words unless the user asks for detailed explanations.
  ```
  - Replace placeholders with actual user data at runtime

### Task 4.3: WebSocket Chat Endpoint
- Implement `WS /api/chat` using `github.com/gorilla/websocket`:
  - On connection: authenticate by reading the JWT from the `token` query parameter. Reject if invalid.
  - Load the last 50 chat messages for the user from the database (for conversation context)
  - On receiving a message from the client:
    - Parse JSON: `{ "type": "user_message", "content": "string", "context": "free_chat" }`
    - Save the user message to `chat_messages`
    - Assemble the system prompt with user profile data
    - Call `StreamChat` with the system prompt and message history
    - For each chunk from the channel, send to client: `{ "type": "grit_chunk", "content": "chunk text", "done": false }`
    - After the stream completes, send: `{ "type": "grit_chunk", "content": "", "done": true }`
    - Save the complete assistant message to `chat_messages`
  - Handle connection close gracefully
- Implement `GET /api/chat/history`:
  - Query params: `context` (optional, default all), `limit` (default 50), `before` (cursor-based pagination using message ID)
  - Returns messages in chronological order: `{ "messages": [...], "has_more": boolean }`

### Task 4.4: Home Screen with Chat UI
- Replace the Home placeholder with the real `HomeScreen`:
  - **Top Zone**: Show a header with "GRITTY FITNESS" and below it either "No active program — Create one to get started" with a "Create Program" button (disabled for now, will be functional in Feature 6), or a program summary card (implemented in Feature 6).
  - **Middle Zone**: A "Coming up" section with text "No upcoming activities" (populated in Feature 6).
  - **Bottom Zone**: Chat input bar pinned to the bottom of the screen.
- Chat input bar:
  - A `TextInput` with placeholder "Message Grit..." and a send button (arrow icon)
  - Tapping the input or send button expands the chat into a full-screen modal/overlay:
    - Shows message history (loaded from `GET /api/chat/history` on open)
    - Messages are displayed in a `FlatList` (inverted) with user messages right-aligned (dark background, white text) and Grit messages left-aligned (light background, dark text)
    - While Grit is responding, show a typing indicator and render the streamed text progressively
    - The input remains at the bottom of the expanded chat view
    - A close/minimize button (chevron down) collapses back to the chat bar
- Install and use `react-native-url-polyfill` and a WebSocket-compatible approach. React Native's built-in `WebSocket` API is sufficient — do NOT use `socket.io`.
- Create a `useChatWebSocket` hook at `/src/hooks/useChatWebSocket.ts`:
  - Manages the WebSocket connection lifecycle (connect, reconnect on disconnect, close on unmount)
  - Exposes: `sendMessage(content, context)`, `messages` array (state), `isConnected`, `isGritTyping`
  - Appends streamed chunks to the current assistant message in real-time
  - Reconnects automatically with exponential backoff (1s, 2s, 4s, max 30s)

### How to Test
- Open the app, go to Home — you see the chat bar at the bottom
- Tap the chat bar — it expands to full chat view, empty history
- Type "Hey Grit, I'm new here" and send — Grit responds in real-time with streamed text, referencing your profile data (sport, name, etc.)
- Close the chat, reopen — previous messages are loaded from history
- Send a few more messages — conversation is coherent and contextual
- Kill the app and reopen — chat history persists

---
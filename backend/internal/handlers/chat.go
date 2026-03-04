package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/sanitize"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/tools"
	"github.com/grittyfitness/api/internal/usage"
)

// sessionState tracks context that persists across WS turns within a single connection.
// This compensates for tool call results not being saved in chat_messages.
type sessionState struct {
	activeDraftID string // current draft program being worked on
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type ChatHandler struct {
	chatService    *services.ChatService
	aiClient       *ai.GeminiClient
	userService    *services.UserService
	authService    *services.AuthService
	programService *services.ProgramService
	usageService   *usage.Service
	toolRegistry   *tools.Registry
	proposalStore  *tools.ProposalStore
	promptLoader   *ai.PromptLoader
	memoryEnabled  bool
}

func NewChatHandler(chatService *services.ChatService, aiClient *ai.GeminiClient, userService *services.UserService, authService *services.AuthService, programService *services.ProgramService, promptLoader *ai.PromptLoader, skillLoader *ai.SkillLoader, memoryEnabled bool, usageSvc *usage.Service) *ChatHandler {
	proposalStore := tools.NewProposalStore()
	toolRegistry := tools.NewRegistry()
	tools.RegisterAllTools(toolRegistry, programService, userService, proposalStore, skillLoader, usageSvc)

	return &ChatHandler{
		chatService:    chatService,
		aiClient:       aiClient,
		userService:    userService,
		authService:    authService,
		programService: programService,
		usageService:   usageSvc,
		toolRegistry:   toolRegistry,
		proposalStore:  proposalStore,
		promptLoader:   promptLoader,
		memoryEnabled:  memoryEnabled,
	}
}

type wsIncoming struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Action  string `json:"action,omitempty"`
}

type wsOutgoing struct {
	Type           string          `json:"type"`
	Content        string          `json:"content,omitempty"`
	Done           bool            `json:"done,omitempty"`
	Tool           string          `json:"tool,omitempty"`
	Status         string          `json:"status,omitempty"`
	Data           json.RawMessage `json:"data,omitempty"`
	QuickReplies   []string        `json:"quick_replies,omitempty"`
	UsageRemaining *int            `json:"usage_remaining,omitempty"`
	UsageLimit     *int            `json:"usage_limit,omitempty"`
	ResetsAt       string          `json:"resets_at,omitempty"`
}

type wsWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (w *wsWriter) writeJSON(v any) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn.WriteJSON(v)
}

func (h *ChatHandler) WebSocket(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		log.Debug().Msg("WS connection rejected: missing token")
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	userID, _, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		log.Debug().Err(err).Msg("WS connection rejected: invalid token")
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}
	defer conn.Close()

	ws := &wsWriter{conn: conn}

	log.Debug().Str("user_id", userID).Msg("WS connected")

	recentMsgs, err := h.chatService.GetRecentMessages(r.Context(), userID, 50)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to load recent messages")
	} else {
		log.Debug().Str("user_id", userID).Int("count", len(recentMsgs)).Msg("Loaded recent messages for context")
	}

	user, err := h.userService.GetByID(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to fetch user")
		return
	}

	userName := "there"
	if user.Name != "" {
		userName = user.Name
	}

	var memory string
	if h.memoryEnabled {
		memory, err = h.chatService.GetMemory(r.Context(), userID)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to load chat memory")
		}
	}

	session := &sessionState{}

	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Error().Err(err).Str("user_id", userID).Msg("WebSocket read error")
			} else {
				log.Debug().Str("user_id", userID).Msg("WS disconnected")
			}
			return
		}

		var incoming wsIncoming
		if err := json.Unmarshal(rawMsg, &incoming); err != nil {
			log.Debug().Err(err).Str("user_id", userID).Msg("Failed to parse WS message")
			continue
		}

		if incoming.Type == "proposal_response" {
			h.handleProposalResponse(r, ws, userID, userName, memory, user, incoming, &recentMsgs, session)
			continue
		}

		if incoming.Type == "clear_chat" {
			h.handleClearContext(r, ws, userID, &recentMsgs, &memory)
			continue
		}

		if incoming.Type != "user_message" || strings.TrimSpace(incoming.Content) == "" {
			log.Debug().Str("type", incoming.Type).Str("user_id", userID).Msg("Ignoring non-message WS frame")
			continue
		}

		// Check chat rate limit before doing any work
		allowed, remaining, _ := h.usageService.CheckAndIncrement(r.Context(), userID, "chat_message")
		if !allowed {
			resetTime := usage.WeekResetTime().Format(time.RFC3339)
			_ = ws.writeJSON(wsOutgoing{
				Type:     "rate_limited",
				Content:  "You've used your 50 free messages this week. Resets on Monday.",
				ResetsAt: resetTime,
			})
			_ = ws.writeJSON(wsOutgoing{Type: "grit_chunk", Done: true})
			continue
		}

		// Sanitize user input before saving and LLM processing
		incoming.Content = sanitize.SanitizeChatMessage(incoming.Content)

		log.Debug().
			Str("user_id", userID).
			Str("content", incoming.Content).
			Msg("Received user message")

		userMsg, err := h.chatService.SaveMessage(r.Context(), userID, "user", incoming.Content, nil, nil)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to save user message")
			continue
		}

		aiMessages := buildAIMessages(recentMsgs, incoming.Content)
		systemPrompt := h.buildSystemPrompt(userName, memory, user, session)
		h.handleWithTools(r, ws, userID, systemPrompt, aiMessages, userMsg, &recentMsgs, session, remaining)
	}
}

func (h *ChatHandler) handleWithTools(r *http.Request, ws *wsWriter, userID, systemPrompt string, aiMessages []ai.ChatMessage, userMsg *models.ChatMessage, recentMsgs *[]models.ChatMessage, session *sessionState, chatRemaining int) {
	toolDefs := h.toolRegistry.GeminiTools()

	notifyToolCall := func(toolName, status string) {
		_ = ws.writeJSON(wsOutgoing{
			Type:   "tool_call",
			Tool:   toolName,
			Status: status,
		})
	}

	executeTool := func(name string, args map[string]any) (any, error) {
		result, err := h.toolRegistry.Execute(r.Context(), name, userID, args)
		if err != nil {
			return nil, err
		}

		// Track session state and send WS notifications for tool results
		switch name {
		case "create_draft_program":
			if resultMap, ok := result.(map[string]any); ok {
				if id, ok := resultMap["program_id"].(string); ok {
					session.activeDraftID = id
				}
			}
		case "get_draft_program":
			if resultMap, ok := result.(map[string]any); ok {
				if id, ok := resultMap["id"].(string); ok {
					session.activeDraftID = id
				}
			}
		case "propose_program", "modify_pending_proposal":
			if proposal, ok := h.proposalStore.Get(userID); ok {
				_ = ws.writeJSON(wsOutgoing{Type: "program_proposal", Data: proposal.Program})
			}
		case "propose_adjustment":
			if proposal, ok := h.proposalStore.Get(userID); ok {
				_ = ws.writeJSON(wsOutgoing{Type: "adjustment_proposal", Data: proposal.Program})
			}
		case "propose_program_modification":
			if proposal, ok := h.proposalStore.Get(userID); ok {
				var meta map[string]string
				_ = json.Unmarshal(proposal.Criteria, &meta)
				payload, _ := json.Marshal(map[string]any{
					"type":          "program_modification",
					"description":   meta["description"],
					"modifications": proposal.Program,
				})
				_ = ws.writeJSON(wsOutgoing{Type: "adjustment_proposal", Data: payload})
			}
		case "confirm_program_save":
			session.activeDraftID = ""
			if resultMap, ok := result.(map[string]any); ok {
				if programID, ok := resultMap["program_id"].(string); ok {
					data, _ := json.Marshal(map[string]string{"program_id": programID})
					_ = ws.writeJSON(wsOutgoing{Type: "program_created", Data: data})
				}
			}
		case "add_week_activity":
			_ = ws.writeJSON(wsOutgoing{Type: "program_updated"})
		case "confirm_adjustment", "confirm_program_modification":
			_ = ws.writeJSON(wsOutgoing{Type: "adjustment_applied"})
		}

		return result, nil
	}

	sendChunk := func(text string) error {
		return ws.writeJSON(wsOutgoing{
			Type:    "grit_chunk",
			Content: text,
			Done:    false,
		})
	}

	fullResponse, toolCalls, err := h.aiClient.ChatWithTools(
		r.Context(),
		systemPrompt,
		aiMessages,
		toolDefs,
		executeTool,
		notifyToolCall,
		sendChunk,
	)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("ChatWithTools failed")
		_ = ws.writeJSON(wsOutgoing{Type: "error", Content: "Failed to get response from Grit"})
	}

	// Save a system message summarizing tool calls so future turns have context
	if len(toolCalls) > 0 {
		summary := buildToolCallSummary(toolCalls, session)
		if summaryMsg, err := h.chatService.SaveMessage(r.Context(), userID, "system", summary, nil, nil); err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to save tool call summary")
		} else {
			*recentMsgs = append(*recentMsgs, *summaryMsg)
		}
	}

	cleanText, quickReplies := parseQuickReplies(fullResponse)

	doneFrame := wsOutgoing{
		Type:         "grit_chunk",
		Done:         true,
		QuickReplies: quickReplies,
	}
	if chatRemaining >= 0 {
		limit := usage.FreeChatMessagesPerWeek
		doneFrame.UsageRemaining = &chatRemaining
		doneFrame.UsageLimit = &limit
	}
	_ = ws.writeJSON(doneFrame)

	if cleanText != "" {
		savedMsg, err := h.chatService.SaveMessage(r.Context(), userID, "assistant", cleanText, nil, nil)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to save assistant message")
		} else {
			*recentMsgs = append(*recentMsgs, *userMsg, *savedMsg)
		}
	} else {
		*recentMsgs = append(*recentMsgs, *userMsg)
	}

	if len(*recentMsgs) > 50 {
		*recentMsgs = (*recentMsgs)[len(*recentMsgs)-50:]
	}
}

func (h *ChatHandler) handleProposalResponse(r *http.Request, ws *wsWriter, userID, userName, memory string, user *models.UserResponse, incoming wsIncoming, recentMsgs *[]models.ChatMessage, session *sessionState) {
	var userContent string
	if incoming.Action == "accept" {
		userContent = "I accept this program, please save it."
	} else {
		userContent = "I'd like changes to this program."
		if incoming.Content != "" {
			userContent = incoming.Content
		}
	}

	userMsg, err := h.chatService.SaveMessage(r.Context(), userID, "user", userContent, nil, nil)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to save proposal response message")
		return
	}

	aiMessages := buildAIMessages(*recentMsgs, userContent)
	systemPrompt := h.buildSystemPrompt(userName, memory, user, session)

	h.handleWithTools(r, ws, userID, systemPrompt, aiMessages, userMsg, recentMsgs, session, -1)
}

func (h *ChatHandler) handleClearContext(r *http.Request, ws *wsWriter, userID string, recentMsgs *[]models.ChatMessage, memory *string) {
	if h.memoryEnabled && len(*recentMsgs) > 0 {
		aiMessages := make([]ai.ChatMessage, 0, len(*recentMsgs))
		for _, msg := range *recentMsgs {
			aiMessages = append(aiMessages, ai.ChatMessage{Role: msg.Role, Content: msg.Content})
		}

		summary, err := h.aiClient.SummarizeConversation(r.Context(), aiMessages)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to summarize conversation")
		}

		if summary != "" {
			if err := h.chatService.SaveMemory(r.Context(), userID, summary); err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("Failed to save chat memory")
			} else {
				*memory = summary
				log.Debug().Str("user_id", userID).Msg("Chat memory saved")
			}
		}
	}

	if err := h.chatService.ClearMessages(r.Context(), userID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to clear chat messages")
	}

	*recentMsgs = nil
	_ = ws.writeJSON(wsOutgoing{Type: "chat_cleared"})
}

func (h *ChatHandler) buildSystemPrompt(userName, memory string, user *models.UserResponse, session *sessionState) string {
	tz := "UTC"
	if user.Timezone != nil && *user.Timezone != "" {
		tz = *user.Timezone
	}

	prompt := h.promptLoader.BuildSystemPrompt(ai.PromptParams{
		UserName:        sanitize.SanitizeForPrompt(userName, 100),
		Timezone:        tz,
		Units:           user.UnitsPreference,
		CurrentDateTime: formatCurrentDateTime(tz),
		Memory:          memory,
	})

	// Inject active session context so Grit remembers state across turns
	if session.activeDraftID != "" {
		prompt += fmt.Sprintf("\n\n## Active session context\nYou are currently working on draft program ID: %s. Do NOT call create_draft_program — use this ID for save_draft_criterion and propose_program (as draft_program_id) calls.\n", session.activeDraftID)
	}

	return prompt
}

func formatCurrentDateTime(tz string) string {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	return time.Now().In(loc).Format("Monday, January 2, 2006 at 3:04 PM MST")
}

func buildAIMessages(recentMsgs []models.ChatMessage, newContent string) []ai.ChatMessage {
	aiMessages := make([]ai.ChatMessage, 0, len(recentMsgs)+1)
	for _, msg := range recentMsgs {
		aiMessages = append(aiMessages, ai.ChatMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}
	aiMessages = append(aiMessages, ai.ChatMessage{
		Role:    "user",
		Content: newContent,
	})
	return aiMessages
}

func buildToolCallSummary(toolCalls []ai.ToolCallInfo, session *sessionState) string {
	var parts []string
	for _, tc := range toolCalls {
		if tc.Error != "" {
			parts = append(parts, fmt.Sprintf("%s(FAILED: %s)", tc.Name, tc.Error))
		} else {
			parts = append(parts, tc.Name)
		}
	}
	summary := fmt.Sprintf("[System: Grit called tools: %s", strings.Join(parts, ", "))
	if session.activeDraftID != "" {
		summary += fmt.Sprintf(". Active draft program: %s", session.activeDraftID)
	}
	summary += "]"
	return summary
}

const quickReplyDelimiter = "|||QUICK_REPLIES|||"

func parseQuickReplies(text string) (cleanText string, replies []string) {
	idx := strings.Index(text, quickReplyDelimiter)
	if idx < 0 {
		return text, nil
	}

	cleanText = strings.TrimSpace(text[:idx])
	jsonPart := strings.TrimSpace(text[idx+len(quickReplyDelimiter):])

	var parsed struct {
		Replies []string `json:"replies"`
	}
	if err := json.Unmarshal([]byte(jsonPart), &parsed); err != nil {
		log.Debug().Err(err).Str("json", jsonPart).Msg("Failed to parse quick replies JSON")
		return cleanText, nil
	}

	return cleanText, parsed.Replies
}

func (h *ChatHandler) History(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	beforeID := r.URL.Query().Get("before")

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	messages, hasMore, err := h.chatService.GetHistory(r.Context(), userID, limit, beforeID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get chat history")
		writeError(w, http.StatusInternalServerError, "failed to get chat history")
		return
	}

	log.Debug().
		Str("user_id", userID).
		Int("count", len(messages)).
		Bool("has_more", hasMore).
		Msg("Chat history fetched")

	responses := make([]models.ChatMessageResponse, len(messages))
	for i, msg := range messages {
		responses[i] = msg.ToResponse()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"messages": responses,
		"has_more": hasMore,
	})
}

func (h *ChatHandler) ClearMemory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.chatService.ClearMemory(r.Context(), userID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to clear chat memory")
		writeError(w, http.StatusInternalServerError, "failed to clear memory")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"cleared": true})
}

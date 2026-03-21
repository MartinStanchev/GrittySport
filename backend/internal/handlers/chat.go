package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/chat"
	"github.com/grittyfitness/api/internal/memory"
	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/sanitize"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/tools"
	"github.com/grittyfitness/api/internal/usage"
)

// sessionState tracks context that persists across WS turns within a single connection.
type sessionState struct {
	activeDraftID     string    // current draft program being worked on
	activeSegmentID   string    // current memory segment being tracked
	activeSegmentType string    // cached segment type (avoids DB lookup per turn)
	lastMessageTime   time.Time // when the last message was received
	mode              chat.Mode // current conversation mode
	escalated         bool      // true after a mode escalation retry within the current turn
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
	memoryService  *memory.Service
}

func NewChatHandler(chatService *services.ChatService, aiClient *ai.GeminiClient, userService *services.UserService, authService *services.AuthService, programService *services.ProgramService, promptLoader *ai.PromptLoader, skillLoader *ai.SkillLoader, memorySvc *memory.Service, usageSvc *usage.Service) *ChatHandler {
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
		memoryService:  memorySvc,
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

	assembledMemory, err := h.memoryService.AssembleMemory(r.Context(), userID, "")
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to assemble memory")
	}

	session := &sessionState{}

	// Restore active segment if one exists.
	if activeSeg, err := h.memoryService.GetActiveSegment(r.Context(), userID); err == nil && activeSeg != nil {
		session.activeSegmentID = activeSeg.ID
		session.activeSegmentType = activeSeg.SegmentType
	}
	// Seed lastMessageTime from DB so gap detection works across reconnects.
	if lastTime, err := h.memoryService.GetLastMessageTime(r.Context(), userID); err == nil && !lastTime.IsZero() {
		session.lastMessageTime = lastTime
	} else {
		session.lastMessageTime = time.Now()
	}

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
			h.handleProposalResponse(r, ws, userID, userName, assembledMemory, user, incoming, &recentMsgs, session)
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

		// Segment boundary detection: check for time gap.
		assembledMemory = h.handleSegmentBoundary(r.Context(), userID, session, assembledMemory)

		log.Debug().
			Str("user_id", userID).
			Str("content", incoming.Content).
			Msg("Received user message")

		userMsg, err := h.chatService.SaveMessage(r.Context(), userID, "user", incoming.Content, nil, nil)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to save user message")
			continue
		}

		// Start a segment if none is active.
		if session.activeSegmentID == "" {
			segType := h.memoryService.DetectSegmentType(r.Context(), incoming.Content)
			if seg, err := h.memoryService.StartSegment(r.Context(), userID, segType, userMsg.ID); err == nil {
				session.activeSegmentID = seg.ID
				session.activeSegmentType = segType
			}
		}

		session.lastMessageTime = time.Now()

		// Detect conversation mode for tool/prompt filtering.
		h.applyDetectedMode(session, userID)

		// Reassemble memory with mode-aware filtering when in a specialized mode.
		if session.mode != chat.ModeGeneralCoaching {
			if mem, err := h.memoryService.AssembleMemory(r.Context(), userID, string(session.mode)); err == nil {
				assembledMemory = mem
			}
		}

		aiMessages := buildAIMessages(recentMsgs, incoming.Content)
		h.handleWithTools(r, ws, userID, userName, assembledMemory, user, aiMessages, userMsg, &recentMsgs, session, remaining)
	}
}

func (h *ChatHandler) handleWithTools(r *http.Request, ws *wsWriter, userID, userName, assembledMemory string, user *models.UserResponse, aiMessages []ai.ChatMessage, userMsg *models.ChatMessage, recentMsgs *[]models.ChatMessage, session *sessionState, chatRemaining int) {
	session.escalated = false // reset per turn

	systemPrompt := h.buildSystemPrompt(r.Context(), userID, userName, assembledMemory, user, session)
	toolDefs := h.toolRegistry.GeminiToolsForMode(session.mode)
	log.Debug().
		Str("user_id", userID).
		Str("mode", string(session.mode)).
		Int("tool_count", len(toolDefs[0].FunctionDeclarations)).
		Int("total_tools", h.toolRegistry.TotalToolCount()).
		Msg("Tools loaded for turn")

	notifyToolCall := func(toolName, status string) {
		_ = ws.writeJSON(wsOutgoing{
			Type:   "tool_call",
			Tool:   toolName,
			Status: status,
		})
	}

	executeTool := func(name string, args map[string]any) (any, error) {
		// Routing tool: switch to program creation mode with segment transition.
		// This must be checked before the general mode escalation guard below.
		if name == "begin_program_creation" {
			h.transitionSegment(r.Context(), userID, "program_creation", session)
			return nil, &chat.ErrModeEscalation{
				ToolName:     name,
				OriginalMode: session.mode,
				TargetMode:   chat.ModeProgramCreation,
			}
		}

		// Mode escalation: detect when the model calls a tool that exists
		// in the full registry but is not available in the current mode.
		if !session.escalated && h.toolRegistry.Exists(name) && !h.toolRegistry.ToolInMode(name, session.mode) {
			if targetMode, ok := h.toolRegistry.ModeForTool(name); ok {
				return nil, &chat.ErrModeEscalation{
					ToolName:     name,
					OriginalMode: session.mode,
					TargetMode:   targetMode,
				}
			}
		}

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
			session.mode = chat.ModeProgramCreation
			// Transition from general_coaching to program_creation segment.
			h.transitionSegment(r.Context(), userID, "program_creation", session)
		case "get_draft_program":
			if resultMap, ok := result.(map[string]any); ok {
				if id, ok := resultMap["id"].(string); ok {
					session.activeDraftID = id
				}
			}
		case "propose_program":
			if proposal, ok := h.proposalStore.Get(userID); ok {
				_ = ws.writeJSON(wsOutgoing{Type: "program_proposal", Data: proposal.Program})
			}
		case "edit_program":
			if proposal, ok := h.proposalStore.Get(userID); ok {
				var meta map[string]string
				_ = json.Unmarshal(proposal.Criteria, &meta)
				payload, _ := json.Marshal(map[string]any{
					"type":        "program_edit",
					"description": meta["description"],
					"edits":       json.RawMessage(proposal.Program),
				})
				_ = ws.writeJSON(wsOutgoing{Type: "edit_proposal", Data: payload})
			}
		case "confirm_program_save":
			session.activeDraftID = ""
			session.mode = chat.ModeGeneralCoaching
			if resultMap, ok := result.(map[string]any); ok {
				if programID, ok := resultMap["program_id"].(string); ok {
					data, _ := json.Marshal(map[string]string{"program_id": programID})
					_ = ws.writeJSON(wsOutgoing{Type: "program_created", Data: data})
				}
			}
			h.closeSessionSegment(r.Context(), session)
		case "confirm_edit":
			session.mode = chat.ModeGeneralCoaching
			_ = ws.writeJSON(wsOutgoing{Type: "edit_applied"})
			h.closeSessionSegment(r.Context(), session)
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

	// Handle mode escalation: retry with the correct mode's tools and prompt.
	var escErr *chat.ErrModeEscalation
	if err != nil && errors.As(err, &escErr) && !session.escalated {
		session.escalated = true
		session.mode = escErr.TargetMode
		log.Info().
			Str("user_id", userID).
			Str("from_mode", string(escErr.OriginalMode)).
			Str("to_mode", string(escErr.TargetMode)).
			Str("tool", escErr.ToolName).
			Msg("Mode escalation: retrying with correct mode")

		toolDefs = h.toolRegistry.GeminiToolsForMode(session.mode)
		systemPrompt = h.buildSystemPrompt(r.Context(), userID, userName, assembledMemory, user, session)

		fullResponse, toolCalls, err = h.aiClient.ChatWithTools(
			r.Context(),
			systemPrompt,
			aiMessages,
			toolDefs,
			executeTool,
			notifyToolCall,
			sendChunk,
		)
	}
	if err != nil {
		logger := log.Error().Err(err).Str("user_id", userID)
		if session.escalated {
			logger.Msg("ChatWithTools failed after mode escalation retry")
		} else {
			logger.Msg("ChatWithTools failed")
		}
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

func (h *ChatHandler) handleProposalResponse(r *http.Request, ws *wsWriter, userID, userName, assembledMemory string, user *models.UserResponse, incoming wsIncoming, recentMsgs *[]models.ChatMessage, session *sessionState) {
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

	h.applyDetectedMode(session, userID)

	// Reassemble memory with mode-aware filtering for specialized modes.
	if session.mode != chat.ModeGeneralCoaching {
		if mem, err := h.memoryService.AssembleMemory(r.Context(), userID, string(session.mode)); err == nil {
			assembledMemory = mem
		}
	}

	aiMessages := buildAIMessages(*recentMsgs, userContent)

	h.handleWithTools(r, ws, userID, userName, assembledMemory, user, aiMessages, userMsg, recentMsgs, session, -1)
}

// handleSegmentBoundary checks for a 2+ hour gap since the last message. If found,
// it uses the LLM to check if the active segment is complete, closes and summarizes
// it if so, and reassembles memory for the prompt.
func (h *ChatHandler) handleSegmentBoundary(ctx context.Context, userID string, session *sessionState, currentMemory string) string {
	const gapThreshold = 2 * time.Hour

	if session.activeSegmentID == "" || session.lastMessageTime.IsZero() {
		return currentMemory
	}

	if time.Since(session.lastMessageTime) < gapThreshold {
		return currentMemory
	}

	log.Debug().Str("user_id", userID).Str("segment_id", session.activeSegmentID).Msg("Time gap detected, checking segment completion")

	complete, err := h.memoryService.CheckSegmentCompletion(ctx, session.activeSegmentID)
	if err != nil {
		log.Warn().Err(err).Msg("Segment completion check failed")
		complete = true
	}

	if complete {
		h.memoryService.CloseAndSummarize(ctx, session.activeSegmentID)
		session.activeSegmentID = ""
		session.activeSegmentType = ""

		// Reassemble memory with the new summary.
		if mem, err := h.memoryService.AssembleMemory(ctx, userID, string(session.mode)); err == nil {
			return mem
		}
	}

	return currentMemory
}

// closeSessionSegment closes the active segment and triggers async summarization.
func (h *ChatHandler) closeSessionSegment(ctx context.Context, session *sessionState) {
	if session.activeSegmentID == "" {
		return
	}
	h.memoryService.CloseAndSummarize(ctx, session.activeSegmentID)
	session.activeSegmentID = ""
	session.activeSegmentType = ""
}

// transitionSegment closes the current segment (if any) and starts a new one of the given type.
func (h *ChatHandler) transitionSegment(ctx context.Context, userID, newType string, session *sessionState) {
	h.closeSessionSegment(ctx, session)

	startMsgID := h.memoryService.GetLastMessageID(ctx, userID)
	if seg, err := h.memoryService.StartSegment(ctx, userID, newType, startMsgID); err == nil {
		session.activeSegmentID = seg.ID
		session.activeSegmentType = newType
	}
}

// detectMode builds a ModeContext from session state and determines the conversation mode.
func (h *ChatHandler) detectMode(session *sessionState, userID string) chat.ModeResult {
	ctx := chat.ModeContext{
		ActiveDraftID:     session.activeDraftID,
		ActiveSegmentType: session.activeSegmentType,
		CurrentMode:       session.mode,
	}
	if proposal, ok := h.proposalStore.Get(userID); ok {
		ctx.PendingProposal = &chat.ProposalInfo{Type: proposal.Type}
	}
	return chat.DetectMode(ctx)
}

// applyDetectedMode runs detectMode and updates session.mode, logging the result.
func (h *ChatHandler) applyDetectedMode(session *sessionState, userID string) {
	result := h.detectMode(session, userID)
	session.mode = result.Mode
	log.Debug().
		Str("user_id", userID).
		Str("mode", string(result.Mode)).
		Str("source", result.Source).
		Msg("Chat mode detected")
}

func (h *ChatHandler) buildSystemPrompt(ctx context.Context, userID, userName, memory string, user *models.UserResponse, session *sessionState) string {
	tz := "UTC"
	if user.Timezone != nil && *user.Timezone != "" {
		tz = *user.Timezone
	}

	prompt := h.promptLoader.BuildSystemPromptForMode(ai.PromptParams{
		UserName:        sanitize.SanitizeForPrompt(userName, 100),
		Timezone:        tz,
		Units:           user.UnitsPreference,
		CurrentDateTime: formatCurrentDateTime(tz),
		Memory:          memory,
	}, string(session.mode))

	if session.mode == chat.ModeProgramManagement {
		prompt += h.buildActiveProgramSettingsSection(ctx, userID)
	}

	if session.activeDraftID != "" {
		prompt += fmt.Sprintf("\n\n## Active session context\nYou are currently working on draft program ID: %s. Do NOT call create_draft_program — use this ID for save_draft_criterion and propose_program (as draft_program_id) calls.\n", session.activeDraftID)
		if n := h.proposalStore.PhaseCount(userID); n > 0 {
			prompt += fmt.Sprintf("You have saved %d phase(s) via save_draft_phase. Continue saving remaining phases or call propose_program if all phases are ready.\n", n)
		}
	}

	return prompt
}

func (h *ChatHandler) buildActiveProgramSettingsSection(ctx context.Context, userID string) string {
	program, criteria, err := h.programService.GetActiveProgramSettings(ctx, userID)
	if err != nil || program == nil {
		return ""
	}

	var b strings.Builder
	b.WriteString("\n\n## Active program settings\n")
	b.WriteString(fmt.Sprintf("Program: %s\n", program.Name))
	if program.Sport != nil && *program.Sport != "" {
		b.WriteString(fmt.Sprintf("Sport: %s\n", *program.Sport))
	}
	if program.GoalDescription != nil && *program.GoalDescription != "" {
		b.WriteString(fmt.Sprintf("Goal: %s\n", *program.GoalDescription))
	}
	if len(criteria) > 0 {
		b.WriteString("\nSettings saved during program creation:\n")
		for _, c := range criteria {
			b.WriteString(fmt.Sprintf("- %s: %s\n", c.Label, c.Value))
		}
	}
	b.WriteString("\nThese settings represent the user's preferences and constraints. When making modifications, respect these unless the user explicitly asks to change them. If a requested change contradicts a setting, inform the user of the conflict and ask how they'd like to proceed.\n")
	return b.String()
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

// DeleteChat deletes all chat messages for the authenticated user.
func (h *ChatHandler) DeleteChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.chatService.DeleteAllMessages(r.Context(), userID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to delete chat")
		writeError(w, http.StatusInternalServerError, "failed to delete chat")
		return
	}
	log.Info().Str("user_id", userID).Msg("Chat history deleted")
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// DeleteMemory clears all memory (segments + facts) for the authenticated user.
func (h *ChatHandler) DeleteMemory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.memoryService.ClearAll(r.Context(), userID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to clear memory")
		writeError(w, http.StatusInternalServerError, "failed to clear memory")
		return
	}
	log.Info().Str("user_id", userID).Msg("Grit memory cleared")
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}


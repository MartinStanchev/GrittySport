package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/middleware"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type ChatHandler struct {
	chatService *services.ChatService
	aiClient    *ai.GeminiClient
	userService *services.UserService
	authService *services.AuthService
}

func NewChatHandler(chatService *services.ChatService, aiClient *ai.GeminiClient, userService *services.UserService, authService *services.AuthService) *ChatHandler {
	return &ChatHandler{
		chatService: chatService,
		aiClient:    aiClient,
		userService: userService,
		authService: authService,
	}
}

type wsIncoming struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Context string `json:"context"`
}

type wsOutgoing struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Done    bool   `json:"done"`
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

	log.Debug().Str("user_id", userID).Msg("WS connected")

	// Load recent messages for AI context
	recentMsgs, err := h.chatService.GetRecentMessages(r.Context(), userID, 50)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to load recent messages")
	} else {
		log.Debug().Str("user_id", userID).Int("count", len(recentMsgs)).Msg("Loaded recent messages for context")
	}

	// Fetch user for system prompt
	user, err := h.userService.GetByID(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to fetch user")
		return
	}

	userName := "there"
	if user.Name != "" {
		userName = user.Name
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

		if incoming.Type != "user_message" || strings.TrimSpace(incoming.Content) == "" {
			log.Debug().Str("type", incoming.Type).Str("user_id", userID).Msg("Ignoring non-message WS frame")
			continue
		}

		chatContext := incoming.Context
		if chatContext == "" {
			chatContext = "free_chat"
		}

		log.Debug().
			Str("user_id", userID).
			Str("context", chatContext).
			Str("content", incoming.Content).
			Msg("Received user message")

		// Save user message
		userMsg, err := h.chatService.SaveMessage(r.Context(), userID, "user", incoming.Content, chatContext, nil, nil)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to save user message")
			continue
		}

		// Build AI message history
		aiMessages := make([]ai.ChatMessage, 0, len(recentMsgs)+1)
		for _, msg := range recentMsgs {
			aiMessages = append(aiMessages, ai.ChatMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
		aiMessages = append(aiMessages, ai.ChatMessage{
			Role:    "user",
			Content: incoming.Content,
		})

		systemPrompt := ai.BuildFreeChatPrompt(userName, "")

		log.Debug().
			Str("user_id", userID).
			Int("history_messages", len(aiMessages)).
			Msg("Calling Gemini StreamChat")

		chunks, err := h.aiClient.StreamChat(r.Context(), systemPrompt, aiMessages)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("Failed to start AI stream")
			conn.WriteJSON(wsOutgoing{Type: "error", Content: "Failed to get response from Grit"})
			continue
		}

		var fullResponse strings.Builder
		var chunkCount int
		for chunk := range chunks {
			chunkCount++
			fullResponse.WriteString(chunk)
			if err := conn.WriteJSON(wsOutgoing{
				Type:    "grit_chunk",
				Content: chunk,
				Done:    false,
			}); err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("Failed to write chunk to WS")
				break
			}
		}

		// Send done signal
		conn.WriteJSON(wsOutgoing{
			Type:    "grit_chunk",
			Content: "",
			Done:    true,
		})

		// Save assistant message and update context
		assistantContent := fullResponse.String()
		log.Debug().
			Str("user_id", userID).
			Int("chunks", chunkCount).
			Int("response_len", len(assistantContent)).
			Msg("AI response complete")

		if assistantContent != "" {
			savedMsg, err := h.chatService.SaveMessage(r.Context(), userID, "assistant", assistantContent, chatContext, nil, nil)
			if err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("Failed to save assistant message")
			} else {
				recentMsgs = append(recentMsgs, *userMsg, *savedMsg)
			}
		} else {
			log.Warn().Str("user_id", userID).Msg("Gemini returned empty response")
			recentMsgs = append(recentMsgs, *userMsg)
		}

		// Keep only last 50
		if len(recentMsgs) > 50 {
			recentMsgs = recentMsgs[len(recentMsgs)-50:]
		}
	}
}

func (h *ChatHandler) History(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	chatContext := r.URL.Query().Get("context")
	beforeID := r.URL.Query().Get("before")

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	messages, hasMore, err := h.chatService.GetHistory(r.Context(), userID, chatContext, limit, beforeID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get chat history")
		writeError(w, http.StatusInternalServerError, "failed to get chat history")
		return
	}

	log.Debug().
		Str("user_id", userID).
		Str("context", chatContext).
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

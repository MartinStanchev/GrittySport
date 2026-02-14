package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/rs/zerolog/log"
	"google.golang.org/genai"
)

const freeChatSystemPrompt = `You are Grit, an AI fitness coach in the Gritty Fitness app. Your personality is adaptable: you are encouraging and celebratory when the user works hard and hits their goals, and you become more direct and challenging when they slack off or skip sessions. You are never hostile or shaming, but you are firm and honest. You speak like a knowledgeable, experienced coach — not overly formal, not too casual. You use the user's name when it feels natural.

The user's name is %s.

%s

You are in free chat mode. The user may ask you anything about training, nutrition, recovery, or their program. If the user has no program yet, you can suggest they create one by tapping "Create Your Program" on the Home screen. Keep responses under 200 words unless the user asks for detailed explanations.`

type ChatMessage struct {
	Role    string
	Content string
}

type GeminiClient struct {
	client *genai.Client
}

func NewGeminiClient(ctx context.Context, apiKey string) (*GeminiClient, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create genai client: %w", err)
	}
	log.Info().Msg("Gemini client initialized")
	return &GeminiClient{client: client}, nil
}

func BuildFreeChatPrompt(userName, activeProgramContext string) string {
	if activeProgramContext == "" {
		activeProgramContext = "The user has no active program."
	}
	return fmt.Sprintf(freeChatSystemPrompt, userName, activeProgramContext)
}

func (g *GeminiClient) StreamChat(ctx context.Context, systemPrompt string, messages []ChatMessage) (<-chan string, error) {
	contents := make([]*genai.Content, 0, len(messages))
	for _, msg := range messages {
		role := msg.Role
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, &genai.Content{
			Role: role,
			Parts: []*genai.Part{
				genai.NewPartFromText(msg.Content),
			},
		})
	}

	if len(contents) == 0 || contents[len(contents)-1].Role != "user" {
		return nil, fmt.Errorf("last message must be from user")
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText(systemPrompt)},
		},
	}

	log.Debug().
		Int("history_len", len(contents)).
		Str("system_prompt", truncate(systemPrompt, 200)).
		Str("user_message", truncate(contents[len(contents)-1].Parts[0].Text, 200)).
		Msg("Starting Gemini stream")

	ch := make(chan string, 16)

	go func() {
		defer close(ch)

		var totalChunks int
		var fullText strings.Builder

		for resp, err := range g.client.Models.GenerateContentStream(ctx, "gemini-2.5-flash", contents, config) {
			if err != nil {
				log.Error().Err(err).
					Int("chunks_received", totalChunks).
					Msg("Gemini stream error")
				return
			}
			text := resp.Text()
			if strings.TrimSpace(text) != "" {
				totalChunks++
				fullText.WriteString(text)
				select {
				case ch <- text:
				case <-ctx.Done():
					log.Debug().
						Int("chunks_received", totalChunks).
						Msg("Gemini stream cancelled by context")
					return
				}
			}
		}

		log.Debug().
			Int("chunks_total", totalChunks).
			Str("response", truncate(fullText.String(), 300)).
			Msg("Gemini stream completed")
	}()

	return ch, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

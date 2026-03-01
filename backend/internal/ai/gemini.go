package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/rs/zerolog/log"
	"google.golang.org/genai"
)

const model = "gemini-2.5-flash"
const cheapModel = "gemini-2.0-flash-lite"

type ChatMessage struct {
	Role    string
	Content string
}

type ToolCallNotifier func(toolName string, status string)

// PromptParams contains all fields available to the system prompt template.
type PromptParams struct {
	UserName        string
	Timezone        string
	Units           string
	CurrentDateTime string
	Memory          string
	Criteria        string
}

type criterion struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

type criteriaCategory struct {
	Name     string      `json:"name"`
	Criteria []criterion `json:"criteria"`
}

type criteriaFile struct {
	Categories []criteriaCategory `json:"categories"`
}

// PromptLoader loads the unified system prompt template and renders it with parameters.
type PromptLoader struct {
	systemTmpl        *template.Template
	formattedCriteria string
}

// LoadPrompts reads the unified system prompt and questions.json from the given directory.
func LoadPrompts(dir string) (*PromptLoader, error) {
	data, err := os.ReadFile(filepath.Join(dir, "system.md"))
	if err != nil {
		return nil, fmt.Errorf("read system.md: %w", err)
	}
	tmpl, err := template.New("system").Parse(string(data))
	if err != nil {
		return nil, fmt.Errorf("parse system.md: %w", err)
	}

	// Load questions.json for criteria formatting
	criteriaBytes, err := os.ReadFile(filepath.Join(dir, "questions.json"))
	if err != nil {
		return nil, fmt.Errorf("read questions.json: %w", err)
	}
	var cf criteriaFile
	if err := json.Unmarshal(criteriaBytes, &cf); err != nil {
		return nil, fmt.Errorf("parse questions.json: %w", err)
	}

	log.Info().Str("prompts_dir", dir).Int("criteria_categories", len(cf.Categories)).Msg("System prompt and criteria loaded")
	return &PromptLoader{systemTmpl: tmpl, formattedCriteria: formatCriteria(cf)}, nil
}

// BuildSystemPrompt renders the unified system prompt with the given parameters.
// Criteria is automatically injected from questions.json.
func (pl *PromptLoader) BuildSystemPrompt(p PromptParams) string {
	p.Criteria = pl.formattedCriteria
	var buf bytes.Buffer
	if err := pl.systemTmpl.Execute(&buf, p); err != nil {
		log.Error().Err(err).Msg("Failed to render system prompt")
		return ""
	}
	return buf.String()
}

// SkillLoader loads on-demand skill files that Grit can read via the read_skill tool.
type SkillLoader struct {
	skills map[string]string
}

// LoadSkills reads skill files from the skills/ subdirectory.
func LoadSkills(dir string) (*SkillLoader, error) {
	sl := &SkillLoader{skills: make(map[string]string)}

	skillsDir := filepath.Join(dir, "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return nil, fmt.Errorf("read skills directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		name := strings.TrimSuffix(entry.Name(), ".md")
		data, err := os.ReadFile(filepath.Join(skillsDir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read skill %s: %w", entry.Name(), err)
		}
		sl.skills[name] = string(data)
	}

	log.Info().Int("skills", len(sl.skills)).Msg("Skills loaded")
	return sl, nil
}

// GetSkill returns the content of a skill file.
func (sl *SkillLoader) GetSkill(name string) (string, error) {
	text, ok := sl.skills[name]
	if !ok {
		return "", fmt.Errorf("unknown skill: %s", name)
	}
	return text, nil
}

func formatCriteria(cf criteriaFile) string {
	var b strings.Builder
	for _, cat := range cf.Categories {
		fmt.Fprintf(&b, "\n[%s]\n", cat.Name)
		for _, c := range cat.Criteria {
			marker := ""
			if c.Required {
				marker = " (required)"
			}
			fmt.Fprintf(&b, "- key=`%s`: %s%s\n", c.ID, c.Description, marker)
		}
	}
	return b.String()
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

// SummarizeConversation uses a cheap/fast model to summarize a conversation for long-term memory.
func (g *GeminiClient) SummarizeConversation(ctx context.Context, messages []ChatMessage) (string, error) {
	if len(messages) == 0 {
		return "", nil
	}

	var convo strings.Builder
	for _, msg := range messages {
		fmt.Fprintf(&convo, "%s: %s\n", msg.Role, msg.Content)
	}

	prompt := "Summarize this fitness coaching conversation in 2-3 sentences. Capture the key facts shared (sport, goals, program decisions, user preferences). Be brief and factual.\n\n" + convo.String()

	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{genai.NewPartFromText(prompt)}},
	}

	resp, err := g.client.Models.GenerateContent(ctx, cheapModel, contents, nil)
	if err != nil {
		return "", fmt.Errorf("summarize conversation: %w", err)
	}

	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return "", fmt.Errorf("no summary generated")
	}

	return extractText(resp.Candidates[0].Content.Parts), nil
}

func (g *GeminiClient) StreamChat(ctx context.Context, systemPrompt string, messages []ChatMessage) (<-chan string, error) {
	contents := messagesToContents(messages)

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

		for resp, err := range g.client.Models.GenerateContentStream(ctx, model, contents, config) {
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

// ChatWithTools handles a conversation turn that may involve function calling.
// It uses non-streaming GenerateContent for tool-calling rounds, then streams the final text response.
// Returns the full assistant text response and any tool calls that were made.
func (g *GeminiClient) ChatWithTools(
	ctx context.Context,
	systemPrompt string,
	messages []ChatMessage,
	tools []*genai.Tool,
	executeTool func(name string, args map[string]any) (any, error),
	notifyToolCall ToolCallNotifier,
	sendChunk func(text string) error,
) (string, []ToolCallInfo, error) {
	contents := messagesToContents(messages)

	if len(contents) == 0 || contents[len(contents)-1].Role != "user" {
		return "", nil, fmt.Errorf("last message must be from user")
	}

	var (
		maxOutputTokens int32 = 65536
		thinkingBudget  int32 = 8192
	)
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText(systemPrompt)},
		},
		Tools:           tools,
		MaxOutputTokens: maxOutputTokens,
		ThinkingConfig: &genai.ThinkingConfig{
			ThinkingBudget: &thinkingBudget,
		},
	}

	var toolNames []string
	for _, t := range tools {
		for _, fd := range t.FunctionDeclarations {
			toolNames = append(toolNames, fd.Name)
		}
	}

	contentChars := len(systemPrompt)
	for _, c := range contents {
		for _, p := range c.Parts {
			contentChars += len(p.Text)
		}
	}
	log.Debug().
		Int("history_len", len(contents)).
		Int("total_chars", contentChars).
		Strs("available_tools", toolNames).
		Msg("Starting Gemini ChatWithTools")

	var toolCalls []ToolCallInfo
	var hasProposal bool
	var retried bool
	maxRounds := 10

	for round := 0; round < maxRounds; round++ {
		roundChars := 0
		for _, c := range contents {
			for _, p := range c.Parts {
				roundChars += len(p.Text)
			}
		}
		log.Debug().
			Int("round", round).
			Int("contents_len", len(contents)).
			Int("contents_chars", roundChars).
			Msg("ChatWithTools: sending GenerateContent request")

		resp, err := g.client.Models.GenerateContent(ctx, model, contents, config)
		if err != nil {
			log.Error().Err(err).Int("round", round).Msg("ChatWithTools: GenerateContent failed")
			return "", toolCalls, fmt.Errorf("generate content round %d: %w", round, err)
		}

		if len(resp.Candidates) == 0 {
			log.Warn().Int("round", round).Msg("ChatWithTools: no candidates returned")
			return "", toolCalls, fmt.Errorf("no candidates in round %d", round)
		}

		candidate := resp.Candidates[0]
		finishReason := string(candidate.FinishReason)

		// Log token usage when available
		respLog := log.Debug().
			Int("round", round).
			Str("finish_reason", finishReason).
			Int("parts_count", countParts(candidate.Content))
		if resp.UsageMetadata != nil {
			respLog = respLog.Int32("prompt_tokens", resp.UsageMetadata.PromptTokenCount)
			respLog = respLog.Int32("output_tokens", resp.UsageMetadata.CandidatesTokenCount)
			respLog = respLog.Int32("thinking_tokens", resp.UsageMetadata.ThoughtsTokenCount)
			respLog = respLog.Int32("total_tokens", resp.UsageMetadata.TotalTokenCount)
		}
		respLog.Msg("ChatWithTools: received response")

		// Handle malformed function calls — Gemini tried to call a tool but produced
		// invalid JSON (usually because the output was too large, e.g. regenerating
		// a 19-week program). Retry without tools so Grit can at least respond in text.
		isMalformed := finishReason == "MALFORMED_FUNCTION_CALL"
		isEmpty := candidate.Content == nil || len(candidate.Content.Parts) == 0

		if isMalformed || isEmpty {
			log.Warn().
				Int("round", round).
				Str("finish_reason", finishReason).
				Bool("malformed", isMalformed).
				Bool("empty", isEmpty).
				Msg("ChatWithTools: empty or malformed content")

			// For empty responses (not malformed), retry once with the same config.
			// Empty responses with STOP and 0 output tokens are usually transient Gemini glitches.
			if isEmpty && !isMalformed && !retried {
				retried = true
				log.Debug().Int("round", round).Msg("ChatWithTools: retrying same request after empty response")
				continue
			}

			log.Warn().Int("round", round).Msg("ChatWithTools: attempting no-tools fallback")

			// Fallback: retry without tools so the model can respond in plain text.
			fallbackConfig := &genai.GenerateContentConfig{
				SystemInstruction: config.SystemInstruction,
				MaxOutputTokens:   config.MaxOutputTokens,
			}
			fallbackContents := messagesToContents(messages)
			hint := "[System: Your previous attempt to respond failed (empty or malformed output). " +
				"Please respond in plain text instead of using tool calls. " +
				"If you were about to create a program proposal, tell the user you're ready and " +
				"ask them to confirm so you can try again, or describe what you would include.]"
			if isMalformed {
				hint = "[System: Your previous tool call failed because the output was too large. " +
					"Please respond in text instead. If you were trying to modify a program proposal, " +
					"describe what changes you would make and ask the user if they'd like you to save " +
					"the program first and then apply adjustments.]"
			}
			fallbackContents = append(fallbackContents, &genai.Content{
				Role:  "user",
				Parts: []*genai.Part{genai.NewPartFromText(hint)},
			})
			fallbackResp, fbErr := g.client.Models.GenerateContent(ctx, model, fallbackContents, fallbackConfig)
			if fbErr == nil && len(fallbackResp.Candidates) > 0 && fallbackResp.Candidates[0].Content != nil {
				fullText := extractText(fallbackResp.Candidates[0].Content.Parts)
				if fullText != "" {
					if sendChunk != nil {
						_ = sendChunk(fullText)
					}
					log.Debug().Str("response", truncate(fullText, 300)).Msg("ChatWithTools: fallback response succeeded")
					return fullText, toolCalls, nil
				}
			}
			if fbErr != nil {
				log.Error().Err(fbErr).Msg("ChatWithTools: fallback also failed")
			}

			return "", toolCalls, fmt.Errorf("empty response in round %d (finish_reason: %s)", round, finishReason)
		}

		var functionCalls []*genai.FunctionCall
		var textParts []string
		for _, part := range resp.Candidates[0].Content.Parts {
			if part.FunctionCall != nil {
				functionCalls = append(functionCalls, part.FunctionCall)
			}
			if part.Text != "" {
				textParts = append(textParts, truncate(part.Text, 100))
			}
		}

		log.Debug().
			Int("round", round).
			Int("function_calls", len(functionCalls)).
			Strs("text_parts_preview", textParts).
			Bool("has_proposal", hasProposal).
			Msg("ChatWithTools: parsed response parts")

		if len(functionCalls) == 0 {
			fullText := extractText(resp.Candidates[0].Content.Parts)

			// If no tool calls happened (round 0), re-stream for token-by-token UX.
			// If tool calls happened, we already have the text — send directly to avoid
			// a second API call and double token usage.
			if len(toolCalls) == 0 && sendChunk != nil {
				log.Debug().Msg("ChatWithTools: re-streaming final response (no tool calls)")
				streamConfig := &genai.GenerateContentConfig{
					SystemInstruction: config.SystemInstruction,
				}
				var streamed strings.Builder
				var streamChunks int
				for streamResp, streamErr := range g.client.Models.GenerateContentStream(ctx, model, contents, streamConfig) {
					if streamErr != nil {
						log.Error().Err(streamErr).Int("chunks_received", streamChunks).Msg("ChatWithTools: stream error, falling back")
						if fullText != "" {
							_ = sendChunk(fullText)
						}
						return fullText, toolCalls, nil
					}
					chunk := streamResp.Text()
					if strings.TrimSpace(chunk) != "" {
						streamChunks++
						streamed.WriteString(chunk)
						if err := sendChunk(chunk); err != nil {
							log.Error().Err(err).Msg("ChatWithTools: failed to send stream chunk")
						}
					}
				}
				if streamed.Len() > 0 {
					fullText = streamed.String()
				}
				log.Debug().
					Int("stream_chunks", streamChunks).
					Str("response", truncate(fullText, 300)).
					Msg("ChatWithTools completed (streamed)")
			} else {
				if sendChunk != nil && fullText != "" {
					_ = sendChunk(fullText)
				}
				log.Debug().
					Int("tool_calls", len(toolCalls)).
					Str("response", truncate(fullText, 300)).
					Msg("ChatWithTools completed (direct send after tools)")
			}

			return fullText, toolCalls, nil
		}

		contents = append(contents, resp.Candidates[0].Content)

		var functionResponses []*genai.Part
		for _, fc := range functionCalls {
			if fc.Name == "propose_program" || fc.Name == "propose_adjustment" {
				hasProposal = true
			}

			argsJSON, _ := json.Marshal(fc.Args)
			log.Debug().
				Str("tool", fc.Name).
				Int("round", round).
				RawJSON("args", argsJSON).
				Msg("ChatWithTools: executing tool call")

			if notifyToolCall != nil {
				notifyToolCall(fc.Name, "calling")
			}

			result, err := executeTool(fc.Name, fc.Args)

			info := ToolCallInfo{Name: fc.Name}
			if err != nil {
				log.Error().Err(err).Str("tool", fc.Name).Int("round", round).Msg("ChatWithTools: tool execution failed")
				info.Error = err.Error()
				result = map[string]any{"error": err.Error()}
			}
			toolCalls = append(toolCalls, info)

			resultMap, err := toMap(result)
			if err != nil {
				resultMap = map[string]any{"result": fmt.Sprintf("%v", result)}
			}

			resultJSON, _ := json.Marshal(resultMap)
			log.Debug().
				Str("tool", fc.Name).
				Int("round", round).
				RawJSON("result", resultJSON).
				Msg("ChatWithTools: tool call completed")

			functionResponses = append(functionResponses, &genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					Name:     fc.Name,
					Response: resultMap,
				},
			})

			if notifyToolCall != nil {
				notifyToolCall(fc.Name, "completed")
			}
		}

		log.Debug().
			Int("round", round).
			Int("function_responses", len(functionResponses)).
			Msg("ChatWithTools: appending function responses, continuing to next round")

		contents = append(contents, &genai.Content{
			Role:  "user",
			Parts: functionResponses,
		})
	}

	log.Error().
		Int("max_rounds", maxRounds).
		Int("total_tool_calls", len(toolCalls)).
		Msg("ChatWithTools: exceeded maximum tool call rounds")
	return "", toolCalls, fmt.Errorf("exceeded maximum tool call rounds (%d)", maxRounds)
}

type ToolCallInfo struct {
	Name  string `json:"name"`
	Error string `json:"error,omitempty"`
}

func messagesToContents(messages []ChatMessage) []*genai.Content {
	contents := make([]*genai.Content, 0, len(messages))
	for _, msg := range messages {
		role := msg.Role
		switch role {
		case "assistant":
			role = "model"
		case "system":
			// Gemini only accepts "user" and "model" roles.
			// System messages (edit notifications, tool call summaries) are sent as user context.
			role = "user"
		}

		// Gemini requires alternating user/model turns.
		// Merge consecutive same-role messages into one content block.
		if len(contents) > 0 && contents[len(contents)-1].Role == role {
			contents[len(contents)-1].Parts = append(
				contents[len(contents)-1].Parts,
				genai.NewPartFromText(msg.Content),
			)
		} else {
			contents = append(contents, &genai.Content{
				Role: role,
				Parts: []*genai.Part{
					genai.NewPartFromText(msg.Content),
				},
			})
		}
	}
	return contents
}

func extractText(parts []*genai.Part) string {
	var b strings.Builder
	for _, p := range parts {
		b.WriteString(p.Text)
	}
	return b.String()
}

func toMap(v any) (map[string]any, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func countParts(c *genai.Content) int {
	if c == nil {
		return 0
	}
	return len(c.Parts)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

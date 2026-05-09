package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/template"
	"time"

	"github.com/grittyfitness/api/internal/chat"
	appconfig "github.com/grittyfitness/api/internal/config"
	"github.com/rs/zerolog/log"
	"google.golang.org/genai"
)

const model = "gemini-3-flash-preview"
const cheapModel = "gemini-3.1-flash-lite-preview"

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

// PromptLoader loads composable system prompt templates and renders them per conversation mode.
type PromptLoader struct {
	templates         map[string]*template.Template // "base", "general_coaching", "program_create", "program_modify", "review"
	formattedCriteria string
	reviewPrompt      string // raw template for post-workout reviews (filled via strings.ReplaceAll)
	missedPrompt      string // raw template for missed workout check-ins
}

// LoadPrompts reads the composable system prompt templates and questions.json from the given directory.
func LoadPrompts(dir string) (*PromptLoader, error) {
	templateFiles := map[string]string{
		"base":              "system_base.md",
		"general_coaching":  "system_general_coaching.md",
		"program_create":    "system_program_create.md",
		"program_modify":    "system_program_modify.md",
		"review":            "system_review_context.md",
	}

	templates := make(map[string]*template.Template, len(templateFiles))
	for key, filename := range templateFiles {
		data, err := os.ReadFile(filepath.Join(dir, filename))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", filename, err)
		}
		tmpl, err := template.New(key).Parse(string(data))
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", filename, err)
		}
		templates[key] = tmpl
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

	// Load review prompt templates (raw strings, not Go templates)
	reviewPromptBytes, err := os.ReadFile(filepath.Join(dir, "review_post_workout.md"))
	if err != nil {
		return nil, fmt.Errorf("read review_post_workout.md: %w", err)
	}
	missedPromptBytes, err := os.ReadFile(filepath.Join(dir, "review_missed_workout.md"))
	if err != nil {
		return nil, fmt.Errorf("read review_missed_workout.md: %w", err)
	}

	log.Info().Str("prompts_dir", dir).Int("templates", len(templates)).Msg("System prompt templates loaded")
	return &PromptLoader{
		templates:         templates,
		formattedCriteria: formatCriteria(cf),
		reviewPrompt:      string(reviewPromptBytes),
		missedPrompt:      string(missedPromptBytes),
	}, nil
}

// ReviewPrompt returns the raw post-workout review prompt template.
func (pl *PromptLoader) ReviewPrompt() string { return pl.reviewPrompt }

// MissedPrompt returns the raw missed-workout check-in prompt template.
func (pl *PromptLoader) MissedPrompt() string { return pl.missedPrompt }

// BuildSystemPromptForMode renders the base template plus the mode-specific section.
func (pl *PromptLoader) BuildSystemPromptForMode(p PromptParams, mode string) string {
	var buf bytes.Buffer
	if err := pl.templates["base"].Execute(&buf, p); err != nil {
		log.Error().Err(err).Msg("Failed to render base system prompt")
		return ""
	}

	var modeKey string
	switch mode {
	case "general_coaching":
		modeKey = "general_coaching"
	case "program_creation":
		modeKey = "program_create"
		p.Criteria = pl.formattedCriteria
	case "program_management":
		modeKey = "program_modify"
	case "workout_review":
		modeKey = "review"
	default:
		modeKey = "general_coaching"
	}

	if tmpl, ok := pl.templates[modeKey]; ok {
		buf.WriteString("\n\n---\n\n")
		if err := tmpl.Execute(&buf, p); err != nil {
			log.Error().Err(err).Str("mode", mode).Msg("Failed to render mode template")
		}
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

// Names returns a sorted list of all loaded skill names.
func (sl *SkillLoader) Names() []string {
	names := make([]string, 0, len(sl.skills))
	for k := range sl.skills {
		names = append(names, k)
	}
	sort.Strings(names)
	return names
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

// GenerateContent performs a single non-streaming generation with the given contents and config.
// Returns the text response.
func (g *GeminiClient) GenerateContent(ctx context.Context, contents []*genai.Content, config *genai.GenerateContentConfig) (string, error) {
	resp, err := g.client.Models.GenerateContent(ctx, model, contents, config)
	if err != nil {
		return "", fmt.Errorf("generate content: %w", err)
	}
	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return "", fmt.Errorf("no response generated")
	}
	return extractText(resp.Candidates[0].Content.Parts), nil
}

// GenerateCheap calls the cheap/fast model with a single user prompt and returns the text response.
func (g *GeminiClient) GenerateCheap(ctx context.Context, prompt string) (string, error) {
	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{genai.NewPartFromText(prompt)}},
	}

	resp, err := g.client.Models.GenerateContent(ctx, cheapModel, contents, nil)
	if err != nil {
		return "", fmt.Errorf("cheap generate: %w", err)
	}

	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return "", fmt.Errorf("no response generated")
	}

	return extractText(resp.Candidates[0].Content.Parts), nil
}

// flexHTTPOptions returns HTTPOptions that set the Flex service tier with a 10-minute timeout.
func flexHTTPOptions() *genai.HTTPOptions {
	timeout := 10 * time.Minute
	return &genai.HTTPOptions{
		Headers:  http.Header{"X-Server-Timeout": []string{"600"}},
		Timeout:  &timeout,
		ExtraBody: map[string]any{"service_tier": "flex"},
	}
}

// applyFlexTier sets Flex service tier on an existing config, preserving all other settings.
func applyFlexTier(config *genai.GenerateContentConfig) *genai.GenerateContentConfig {
	if config == nil {
		config = &genai.GenerateContentConfig{}
	}
	config.HTTPOptions = flexHTTPOptions()
	return config
}

// isFlexRetryable returns true if the error is a transient Flex capacity issue (503/429).
func isFlexRetryable(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "503") || strings.Contains(msg, "429") ||
		strings.Contains(msg, "Service Unavailable") || strings.Contains(msg, "Too Many Requests") ||
		strings.Contains(msg, "RESOURCE_EXHAUSTED")
}

// generateWithFlexRetry executes a generation request using the Flex service tier,
// retrying up to 2 times on transient capacity errors before invoking the fallback.
func (g *GeminiClient) generateWithFlexRetry(
	ctx context.Context,
	modelName string,
	contents []*genai.Content,
	flexCfg *genai.GenerateContentConfig,
	logName string,
	fallback func() (string, error),
) (string, error) {
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := g.client.Models.GenerateContent(ctx, modelName, contents, flexCfg)
		if err != nil {
			if isFlexRetryable(err) {
				wait := time.Duration(1<<attempt) * time.Second
				log.Warn().Err(err).Int("attempt", attempt).Dur("backoff", wait).Msgf("Flex %s retryable error", logName)
				time.Sleep(wait)
				continue
			}
			log.Warn().Err(err).Msgf("Flex %s non-retryable error, falling back to Standard", logName)
			return fallback()
		}
		if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
			return "", fmt.Errorf("no response generated (flex)")
		}
		log.Debug().Msgf("Flex %s succeeded", logName)
		return extractText(resp.Candidates[0].Content.Parts), nil
	}

	log.Warn().Msgf("Flex %s exhausted retries, falling back to Standard", logName)
	return fallback()
}

// GenerateContentFlex performs generation using the Flex tier (50% cost reduction, 1-15 min latency).
// Retries up to 2 times on transient Flex errors, then falls back to Standard tier.
func (g *GeminiClient) GenerateContentFlex(ctx context.Context, contents []*genai.Content, config *genai.GenerateContentConfig) (string, error) {
	return g.generateWithFlexRetry(ctx, model, contents, applyFlexTier(config), "GenerateContent", func() (string, error) {
		return g.GenerateContent(ctx, contents, config)
	})
}

// GenerateCheapFlex calls the cheap model with Flex tier (50% cost reduction).
// Retries up to 2 times on transient errors, then falls back to Standard tier.
func (g *GeminiClient) GenerateCheapFlex(ctx context.Context, prompt string) (string, error) {
	contents := []*genai.Content{
		{Role: "user", Parts: []*genai.Part{genai.NewPartFromText(prompt)}},
	}
	return g.generateWithFlexRetry(ctx, cheapModel, contents, applyFlexTier(nil), "GenerateCheap", func() (string, error) {
		return g.GenerateCheap(ctx, prompt)
	})
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

	var maxOutputTokens int32 = 65536
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText(systemPrompt)},
		},
		Tools:           tools,
		MaxOutputTokens: maxOutputTokens,
		ThinkingConfig: &genai.ThinkingConfig{
			ThinkingLevel: genai.ThinkingLevelLow,
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
	var emptyRetries int     // count of retries after empty responses (transient glitch)
	var retriedMalformed bool // retried after a malformed function call (with simplification hint)
	maxRounds := 10
	maxEmptyRetries := 3

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

			// For empty responses (not malformed), retry up to maxEmptyRetries times.
			// Empty responses with STOP and 0 output tokens are usually transient Gemini glitches.
			if isEmpty && !isMalformed && emptyRetries < maxEmptyRetries {
				emptyRetries++
				log.Debug().Int("round", round).Int("attempt", emptyRetries).Msg("ChatWithTools: retrying same request after empty response")
				continue
			}

			// For malformed function calls, retry WITH tools but add a simplification hint.
			// This gives Gemini a second chance to produce a valid (smaller) function call.
			if isMalformed && !retriedMalformed {
				retriedMalformed = true
				log.Debug().Int("round", round).Msg("ChatWithTools: retrying with simplification hint after malformed function call")
				contents = append(contents, &genai.Content{
					Role:  "model",
					Parts: []*genai.Part{genai.NewPartFromText("Let me try that again with a simpler format.")},
				})
				contents = append(contents, &genai.Content{
					Role: "user",
					Parts: []*genai.Part{genai.NewPartFromText(
						"[System: Your previous tool call was malformed (likely too large). " +
							"Simplify: use minimal prescription objects with only essential keys and short values, " +
							"omit optional fields like notes and order_index. Retry the tool call now.]",
					)},
				})
				continue
			}

			log.Warn().Int("round", round).Msg("ChatWithTools: attempting no-tools fallback")

			// Fallback: retry without tools so the model can respond in plain text.
			fallbackConfig := &genai.GenerateContentConfig{
				SystemInstruction: config.SystemInstruction,
				MaxOutputTokens:   config.MaxOutputTokens,
			}
			fallbackContents := messagesToContents(messages)
			const noToolInstruction = "Respond ONLY in natural language. Do NOT output tool calls, function syntax, " +
				"code blocks, or |||TOOL_CODE||| markers under any circumstances. "
			var hint string
			if isMalformed {
				hint = "[System: Your tool call failed because the output was too large. " +
					noToolInstruction +
					"Tell the user you're putting together their program and ask them to send " +
					"a message (like 'go ahead') so you can try again with a more concise format.]"
			} else {
				hint = "[System: Your previous attempt to respond failed (empty or malformed output). " +
					noToolInstruction +
					"If you were about to create a program proposal, tell the user you're ready and " +
					"ask them to confirm so you can try again.]"
			}
			fallbackContents = append(fallbackContents, &genai.Content{
				Role:  "user",
				Parts: []*genai.Part{genai.NewPartFromText(hint)},
			})
			fallbackResp, fbErr := g.client.Models.GenerateContent(ctx, model, fallbackContents, fallbackConfig)
			if fbErr == nil && len(fallbackResp.Candidates) > 0 && fallbackResp.Candidates[0].Content != nil {
				fullText := stripToolCode(extractText(fallbackResp.Candidates[0].Content.Parts))
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

			if sendChunk != nil && fullText != "" {
				_ = sendChunk(fullText)
			}
			log.Debug().
				Int("tool_calls", len(toolCalls)).
				Str("response", truncate(fullText, 300)).
				Msg("ChatWithTools completed")

			return fullText, toolCalls, nil
		}

		contents = append(contents, resp.Candidates[0].Content)

		var functionResponses []*genai.Part
		for _, fc := range functionCalls {
			if fc.Name == "propose_program" || fc.Name == "edit_program" {
				hasProposal = true
			}

			argsEvt := log.Debug().
				Str("tool", fc.Name).
				Int("round", round)
			if appconfig.IsDevelopment() {
				argsJSON, _ := json.Marshal(fc.Args)
				argsEvt = argsEvt.RawJSON("args", argsJSON)
			}
			argsEvt.Msg("ChatWithTools: executing tool call")

			if notifyToolCall != nil {
				notifyToolCall(fc.Name, "calling")
			}

			result, err := executeTool(fc.Name, fc.Args)

			// Mode escalation: abort the turn so the handler can retry with the correct mode.
			var escErr *chat.ErrModeEscalation
			if errors.As(err, &escErr) {
				log.Info().
					Str("tool", escErr.ToolName).
					Str("from_mode", string(escErr.OriginalMode)).
					Str("to_mode", string(escErr.TargetMode)).
					Msg("ChatWithTools: mode escalation triggered, aborting turn")
				return "", toolCalls, escErr
			}

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

			resEvt := log.Debug().
				Str("tool", fc.Name).
				Int("round", round)
			if appconfig.IsDevelopment() {
				resultJSON, _ := json.Marshal(resultMap)
				resEvt = resEvt.RawJSON("result", resultJSON)
			}
			resEvt.Msg("ChatWithTools: tool call completed")

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

// stripToolCode removes leaked Gemini tool-code syntax from a response.
// This can happen when the model is retried without tools but still tries
// to output function calls in its native code execution format.
func stripToolCode(s string) string {
	markers := []string{
		"|||TOOL_CODE|||",
		"```tool_code",
		"```python\nprint(",
	}
	for _, marker := range markers {
		if idx := strings.Index(s, marker); idx >= 0 {
			s = strings.TrimSpace(s[:idx])
		}
	}
	return s
}

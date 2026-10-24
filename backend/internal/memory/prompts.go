package memory

import (
	"fmt"
	"strings"

	"github.com/grittyfitness/api/internal/models"
)

func buildCompletionCheckPrompt(messages []models.ChatMessage) string {
	var convo strings.Builder
	// Use last 10 messages max for the check.
	start := 0
	if len(messages) > 10 {
		start = len(messages) - 10
	}
	for _, m := range messages[start:] {
		fmt.Fprintf(&convo, "%s: %s\n", m.Role, m.Content)
	}

	return `You are analyzing a fitness coaching conversation segment. Determine if this conversation segment is complete.

A segment is COMPLETE if:
- The topic was resolved (question answered, decision made)
- The last assistant message does not contain an unanswered question
- The conversation naturally concluded

A segment is NOT COMPLETE if:
- The assistant asked a question that wasn't answered
- An action was started but not finished (e.g., program creation in progress)
- The user said they'd come back to continue

Messages:
` + convo.String() + `
Respond with JSON only: {"complete": true, "reason": "brief reason"} or {"complete": false, "reason": "brief reason"}`
}

// formatForgottenList renders forgotten facts as a bullet list for LLM prompts.
func formatForgottenList(forgotten []models.ChatFact) string {
	var b strings.Builder
	for _, f := range forgotten {
		fmt.Fprintf(&b, "- %s\n", factLine(f))
	}
	return b.String()
}

func buildSummarizePrompt(segmentType string, messages []models.ChatMessage, forgotten []models.ChatFact) string {
	var convo strings.Builder
	for _, m := range messages {
		fmt.Fprintf(&convo, "%s: %s\n", m.Role, m.Content)
	}

	var forgottenSection string
	if len(forgotten) > 0 {
		forgottenSection = `
The user asked their coach to forget the following. Do NOT extract these (or rewordings of them) as facts and do NOT mention them in the summary. Asking to forget something, or saying it is resolved, is not new information — leave it out entirely. Only extract it if the user reports it again in these messages as new, current information (e.g. a fresh injury).
` + formatForgottenList(forgotten)
	}

	return `Summarize this fitness coaching conversation segment in 1-3 sentences. Also extract any persistent user facts and topic tags.

Segment type: ` + segmentType + `
` + forgottenSection + `
Facts to extract (if mentioned):
- Injuries or pain (type: "injury")
- Health conditions (type: "health_condition")
- Training preferences (type: "preference")
- Goals or goal changes (type: "goal")
- Schedule constraints (type: "schedule_constraint")
- Equipment available (type: "equipment")
- Sport focus changes (type: "sport_focus")

Tags: assign 1-5 short topic tags from this list that describe the conversation:
running, cycling, swimming, strength, mobility, injury, goal, schedule, nutrition, program, review

Messages:
` + convo.String() + `
Respond with JSON only:
{
  "summary": "1-3 sentence summary of what happened",
  "facts": [
    {"type": "injury", "content": "Left knee pain since March 2026, avoiding high impact"}
  ],
  "tags": ["running", "injury"]
}

If no facts are present, return an empty facts array. Always include at least one tag. Be concise and factual.`
}

// buildRedactSummariesPrompt asks the LLM to rewrite session summaries so they no
// longer mention anything the user asked to forget. Summaries are keyed by their
// position in the slice (1-based) so the model never has to copy UUIDs.
func buildRedactSummariesPrompt(forgotten []models.ChatFact, summaries []string) string {
	var list strings.Builder
	for i, s := range summaries {
		fmt.Fprintf(&list, "%d. %s\n", i+1, s)
	}

	return `The user asked their fitness coach to forget the following:
` + formatForgottenList(forgotten) + `
Below are numbered summaries of past coaching sessions. Rewrite every summary that mentions any of the forgotten items so it no longer does, keeping everything else unchanged. If nothing is left once the forgotten content is removed, use an empty string. Leave out summaries that don't mention them.

Summaries:
` + list.String() + `
Respond with JSON only:
{"updates": [{"index": 2, "summary": "rewritten summary"}]}

If no summary mentions the forgotten items, respond with {"updates": []}.`
}

// condensePreferenceThreshold is the character count above which a preference is condensed via LLM.
const condensePreferenceThreshold = 150

func buildCondensePreferencePrompt(content string) string {
	return `Condense the following user preference into a single short sentence (under 100 characters). Keep the core meaning, drop filler and context.

User said: "` + content + `"

Respond with the condensed preference only, no quotes, no JSON.`
}

func buildClassifyPrompt(messageContent string) string {
	return `Classify this user message into a conversation segment type. The user has an AI fitness coach.

Possible types:
- "program_creation" - wants to create a new training program, build a plan, prepare for an event, or start training for something new
- "program_modification" - asks to change, adjust, or modify their current training program
- "injury_health" - mentions injury, pain, illness, or health concern
- "goal_life_change" - mentions changing goals, schedule, sport focus, or life changes affecting training
- "general_coaching" - general question, small talk, or coaching conversation

Examples:
- "Can you build me a running program?" -> {"type": "program_creation"}
- "I want to start training for a half marathon" -> {"type": "program_creation"}
- "Help me include cycling in my training" -> {"type": "program_creation"}
- "Can you move my rest day to Wednesday?" -> {"type": "program_modification"}
- "My knee has been hurting after runs" -> {"type": "injury_health"}
- "How much protein should I eat after a run?" -> {"type": "general_coaching"}

User message: "` + messageContent + `"

Respond with JSON only: {"type": "<one of the types above>"}`
}

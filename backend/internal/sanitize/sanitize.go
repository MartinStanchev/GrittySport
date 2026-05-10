package sanitize

import (
	"strings"
	"unicode"
)

// SanitizeForPrompt strips control characters, escapes prompt boundaries,
// and truncates to maxLen runes.
func SanitizeForPrompt(input string, maxLen int) string {
	// Strip control characters except newline and tab
	var b strings.Builder
	b.Grow(len(input))
	for _, r := range input {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			continue
		}
		b.WriteRune(r)
	}
	s := b.String()

	// Escape triple backticks to prevent breaking out of code blocks
	s = strings.ReplaceAll(s, "```", "'''")

	// Neutralize prompt boundary sequences (case-insensitive prefix match)
	s = neutralizeBoundary(s, "system:")
	s = neutralizeBoundary(s, "user:")
	s = neutralizeBoundary(s, "assistant:")

	// Truncate to maxLen runes
	runes := []rune(s)
	if len(runes) > maxLen {
		runes = runes[:maxLen]
	}

	return string(runes)
}

// neutralizeBoundary replaces occurrences of a boundary keyword at the start of a line.
func neutralizeBoundary(s, boundary string) string {
	lower := strings.ToLower(boundary)
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(strings.ToLower(line))
		if strings.HasPrefix(trimmed, lower) {
			// Insert a zero-width space after the first character to break the pattern
			runes := []rune(line)
			for j := range runes {
				if strings.HasPrefix(strings.ToLower(string(runes[j:])), lower) {
					// Insert ZWS after the colon-bearing prefix
					prefix := string(runes[:j+1])
					rest := string(runes[j+1:])
					lines[i] = prefix + "\u200B" + rest
					break
				}
			}
		}
	}
	return strings.Join(lines, "\n")
}

// SanitizeWorkoutNotes sanitizes workout notes for prompt injection, 500 char limit.
func SanitizeWorkoutNotes(notes string) string {
	return SanitizeForPrompt(notes, 500)
}

// MaxChatMessageChars is the hard cap on user chat message length (in runes).
// Messages over this limit are rejected at the handler layer, not silently truncated.
const MaxChatMessageChars = 4000

// SanitizeChatMessage sanitizes a chat message for prompt injection.
// Length validation happens at the handler layer; the cap here is a defense-in-depth
// fallback at MaxChatMessageChars.
func SanitizeChatMessage(msg string) string {
	return SanitizeForPrompt(msg, MaxChatMessageChars)
}

package memory

import (
	"strings"
	"testing"

	"github.com/grittyfitness/api/internal/models"
)

func TestBuildCompletionCheckPrompt(t *testing.T) {
	messages := []models.ChatMessage{
		{Role: "user", Content: "How should I warm up before a run?"},
		{Role: "assistant", Content: "Start with 5 minutes of brisk walking, then do some dynamic stretches."},
	}

	prompt := buildCompletionCheckPrompt(messages)

	if !strings.Contains(prompt, "COMPLETE") {
		t.Error("prompt should explain what COMPLETE means")
	}
	if !strings.Contains(prompt, "How should I warm up") {
		t.Error("prompt should include message content")
	}
	if !strings.Contains(prompt, "JSON only") {
		t.Error("prompt should request JSON output")
	}
}

func TestBuildCompletionCheckPromptTruncation(t *testing.T) {
	// Create 15 messages; should only use last 10.
	messages := make([]models.ChatMessage, 15)
	for i := range messages {
		messages[i] = models.ChatMessage{Role: "user", Content: "msg " + string(rune('A'+i))}
	}

	prompt := buildCompletionCheckPrompt(messages)

	// First 5 messages should not appear.
	if strings.Contains(prompt, "msg A\n") {
		t.Error("first message should be truncated")
	}
	// Last message should appear.
	if !strings.Contains(prompt, "msg O") {
		t.Error("last message should be included")
	}
}

func TestBuildSummarizePrompt(t *testing.T) {
	messages := []models.ChatMessage{
		{Role: "user", Content: "I want to start training for a marathon."},
		{Role: "assistant", Content: "Great goal! Let me build a program for you."},
	}

	prompt := buildSummarizePrompt("program_creation", messages)

	if !strings.Contains(prompt, "program_creation") {
		t.Error("prompt should include segment type")
	}
	if !strings.Contains(prompt, "marathon") {
		t.Error("prompt should include message content")
	}
	if !strings.Contains(prompt, "facts") {
		t.Error("prompt should mention fact extraction")
	}
}

func TestBuildClassifyPrompt(t *testing.T) {
	prompt := buildClassifyPrompt("My knee has been hurting after runs")

	if !strings.Contains(prompt, "knee has been hurting") {
		t.Error("prompt should include message content")
	}
	if !strings.Contains(prompt, "injury_health") {
		t.Error("prompt should list injury_health as an option")
	}
}

func TestStripCodeFence(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{`{"complete": true}`, `{"complete": true}`},
		{"```json\n{\"complete\": true}\n```", `{"complete": true}`},
		{"```\n{\"complete\": true}\n```", `{"complete": true}`},
		{"  ```json\n{\"a\": 1}\n```  ", `{"a": 1}`},
	}

	for _, tt := range tests {
		result := stripCodeFence(tt.input)
		if result != tt.expected {
			t.Errorf("stripCodeFence(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

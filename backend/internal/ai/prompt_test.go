package ai

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupTestPrompts(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	base := `You are Grit. User: {{.UserName}}. Time: {{.CurrentDateTime}}.
{{if .Memory}}Memory: {{.Memory}}{{end}}`
	create := `# Program Creation
Criteria: {{.Criteria}}
Build a program for the user.`
	modify := `# Program Modification
Modify the user's saved program.`
	review := `# Workout Review
Follow up on the user's workout.`
	questions := `{"categories":[{"name":"Sport","criteria":[{"id":"sport","description":"Primary sport","required":true}]}]}`

	files := map[string]string{
		"system_base.md":           base,
		"system_program_create.md": create,
		"system_program_modify.md": modify,
		"system_review_context.md": review,
		"questions.json":           questions,
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	return dir
}

func TestLoadPrompts(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, err := LoadPrompts(dir)
	if err != nil {
		t.Fatalf("LoadPrompts() error: %v", err)
	}
	if len(pl.templates) != 4 {
		t.Errorf("expected 4 templates, got %d", len(pl.templates))
	}
	for _, key := range []string{"base", "program_create", "program_modify", "review"} {
		if _, ok := pl.templates[key]; !ok {
			t.Errorf("missing template %q", key)
		}
	}
	if pl.formattedCriteria == "" {
		t.Error("formattedCriteria should not be empty")
	}
}

func TestBuildSystemPromptForMode_GeneralCoaching(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, _ := LoadPrompts(dir)

	prompt := pl.BuildSystemPromptForMode(PromptParams{
		UserName:        "Alex",
		CurrentDateTime: "Monday, March 18, 2026",
	}, "general_coaching")

	if !strings.Contains(prompt, "Alex") {
		t.Error("base should render UserName")
	}
	if strings.Contains(prompt, "Program Creation") {
		t.Error("general coaching should NOT include program creation section")
	}
	if strings.Contains(prompt, "Program Modification") {
		t.Error("general coaching should NOT include program modification section")
	}
	if strings.Contains(prompt, "Criteria:") {
		t.Error("general coaching should NOT include criteria")
	}
}

func TestBuildSystemPromptForMode_ProgramCreation(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, _ := LoadPrompts(dir)

	prompt := pl.BuildSystemPromptForMode(PromptParams{
		UserName:        "Alex",
		CurrentDateTime: "Monday, March 18, 2026",
	}, "program_creation")

	if !strings.Contains(prompt, "Alex") {
		t.Error("should render UserName from base")
	}
	if !strings.Contains(prompt, "Program Creation") {
		t.Error("should include program creation section")
	}
	if !strings.Contains(prompt, "sport") {
		t.Error("should include criteria from questions.json")
	}
	if strings.Contains(prompt, "Program Modification") {
		t.Error("should NOT include program modification section")
	}
}

func TestBuildSystemPromptForMode_ProgramManagement(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, _ := LoadPrompts(dir)

	prompt := pl.BuildSystemPromptForMode(PromptParams{
		UserName:        "Alex",
		CurrentDateTime: "Monday, March 18, 2026",
	}, "program_management")

	if !strings.Contains(prompt, "Program Modification") {
		t.Error("should include program modification section")
	}
	if strings.Contains(prompt, "Program Creation") {
		t.Error("should NOT include program creation section")
	}
}

func TestBuildSystemPromptForMode_WorkoutReview(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, _ := LoadPrompts(dir)

	prompt := pl.BuildSystemPromptForMode(PromptParams{
		UserName:        "Alex",
		CurrentDateTime: "Monday, March 18, 2026",
	}, "workout_review")

	if !strings.Contains(prompt, "Workout Review") {
		t.Error("should include workout review section")
	}
	if strings.Contains(prompt, "Program Creation") {
		t.Error("should NOT include program creation section")
	}
}

func TestStripToolCode(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "no tool code",
			input: "Here is your program, looks great!",
			want:  "Here is your program, looks great!",
		},
		{
			name:  "TOOL_CODE markers",
			input: "I'm ready to create your program.\n|||TOOL_CODE|||print(propose_program(name='Test'))",
			want:  "I'm ready to create your program.",
		},
		{
			name:  "tool_code code block",
			input: "Let me create that.\n```tool_code\nprint(save())\n```",
			want:  "Let me create that.",
		},
		{
			name:  "python print block",
			input: "Sure thing.\n```python\nprint(propose_program(arg='val'))\n```",
			want:  "Sure thing.",
		},
		{
			name:  "only tool code",
			input: "|||TOOL_CODE|||print(propose_program())",
			want:  "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := stripToolCode(tt.input)
			if got != tt.want {
				t.Errorf("stripToolCode() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildSystemPromptForMode_MemoryConditional(t *testing.T) {
	dir := setupTestPrompts(t)
	pl, _ := LoadPrompts(dir)

	withMemory := pl.BuildSystemPromptForMode(PromptParams{
		UserName: "Alex",
		Memory:   "Has a knee injury",
	}, "general_coaching")

	withoutMemory := pl.BuildSystemPromptForMode(PromptParams{
		UserName: "Alex",
	}, "general_coaching")

	if !strings.Contains(withMemory, "knee injury") {
		t.Error("should include memory when provided")
	}
	if strings.Contains(withoutMemory, "Memory:") {
		t.Error("should not render memory block when empty")
	}
}

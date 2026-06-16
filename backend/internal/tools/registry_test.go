package tools

import (
	"testing"

	"github.com/grittyfitness/api/internal/chat"
	"github.com/grittyfitness/api/internal/models"
	"google.golang.org/genai"
)

func newTestRegistry() *Registry {
	reg := NewRegistry()

	// Simulate the mode mapping from RegisterAllTools with stub tools.
	stubs := []struct {
		name  string
		modes []chat.Mode
	}{
		{"read_skill", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"get_user_profile", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation}},
		{"get_active_program", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"set_weekly_effort_goal", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation}},
		{"get_draft_program", []chat.Mode{chat.ModeProgramCreation}},
		{"create_draft_program", []chat.Mode{chat.ModeProgramCreation}},
		{"save_draft_criterion", []chat.Mode{chat.ModeProgramCreation}},
		{"save_draft_phase", []chat.Mode{chat.ModeProgramCreation}},
		{"update_draft_phase", []chat.Mode{chat.ModeProgramCreation}},
		{"delete_draft_phase", []chat.Mode{chat.ModeProgramCreation}},
		{"propose_program", []chat.Mode{chat.ModeProgramCreation}},
		{"start_program_today", []chat.Mode{chat.ModeProgramCreation}},
		{"confirm_program_save", []chat.Mode{chat.ModeProgramCreation}},
		{"begin_program_creation", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeWorkoutReview}},
		{"begin_program_modification", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeWorkoutReview}},
		{"get_program_criteria", []chat.Mode{chat.ModeProgramManagement}},
		{"get_scheduled_activity", []chat.Mode{chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"edit_program", []chat.Mode{chat.ModeProgramManagement}},
		{"confirm_edit", []chat.Mode{chat.ModeProgramManagement}},
		{"save_user_preference", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"forget_memory", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"set_reminder", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"list_reminders", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
		{"cancel_reminder", []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview}},
	}

	for _, s := range stubs {
		reg.Register(&Tool{
			Name:       s.name,
			Modes:      s.modes,
			Parameters: &genai.Schema{Type: genai.TypeObject},
		})
	}
	return reg
}

func toolNames(tools []*genai.Tool) []string {
	var names []string
	for _, t := range tools {
		for _, fd := range t.FunctionDeclarations {
			names = append(names, fd.Name)
		}
	}
	return names
}

func TestProposalStoreAddPhase(t *testing.T) {
	store := NewProposalStore()

	if len(store.GetPhases("user1")) != 0 {
		t.Error("PhaseCount should be 0 for unknown user")
	}

	count := store.AddPhase("user1", models.TemplatePhaseInput{Name: "Base", OrderIndex: 0, DurationWeeks: 4})
	if count != 1 {
		t.Errorf("AddPhase returned %d, want 1", count)
	}

	count = store.AddPhase("user1", models.TemplatePhaseInput{Name: "Build", OrderIndex: 1, DurationWeeks: 4})
	if count != 2 {
		t.Errorf("AddPhase returned %d, want 2", count)
	}

	if len(store.GetPhases("user1")) != 2 {
		t.Errorf("PhaseCount = %d, want 2", len(store.GetPhases("user1")))
	}

	// Phases should be accessible via Get
	proposal, ok := store.Get("user1")
	if !ok {
		t.Fatal("Get should return true after AddPhase")
	}
	if len(proposal.DraftPhases) != 2 {
		t.Errorf("DraftPhases len = %d, want 2", len(proposal.DraftPhases))
	}
	if proposal.DraftPhases[0].Name != "Base" || proposal.DraftPhases[1].Name != "Build" {
		t.Error("Phases should be in insertion order")
	}

	// UpdatePhase replaces by order_index
	err := store.UpdatePhase("user1", 0, models.TemplatePhaseInput{Name: "Base v2", OrderIndex: 0, DurationWeeks: 5})
	if err != nil {
		t.Fatalf("UpdatePhase: %v", err)
	}
	if proposal.DraftPhases[0].Name != "Base v2" || proposal.DraftPhases[0].DurationWeeks != 5 {
		t.Error("UpdatePhase should replace the phase content")
	}

	// UpdatePhase with nonexistent order_index
	if err := store.UpdatePhase("user1", 99, models.TemplatePhaseInput{}); err == nil {
		t.Error("UpdatePhase with bad order_index should error")
	}

	// DeletePhase removes by order_index
	remaining, err := store.DeletePhase("user1", 1)
	if err != nil {
		t.Fatalf("DeletePhase: %v", err)
	}
	if remaining != 1 {
		t.Errorf("DeletePhase returned remaining=%d, want 1", remaining)
	}
	if len(store.GetPhases("user1")) != 1 {
		t.Errorf("PhaseCount after delete = %d, want 1", len(store.GetPhases("user1")))
	}

	// DeletePhase with nonexistent order_index
	if _, err := store.DeletePhase("user1", 99); err == nil {
		t.Error("DeletePhase with bad order_index should error")
	}

	// DeletePhase on unknown user
	if _, err := store.DeletePhase("unknown", 0); err == nil {
		t.Error("DeletePhase on unknown user should error")
	}

	// Set (used by propose_program) replaces the proposal, clearing DraftPhases
	store.Set("user1", &PendingProposal{Type: "program_creation", Program: []byte(`{}`)})
	if len(store.GetPhases("user1")) != 0 {
		t.Error("Set should replace the proposal, clearing DraftPhases")
	}
}

func TestProposalStoreDecompose(t *testing.T) {
	store := NewProposalStore()

	// Simulate post-proposal state: Program JSON exists but DraftPhases is empty.
	programJSON := `{"name":"Test","phases":[{"name":"Base","order_index":0,"duration_weeks":4,"template_week":{"activities":[]}},{"name":"Build","order_index":1,"duration_weeks":3,"template_week":{"activities":[]}}]}`
	store.Set("user1", &PendingProposal{
		Type:    "program_creation",
		Program: []byte(programJSON),
	})

	// UpdatePhase should decompose and work
	err := store.UpdatePhase("user1", 0, models.TemplatePhaseInput{Name: "Base v2", OrderIndex: 0, DurationWeeks: 5})
	if err != nil {
		t.Fatalf("UpdatePhase after propose: %v", err)
	}
	if len(store.GetPhases("user1")) != 2 {
		t.Errorf("PhaseCount after decompose+update = %d, want 2", len(store.GetPhases("user1")))
	}
	p, _ := store.Get("user1")
	if p.DraftPhases[0].Name != "Base v2" {
		t.Errorf("Updated phase name = %q, want 'Base v2'", p.DraftPhases[0].Name)
	}

	// Reset to post-proposal state for delete test
	store.Set("user1", &PendingProposal{
		Type:    "program_creation",
		Program: []byte(programJSON),
	})

	// DeletePhase should decompose and work
	remaining, err := store.DeletePhase("user1", 1)
	if err != nil {
		t.Fatalf("DeletePhase after propose: %v", err)
	}
	if remaining != 1 {
		t.Errorf("DeletePhase returned remaining=%d, want 1", remaining)
	}
}

func TestProposalStoreGetPhases(t *testing.T) {
	store := NewProposalStore()

	// Unknown user returns nil.
	if phases := store.GetPhases("user1"); phases != nil {
		t.Error("GetPhases should return nil for unknown user")
	}

	// Returns DraftPhases when available.
	store.AddPhase("user1", models.TemplatePhaseInput{Name: "Base", OrderIndex: 0, DurationWeeks: 4})
	store.AddPhase("user1", models.TemplatePhaseInput{Name: "Build", OrderIndex: 1, DurationWeeks: 3})
	phases := store.GetPhases("user1")
	if len(phases) != 2 {
		t.Fatalf("GetPhases len = %d, want 2", len(phases))
	}
	if phases[0].Name != "Base" || phases[1].Name != "Build" {
		t.Error("GetPhases should return phases in order")
	}

	// After propose_program (Set replaces proposal), decomposes from Program JSON.
	programJSON := `{"name":"Test","phases":[{"name":"Alpha","order_index":0,"duration_weeks":2,"template_week":{"activities":[{"day_of_week":1,"activity_type":"run"}]}},{"name":"Beta","order_index":1,"duration_weeks":3,"template_week":{"activities":[]}}]}`
	store.Set("user1", &PendingProposal{
		Type:    "program_creation",
		Program: []byte(programJSON),
	})
	phases = store.GetPhases("user1")
	if len(phases) != 2 {
		t.Fatalf("GetPhases after propose len = %d, want 2", len(phases))
	}
	if phases[0].Name != "Alpha" || phases[1].Name != "Beta" {
		t.Errorf("GetPhases after propose = [%s, %s], want [Alpha, Beta]", phases[0].Name, phases[1].Name)
	}
}

func TestGeminiToolsReturnsAll(t *testing.T) {
	reg := newTestRegistry()
	names := toolNames(reg.GeminiTools())
	if len(names) != 24 {
		t.Errorf("GeminiTools() returned %d tools, want 24", len(names))
	}
}

func TestGeminiToolsForMode(t *testing.T) {
	reg := newTestRegistry()

	tests := []struct {
		mode      chat.Mode
		wantCount int
		wantNames []string
	}{
		{
			mode:      chat.ModeGeneralCoaching,
			wantCount: 11,
			wantNames: []string{"read_skill", "get_user_profile", "get_active_program", "set_weekly_effort_goal", "begin_program_creation", "begin_program_modification", "save_user_preference", "forget_memory", "set_reminder", "list_reminders", "cancel_reminder"},
		},
		{
			mode:      chat.ModeProgramCreation,
			wantCount: 18,
			wantNames: []string{"read_skill", "get_user_profile", "get_active_program", "set_weekly_effort_goal", "get_draft_program", "create_draft_program", "save_draft_criterion", "save_draft_phase", "update_draft_phase", "delete_draft_phase", "propose_program", "start_program_today", "confirm_program_save", "save_user_preference", "forget_memory", "set_reminder", "list_reminders", "cancel_reminder"},
		},
		{
			mode:      chat.ModeProgramManagement,
			wantCount: 11,
			wantNames: []string{"read_skill", "get_active_program", "get_program_criteria", "get_scheduled_activity", "edit_program", "confirm_edit", "save_user_preference", "forget_memory", "set_reminder", "list_reminders", "cancel_reminder"},
		},
		{
			mode:      chat.ModeWorkoutReview,
			wantCount: 10,
			wantNames: []string{"read_skill", "get_active_program", "get_scheduled_activity", "begin_program_creation", "begin_program_modification", "save_user_preference", "forget_memory", "set_reminder", "list_reminders", "cancel_reminder"},
		},
	}

	for _, tt := range tests {
		t.Run(string(tt.mode), func(t *testing.T) {
			names := toolNames(reg.GeminiToolsForMode(tt.mode))
			if len(names) != tt.wantCount {
				t.Errorf("GeminiToolsForMode(%s) returned %d tools, want %d: %v", tt.mode, len(names), tt.wantCount, names)
			}
			nameSet := make(map[string]bool)
			for _, n := range names {
				nameSet[n] = true
			}
			for _, want := range tt.wantNames {
				if !nameSet[want] {
					t.Errorf("GeminiToolsForMode(%s) missing tool %q", tt.mode, want)
				}
			}
		})
	}
}

func TestGeminiToolsForMode_UnknownFallsBack(t *testing.T) {
	reg := newTestRegistry()
	names := toolNames(reg.GeminiToolsForMode("unknown_mode"))
	if len(names) != 24 {
		t.Errorf("unknown mode should fall back to all tools, got %d", len(names))
	}
}

func TestExists(t *testing.T) {
	reg := newTestRegistry()

	if !reg.Exists("read_skill") {
		t.Error("Exists(read_skill) should return true")
	}
	if !reg.Exists("create_draft_program") {
		t.Error("Exists(create_draft_program) should return true")
	}
	if reg.Exists("nonexistent_tool") {
		t.Error("Exists(nonexistent_tool) should return false")
	}
}

func TestToolInMode(t *testing.T) {
	reg := newTestRegistry()

	tests := []struct {
		name string
		mode chat.Mode
		want bool
	}{
		{"read_skill", chat.ModeGeneralCoaching, true},
		{"read_skill", chat.ModeProgramCreation, true},
		{"create_draft_program", chat.ModeProgramCreation, true},
		{"create_draft_program", chat.ModeGeneralCoaching, false},
		{"edit_program", chat.ModeProgramManagement, true},
		{"edit_program", chat.ModeWorkoutReview, false},
		{"nonexistent", chat.ModeGeneralCoaching, false},
	}

	for _, tt := range tests {
		t.Run(tt.name+"_"+string(tt.mode), func(t *testing.T) {
			got := reg.ToolInMode(tt.name, tt.mode)
			if got != tt.want {
				t.Errorf("ToolInMode(%q, %s) = %v, want %v", tt.name, tt.mode, got, tt.want)
			}
		})
	}
}

func TestModeForTool(t *testing.T) {
	reg := newTestRegistry()

	// Single-mode tool: create_draft_program is only in program_creation.
	mode, ok := reg.ModeForTool("create_draft_program")
	if !ok || mode != chat.ModeProgramCreation {
		t.Errorf("ModeForTool(create_draft_program) = (%s, %v), want (program_creation, true)", mode, ok)
	}

	// Multi-mode tool: get_scheduled_activity is in program_management (6 tools) and
	// workout_review (3 tools). Should pick workout_review (fewer tools).
	mode, ok = reg.ModeForTool("get_scheduled_activity")
	if !ok || mode != chat.ModeWorkoutReview {
		t.Errorf("ModeForTool(get_scheduled_activity) = (%s, %v), want (workout_review, true)", mode, ok)
	}

	// Nonexistent tool.
	_, ok = reg.ModeForTool("nonexistent")
	if ok {
		t.Error("ModeForTool(nonexistent) should return false")
	}

	// Tool with empty Modes slice: should return false (no escalation target).
	reg.Register(&Tool{
		Name:       "no_mode_tool",
		Modes:      []chat.Mode{},
		Parameters: &genai.Schema{Type: genai.TypeObject},
	})
	_, ok = reg.ModeForTool("no_mode_tool")
	if ok {
		t.Error("ModeForTool(no_mode_tool) should return false for tool with empty Modes")
	}
}

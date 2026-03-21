package chat

import (
	"errors"
	"strings"
	"testing"
)

func TestErrModeEscalation_Error(t *testing.T) {
	err := &ErrModeEscalation{
		ToolName:     "edit_program",
		OriginalMode: ModeGeneralCoaching,
		TargetMode:   ModeProgramManagement,
	}

	msg := err.Error()
	if !strings.Contains(msg, "edit_program") {
		t.Errorf("error message should contain tool name, got: %s", msg)
	}
	if !strings.Contains(msg, string(ModeProgramManagement)) {
		t.Errorf("error message should contain target mode, got: %s", msg)
	}
	if !strings.Contains(msg, string(ModeGeneralCoaching)) {
		t.Errorf("error message should contain original mode, got: %s", msg)
	}
}

func TestErrModeEscalation_ErrorsAs(t *testing.T) {
	original := &ErrModeEscalation{
		ToolName:     "create_draft_program",
		OriginalMode: ModeWorkoutReview,
		TargetMode:   ModeProgramCreation,
	}

	var wrapped error = original

	var target *ErrModeEscalation
	if !errors.As(wrapped, &target) {
		t.Fatal("errors.As should match *ErrModeEscalation")
	}
	if target.ToolName != "create_draft_program" {
		t.Errorf("ToolName = %q, want create_draft_program", target.ToolName)
	}
	if target.TargetMode != ModeProgramCreation {
		t.Errorf("TargetMode = %q, want %q", target.TargetMode, ModeProgramCreation)
	}
}

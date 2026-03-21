package chat

// Mode represents the conversation context that determines which tools and
// prompt sections are loaded for a given chat turn.
type Mode string

const (
	ModeGeneralCoaching   Mode = "general_coaching"
	ModeProgramCreation   Mode = "program_creation"
	ModeProgramManagement Mode = "program_management"
	ModeWorkoutReview     Mode = "workout_review"
)

// ProposalInfo holds the type of a pending proposal for mode detection.
type ProposalInfo struct {
	Type string // "program_creation", "program_edit"
}

// ModeContext carries the signals used by DetectMode to determine the conversation mode.
type ModeContext struct {
	ActiveDraftID     string
	PendingProposal   *ProposalInfo
	ActiveSegmentType string
	CurrentMode       Mode
}

// ModeResult contains the detected mode and the source signal that determined it.
type ModeResult struct {
	Mode   Mode
	Source string // "state", "proposal", "segment", "previous", "default"
}

// DetectMode determines the conversation mode from session state using a priority chain.
// This is pure Go logic with zero latency — no LLM calls.
func DetectMode(ctx ModeContext) ModeResult {
	// Priority 1: Active state signals (always correct).
	if ctx.ActiveDraftID != "" {
		return ModeResult{Mode: ModeProgramCreation, Source: "state"}
	}
	if ctx.PendingProposal != nil {
		switch ctx.PendingProposal.Type {
		case "program_creation":
			return ModeResult{Mode: ModeProgramCreation, Source: "proposal"}
		case "program_edit":
			return ModeResult{Mode: ModeProgramManagement, Source: "proposal"}
		}
	}

	// Priority 2: Active segment continuation.
	switch ctx.ActiveSegmentType {
	case "program_creation":
		return ModeResult{Mode: ModeProgramCreation, Source: "segment"}
	case "program_modification":
		return ModeResult{Mode: ModeProgramManagement, Source: "segment"}
	case "post_workout_review", "missed_workout_checkin":
		return ModeResult{Mode: ModeWorkoutReview, Source: "segment"}
	}

	// Priority 3: Persisted mode from previous turn.
	if ctx.CurrentMode != "" {
		return ModeResult{Mode: ctx.CurrentMode, Source: "previous"}
	}

	// Priority 4: Default.
	return ModeResult{Mode: ModeGeneralCoaching, Source: "default"}
}

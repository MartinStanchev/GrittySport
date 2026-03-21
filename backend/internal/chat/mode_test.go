package chat

import "testing"

func TestDetectMode(t *testing.T) {
	tests := []struct {
		name       string
		ctx        ModeContext
		wantMode   Mode
		wantSource string
	}{
		{
			name:       "empty context defaults to general coaching",
			ctx:        ModeContext{},
			wantMode:   ModeGeneralCoaching,
			wantSource: "default",
		},
		{
			name:       "active draft yields program creation",
			ctx:        ModeContext{ActiveDraftID: "draft-123"},
			wantMode:   ModeProgramCreation,
			wantSource: "state",
		},
		{
			name:       "pending creation proposal yields program creation",
			ctx:        ModeContext{PendingProposal: &ProposalInfo{Type: "program_creation"}},
			wantMode:   ModeProgramCreation,
			wantSource: "proposal",
		},
		{
			name:       "pending edit proposal yields program management",
			ctx:        ModeContext{PendingProposal: &ProposalInfo{Type: "program_edit"}},
			wantMode:   ModeProgramManagement,
			wantSource: "proposal",
		},
		{
			name:       "segment program_creation yields program creation",
			ctx:        ModeContext{ActiveSegmentType: "program_creation"},
			wantMode:   ModeProgramCreation,
			wantSource: "segment",
		},
		{
			name:       "segment program_modification yields program management",
			ctx:        ModeContext{ActiveSegmentType: "program_modification"},
			wantMode:   ModeProgramManagement,
			wantSource: "segment",
		},
		{
			name:       "segment post_workout_review yields workout review",
			ctx:        ModeContext{ActiveSegmentType: "post_workout_review"},
			wantMode:   ModeWorkoutReview,
			wantSource: "segment",
		},
		{
			name:       "segment missed_workout_checkin yields workout review",
			ctx:        ModeContext{ActiveSegmentType: "missed_workout_checkin"},
			wantMode:   ModeWorkoutReview,
			wantSource: "segment",
		},
		{
			name:       "persisted mode is returned when no stronger signal",
			ctx:        ModeContext{CurrentMode: ModeProgramManagement},
			wantMode:   ModeProgramManagement,
			wantSource: "previous",
		},
		{
			name:       "general_coaching segment falls through to default",
			ctx:        ModeContext{ActiveSegmentType: "general_coaching"},
			wantMode:   ModeGeneralCoaching,
			wantSource: "default",
		},
		// Priority tests: higher priority signals win.
		{
			name: "draft overrides segment type",
			ctx: ModeContext{
				ActiveDraftID:     "draft-456",
				ActiveSegmentType: "program_modification",
			},
			wantMode:   ModeProgramCreation,
			wantSource: "state",
		},
		{
			name: "proposal overrides segment type",
			ctx: ModeContext{
				PendingProposal:   &ProposalInfo{Type: "program_edit"},
				ActiveSegmentType: "program_creation",
			},
			wantMode:   ModeProgramManagement,
			wantSource: "proposal",
		},
		{
			name: "segment overrides persisted mode",
			ctx: ModeContext{
				ActiveSegmentType: "post_workout_review",
				CurrentMode:       ModeProgramCreation,
			},
			wantMode:   ModeWorkoutReview,
			wantSource: "segment",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectMode(tt.ctx)
			if got.Mode != tt.wantMode {
				t.Errorf("DetectMode().Mode = %q, want %q", got.Mode, tt.wantMode)
			}
			if got.Source != tt.wantSource {
				t.Errorf("DetectMode().Source = %q, want %q", got.Source, tt.wantSource)
			}
		})
	}
}

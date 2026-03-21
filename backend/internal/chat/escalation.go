package chat

import "fmt"

// ErrModeEscalation signals that the model tried to call a tool not available
// in the current mode but present in the full registry. The caller should
// retry the turn with TargetMode.
type ErrModeEscalation struct {
	ToolName     string
	OriginalMode Mode
	TargetMode   Mode
}

func (e *ErrModeEscalation) Error() string {
	return fmt.Sprintf("mode escalation: tool %q requires mode %s (was %s)",
		e.ToolName, e.TargetMode, e.OriginalMode)
}

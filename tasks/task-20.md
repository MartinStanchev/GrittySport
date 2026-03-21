# Task 20: Composable System Prompt

## Summary
Split the monolithic `system.md` (261 lines) into composable sections that are assembled per conversation mode, reducing system prompt tokens by ~65% for general coaching messages.

## Context
Currently every message gets the full system prompt including program creation rules (lines 50-177) and program modification rules (lines 180-261), even when the user is just chatting. This wastes ~2000 tokens per general coaching message.

## Requirements

### Split system.md into 4 files

**`prompts/system_base.md`** (always loaded, ~48 lines):
- Grit personality and tone
- User context template variables (name, datetime, timezone, units, memory)
- Sport knowledge skills section
- Quick replies format
- Markdown formatting rules
- Internal error handling rules

**`prompts/system_program_create.md`** (loaded in `program_creation` mode, ~127 lines):
- Draft program flow (incremental saving)
- One program per conversation rule
- Conversation rules (one question per message, under 100 words)
- Criteria to fulfil section (with `{{.Criteria}}` template variable)
- Cross-training section
- Program generation instructions
- Starting today vs next Monday
- Modifying a proposed program
- Prescription format reference

**`prompts/system_program_modify.md`** (loaded in `program_management` mode, ~82 lines):
- Program modification flow (propose/confirm)
- Choosing the right tool (recurring vs one-off)
- `add_week_activity` and `propose_program_modification` usage
- Modification actions reference
- Day numbering, activity type filtering, phase targeting
- Criteria edit response rules

**`prompts/system_review_context.md`** (loaded in `workout_review` mode, ~20 lines, new):
- How to handle post-workout review follow-ups
- Brief guidance on discussing workout results, suggesting adjustments
- When to transition to program modification mode

### Update PromptLoader
- Load all 4 template files on startup
- Add `BuildSystemPromptForMode(params PromptParams, mode string) string` that concatenates base + mode-specific sections
- The `{{.Criteria}}` template variable only needs to render in `program_creation` mode
- Keep existing `BuildSystemPrompt` as backward-compatible wrapper (loads all sections)

### Chat handler update
- Pass the detected mode (from Task 19) to the prompt builder

## Files to modify
- `backend/prompts/system.md` - Split into 4 files (then delete original)
- New: `backend/prompts/system_base.md`
- New: `backend/prompts/system_program_create.md`
- New: `backend/prompts/system_program_modify.md`
- New: `backend/prompts/system_review_context.md`
- `backend/internal/ai/gemini.go` - Update `PromptLoader` to load multiple templates and compose by mode
- `backend/internal/handlers/chat.go` - Pass mode to prompt builder

## Dependencies
- Task 19 (mode detection provides the mode value)

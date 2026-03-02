## Unified System Prompt with On-Demand Skills — Done
- **Replaced 3 context-based prompts with 1 unified prompt + skills**: Deleted `free_chat.txt`, `program_creation.txt`, `criteria_edit.txt`. New `backend/prompts/system.md` (unified) + `backend/prompts/skills/program_creation.md` and `criteria_edit.md` (on-demand skills).
- **`read_skill` tool**: New Gemini function-calling tool that Grit calls to load skill instructions when it detects user intent (e.g., "create a program"). `SkillLoader` in `ai/gemini.go` loads `.md` skill files at startup and renders `{{.Criteria}}` from `questions.json`.
- **Simplified `PromptLoader`**: Removed `BuildFreeChatPrompt`/`BuildProgramCreationPrompt`/`BuildCriteriaEditPrompt`, replaced with single `BuildSystemPrompt`. Removed `ProgramContext` field from `PromptParams` (Grit fetches program data on demand via `get_active_program` tool).
- **Removed chat contexts**: Backend no longer switches prompts based on context. All messages saved with `context="chat"` (single stream). Frontend removed `chatContext` state, `chatContextRef`, and context parameters from `sendMessage`/`respondToProposal`/`clearChat`.
- **`ProgramContext.tsx`**: `openChatRequest` simplified from `string` to `boolean`.
- **Deviation**: Users can now say "create me a program" in free chat and Grit handles it directly via skill loading, instead of being told to tap a button.

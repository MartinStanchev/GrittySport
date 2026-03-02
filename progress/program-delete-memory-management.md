## Program Delete in Detail View + Grit Memory Management — Done
- **Backend**: `ClearMemory` service method + `DELETE /api/v1/chat/memory` endpoint wipes all `chat_memory` rows for a user. `clearChatMemory()` added to `api.ts`.
- **ProgramDetailScreen**: Trash icon in header (set via `navigation.setOptions` headerRight). Tapping shows delete confirmation; after deletion refreshes ProgramContext and offers "Clear Grit's Memory?" prompt so Grit starts fresh with the new program.
- **ProgramsScreen**: Delete flow now also calls `offerMemoryClear()` after successful deletion.
- **SettingsScreen**: New "Grit AI" section with "Clear Grit's Memory" button + explanation text + confirmation dialog. Memory is gated (feature flag) but the clear endpoint always works.
- **Architecture note**: `chat_memory` is per `(user_id, context)`, not per-program — clearing all memory is the correct approach when a program is deleted, since summaries may reference program-specific details that would mislead Grit after deletion.

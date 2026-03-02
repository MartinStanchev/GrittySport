# Progress Index

Full details for each change are in the `progress/` folder.

| File | Summary |
|------|---------|
| [task-01-scaffolding](progress/task-01-scaffolding.md) | Expo + Go scaffolding, Docker Compose, chi router |
| [task-02-auth](progress/task-02-auth.md) | JWT auth, register/login, SecureStore, token rotation |
| [bug-fix-registration-login](progress/bug-fix-registration-login.md) | CORS middleware, env-based API URL, web SecureStore shim |
| [task-03-user-profile](progress/task-03-user-profile.md) | User profile API, timezone, units preference, Settings screen |
| [task-04-chat](progress/task-04-chat.md) | Grit chat via WebSocket, streaming, Gemini integration |
| [task-05-programs](progress/task-05-programs.md) | Programs DB, tool calling, program creation via chat |
| [task-06-program-creation](progress/task-06-program-creation.md) | Streaming fix, prompt templates, markdown, yes/no replies, chat memory |
| [chat-bug-fixes-proposals-drafts](progress/chat-bug-fixes-proposals-drafts.md) | Proposal JSON fix, draft program tools, tool indicators |
| [feature-flag-chat-memory](progress/feature-flag-chat-memory.md) | ENABLE_CHAT_MEMORY env var gate |
| [task-07-activity-detail](progress/task-07-activity-detail.md) | Activity detail screen, manual activity editing, Grit notification |
| [training-plan-ux-overhaul](progress/training-plan-ux-overhaul.md) | Week selector, day-by-day view, post-edit chat redirect |
| [task-08-manual-logging](progress/task-08-manual-logging.md) | Manual workout recording, history screen, FAB entry points |
| [bug-fixes-task-8](progress/bug-fixes-task-8.md) | WorkoutContext, ActiveWorkoutBanner, HomeScreen scroll fix |
| [program-delete-memory-management](progress/program-delete-memory-management.md) | Delete program, clear Grit memory, Settings AI section |
| [log-activity-workout-detail-delete](progress/log-activity-workout-detail-delete.md) | Log past activity, workout detail screen, delete program |
| [bug-fixes-chat-keyboard](progress/bug-fixes-chat-keyboard.md) | KeyboardAvoidingView, unified typing indicator, one-program rule |
| [task-09-gps-tracking](progress/task-09-gps-tracking.md) | GPS recording, maps, BLE HR, offline sync, route polyline |
| [gps-ux-fixes](progress/gps-ux-fixes.md) | Banner crash, map defaults, concurrent guard, activity type selector |
| [task-09-5-gps-workout-fixes](progress/task-09-5-gps-workout-fixes.md) | Workout-program linking, GPS locking, map pan cooldown |
| [gps-bug-fix-testing](progress/gps-bug-fix-testing.md) | Auto-pause fix, accuracy filter, GPS sim, Jest unit tests |
| [unified-system-prompt](progress/unified-system-prompt.md) | Single system prompt + on-demand skill loading via read_skill |
| [fix-program-creation-session-state](progress/fix-program-creation-session-state.md) | Session state tracking, tool call summaries, Gemini role mapping |
| [fix-program-proposal-ws-reconnect](progress/fix-program-proposal-ws-reconnect.md) | MALFORMED_FUNCTION_CALL fallback, modify_pending_proposal tool, WS reconnect fix |
| [phase-based-program-proposal](progress/phase-based-program-proposal.md) | Two-step proposal: skeleton + per-phase population |
| [task-9-6-hr-sensor](progress/task-9-6-hr-sensor.md) | HR sensor modal, cadence detection, live HR chart, workout charts |
| [template-week-proposal](progress/template-week-proposal.md) | Template-week program proposal to avoid token limit failures |
| [date-bug-fix-start-today](progress/date-bug-fix-start-today.md) | DowOffset fix, date field on activities, start-today tool |
| [task-9-7-activity-tracking](progress/task-9-7-activity-tracking.md) | GPS route on detail, multi-activity days, Grit program editing, unread badge |
| [manual-program-creation](progress/manual-program-creation.md) | 3-step wizard for manual program creation, POST /api/v1/programs |
| [program-detail-date-overhaul](progress/program-detail-date-overhaul.md) | MondayOf helper, normalized week dates, upcoming activities fix |
| [grit-prompt-refactor](progress/grit-prompt-refactor.md) | Workflow rules in system prompt, sport knowledge skills |
| [fix-program-modification-flow](progress/fix-program-modification-flow.md) | activity_type_filter, prompt fix for modification flow |

## Instructions for Agents

When implementing a new feature:
1. **Append a new row** to the table above with a link and one-line summary.
2. **Create a new file** in `progress/<slug>.md` with full details (bullet points, deviations, key files changed).

To understand what was done for a specific feature, read its file in `progress/`.

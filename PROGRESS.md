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
| [task-10-apple-health-import](progress/task-10-apple-health-import.md) | Apple Health import: HealthKit integration, Import screen, type mapping, source badges |
| [premium-membership-infrastructure](progress/premium-membership-infrastructure.md) | Free/premium tier, usage limits, input sanitization, chat rate limiting, program gating |
| [fix-program-modification-validation](progress/fix-program-modification-validation.md) | Validate program_id at propose time, add_week_activity tool for single-week changes |
| [task-12-post-workout-review](progress/task-12-post-workout-review.md) | Post-workout AI review, premium analytics (effort/splits/alignment/PRs), missed workout scheduler |
| [task-13-history-screen-improvements](progress/task-13-history-screen-improvements.md) | Pagination, filter chips, date range filter, completion status icons, RPE in strength sets |
| [gpx-file-import](progress/gpx-file-import.md) | GPX file import: file picker, XML parsing, preview screen, 3 entry points |
| [multi-format-workout-import](progress/multi-format-workout-import.md) | Multi-format import: TCX, FIT, CSV, ZIP support with unified preview screen |
| [dark-mode-flat-design](progress/dark-mode-flat-design.md) | Dark mode with settings toggle, flat design replacing card/box patterns across entire app |
| [home-screen-redesign](progress/home-screen-redesign.md) | Home screen redesign: program arc, Grit chat banner, activity dashboard, weekly effort counter |
| [configurable-weekly-effort-goal](progress/configurable-weekly-effort-goal.md) | Task 17: User/Grit-configurable weekly effort goal, replacing hardcoded 300 |
| [segment-based-chat-memory](progress/segment-based-chat-memory.md) | Segment-based chat memory: auto-segmentation, LLM summarization, fact extraction, replaces old chat_memory |
| [conversation-modes](progress/conversation-modes.md) | Tasks 18-20: Mode-based tool/prompt filtering — 4 modes, composable system prompt, ~65% token savings for coaching |
| [mode-escalation](progress/mode-escalation.md) | Task 21: Mode escalation safety net — auto-retries with correct tools when mode detection is wrong |
| [enhanced-memory-retrieval](progress/enhanced-memory-retrieval.md) | Task 22: Mode-aware memory assembly — segment tagging + tag-filtered retrieval per conversation mode |
| [memory-decay](progress/memory-decay.md) | Task 23: Fact auto-expiry (injury 4mo, schedule 3mo) + 20-fact cap in assembly |
| [mode-observability-logging](progress/mode-observability-logging.md) | Task 24: Structured logging for mode detection, tool counts, memory assembly, fact decay |
| [incremental-phase-proposal](progress/incremental-phase-proposal.md) | Incremental phase-based program proposal — save_draft_phase per phase, then lightweight propose_program |

## Instructions for Agents

When implementing a new feature:
1. **Append a new row** to the table above with a link and one-line summary.
2. **Create a new file** in `progress/<slug>.md` with full details (bullet points, deviations, key files changed).

To understand what was done for a specific feature, read its file in `progress/`.

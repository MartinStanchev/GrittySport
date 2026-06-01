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
| [benchmark-driven-prescriptions](progress/benchmark-driven-prescriptions.md) | Benchmark collection (1RM/race times/FTP/CSS) + effort context and standardized RPE across all sport prescriptions |
| [aura-kinetic-proposals-redesign](progress/aura-kinetic-proposals-redesign.md) | Aura Kinetic theme overhaul (both modes) + redesigned proposal cards with full-screen review + Space Grotesk/Inter fonts |
| [home-screen-aura-kinetic-redesign](progress/home-screen-aura-kinetic-redesign.md) | Home screen redesign: hero workout card, quick stats, insight card, streak dots, bottom action bar replacing FAB |
| [live-workout-screen-redesign](progress/live-workout-screen-redesign.md) | Live GPS workout screen redesign with dominant map, HUD metrics, and refreshed recording controls |
| [kinetic-design-language-rollout](progress/kinetic-design-language-rollout.md) | Rolled the newer home/proposal visual system across the rest of the authenticated app and creation flows |
| [activity-edit-screen-refresh](progress/activity-edit-screen-refresh.md) | Refreshed edit/create activity panels so prescription fields and nested cards have clearer surface contrast |
| [gps-map-recenter-north-up](progress/gps-map-recenter-north-up.md) | Live GPS recenter now restores north-up orientation and recenters within the visible map area |
| [collapsed-metric-carousel](progress/collapsed-metric-carousel.md) | Swipeable metric carousel in collapsed GPS pill — time fixed, companion metrics paginate |
| [gps-controls-dock-fix](progress/gps-controls-dock-fix.md) | Always-visible controls dock in collapsed/expanded sheet + hide banner on recording screens |
| [early-skill-loading](progress/early-skill-loading.md) | Early skill loading during program creation — sport-specific intake guidance, 3 new skills (powerlifting, general fitness, triathlon), dynamic enum |
| [context-aware-reviews](progress/context-aware-reviews.md) | Inject user memory (facts) + active program context into automated post-workout and missed-workout reviews |
| [post-workout-review-ux](progress/post-workout-review-ux.md) | Inline post-workout review: poll for AI review after save, quick-reply, continue-in-chat — all 4 save flows |
| [enhanced-workout-analytics](progress/enhanced-workout-analytics.md) | Cardiac efficiency, sport-specific PRs (distance/swim/strength), structured weekly trends, activity type families |
| [daily-schedule-multi-activity](progress/daily-schedule-multi-activity.md) | Multi-activity daily schedule: hero card + compact "next up" rows, completion tracking with green tick, auto-promotion |
| [link-before-review](progress/link-before-review.md) | Link workout to scheduled activity before Grit's review — unified flow in PostWorkoutReview, new trigger endpoint |
| [enriched-edit-proposals](progress/enriched-edit-proposals.md) | Backend edit enrichment with before-state + bifurcated inline/full-screen edit proposal UI |
| [explicit-user-preferences](progress/explicit-user-preferences.md) | Explicit user preferences: save/forget tools, LLM condensing, separate assembly section, 5 free / unlimited premium |
| [flex-inference-tier](progress/flex-inference-tier.md) | Gemini Flex tier for background ops (missed reviews, summarization) — 50% cost reduction with Standard fallback |
| [push-notifications](progress/push-notifications.md) | Task 14: Push notifications via Expo Push API, dynamic type registry, workout reminders, notification preferences |
| [hr-non-gps-and-set-detection](progress/hr-non-gps-and-set-detection.md) | HR sensor support for strength/mobility/drill/indoor workouts + HR-spike-driven next-set highlight |
| [segment-grouped-chat-headers](progress/segment-grouped-chat-headers.md) | Eyebrow headers above Grit-initiated chat threads (reviews, missed check-ins, manual edits) anchored to chat_segments |
| [activity-type-canonicalization](progress/activity-type-canonicalization.md) | Snake_case activity types end-to-end; collapse run sub-flavors into single `run` type with sub-flavor in `notes` |
| [notification-ux-improvements](progress/notification-ux-improvements.md) | Contextual titles, structured JSON post-workout reviews with lock-screen preview, randomized missed-workout bodies, tap-to-open-chat deep linking |
| [offline-mode](progress/offline-mode.md) | Task 15.1: SQLite cache for user/program/upcoming + offline auth fallback (no more spurious logout when network drops) + offline banner |
| [strength-pause-button](progress/strength-pause-button.md) | Pause/Resume button for manual workouts (strength/mobility/drill); pause-aware elapsed timer + frozen mobility countdown and set detection |
| [unified-import-preview](progress/unified-import-preview.md) | Apple Health imports now use the same full-screen preview as file imports (route map, stats, HR chart, link-to-scheduled UI) — bottom sheet removed |
| [linkable-activity-window](progress/linkable-activity-window.md) | New `/activities/linkable` endpoint: ±3 day window, excludes already-linked, same-type-first then date priority [-1,-2,-3,today,+1,+2,+3] |
| [passwordless-auth-otp](progress/passwordless-auth-otp.md) | Phase 1 auth modernization: drop passwords, email OTP via Resend, `auth_identities` table for future SSO/passkey, 6-month sessions, in-memory rate limit |
| [program-detail-week-month-redesign](progress/program-detail-week-month-redesign.md) | Program detail rework: Week/Month tabs, apex load chart, sport-color rows with notes/intensity inline, monthly heatmap calendar; backend exposes `linked_workout_id` on schedule |
| [program-detail-followup-fixes](progress/program-detail-followup-fixes.md) | Calendar cell tap opens ActivityDetail for single-activity days; remove apex chart tap; remove misleading Low/High legend |
| [manual-program-creation-v2](progress/manual-program-creation-v2.md) | 4-step manual program flow: Basics (goal-mode, event chips, race countdown) → Phases (presets, arc bar) → Week template (color-coded, stats footer) → Review (reuses ProposalReviewView); keeps PrescriptionEditor + free-text goal + detailed start date |
| [marketing-website](progress/marketing-website.md) | Marketing single-page site in `web/` (Next.js 16 + Tailwind v4): hero, problem, how-it-works, features, premium (outcome-grouped), FAQ, CTA + Impressum/Datenschutz/AGB skeletons in German |
| [marketing-hero-scrollytelling](progress/marketing-hero-scrollytelling.md) | Hero rebuilt as 3-panel scrollytelling: sticky stage cross-fades home → Grit chat with edit proposal → workout summary; download badges stay pinned; mobile falls back to stacked panels |
| [legal-links-in-settings](progress/legal-links-in-settings.md) | German legal compliance: Impressum/Datenschutzerklärung/AGB links at the bottom of Settings, opening the marketing site via `Linking.openURL`; domain configurable via `EXPO_PUBLIC_WEB_URL` |
| [signup-consent-flow](progress/signup-consent-flow.md) | GDPR signup consent screen: AGB+Datenschutz, health-data (Art. 9), age 16+, optional marketing; `user_consents` audit table with version/IP/UA, denormalized `users.consents_completed_at` gate; `is_new_user` flag from /otp/verify |
| [account-deletion](progress/account-deletion.md) | GDPR Art. 17 self-service delete: typed-confirmation modal in Settings, `DELETE /users/me`, FK cascades purge user data, `user_consents` anonymized via `ON DELETE SET NULL` + IP/UA wipe (Art. 7(1) proof retained) |
| [consent-and-legal-localization](progress/consent-and-legal-localization.md) | Translate consent screen + marketing legal pages to English (universal-GDPR posture, all consents kept for everyone); `agb` → `/terms`, `datenschutz` → `/privacy`; Impressum stays German |
| [security-audit-c1-c5](progress/security-audit-c1-c5.md) | Five critical fixes: workout IDOR, unscoped DELETE in `confirm_program_save`, WS JWT redaction, WS lifetime + deleted-user check, hashed refresh tokens with reuse detection |
| [security-audit-medium-fixes](progress/security-audit-medium-fixes.md) | Backend security audit: PII out of debug logs, fail-fast email config, fail-closed usage quotas, ownership-before-quota in TriggerReview, OTP single-active-row, input range/length validation |
| [eu-compliance-pass](progress/eu-compliance-pass.md) | Pre-launch EU/GDPR pass: verified DOB 16+ gate, sign-out-all-devices, push consent defaults OFF + audit log, AI transparency badges + first-open disclosure, daily retention cron, Art. 15/20 data export |
| [security-audit-low-fixes](progress/security-audit-low-fixes.md) | Five low-sev defense-in-depth fixes: SQL-scope `GetActivityDetail`, pin JWT method to HS256, dummy bcrypt on OTP no-row, env-driven CORS allowlist, reject placeholder/short `JWT_SECRET` at startup |
| [security-audit-batch-2-auth](progress/security-audit-batch-2-auth.md) | Auth-hardening batch: WS CSWSH origin allowlist, per-IP rate limit on `/api/auth/*`, OTP purge on account delete, drop spoofable consent IP helper, FOR UPDATE on OTP read, atomic refresh-consume, `users.token_version` JWT revocation, `RequireConsents` middleware, server-authoritative consent versions + immutable birth_year, `propose_program` ownership check, atomic chat usage UPDATE |
| [chat-monthly-cap-and-input-limit](progress/chat-monthly-cap-and-input-limit.md) | Free chat limit moved from 40/week to 60/month (aligns with other monthly limits); 4000-char per-message cap with explicit rejection (replaces silent truncation); `message_too_long` WS frame surfaced in UI |
| [birth-year-wheel-picker](progress/birth-year-wheel-picker.md) | Replace 4-digit `TextInput` on consent screen with snap-scroll wheel year picker bounded `[currentYear - 100, currentYear - 16]`; bounds enforce 16+ at the UI layer so error/helper validation goes away |
| [health-connect-import](progress/health-connect-import.md) | Android Health Connect import: mirrors Apple Health flow via platform-aware façade; covers Fitbit/Garmin/Samsung/Strava/Whoop/Wear OS via on-device hub; source-agnostic dedupe store |
| [task-28-seo-llm-discoverability](progress/task-28-seo-llm-discoverability.md) | Marketing-site SEO/LLM discoverability: `llms.txt`, `robots.ts` (allowlist incl. CCBot/GPTBot/ClaudeBot/PerplexityBot/Google-Extended), `sitemap.ts`, build-time OG image + favicon via `next/og`, JSON-LD (SoftwareApplication / Organization / FAQPage / PrivacyPolicy / TermsOfService / AboutPage + Person) and an About page |
| [time-bound-reminders](progress/time-bound-reminders.md) | Task 26: user-scheduled reminders via `set_reminder`/`list_reminders`/`cancel_reminder` tools + `UserReminderChecker` (1-min tick) delivering pre-rendered chat message + push, no LLM on delivery path |
| [wishlist-signup](progress/wishlist-signup.md) | Pre-launch waitlist: `WishlistForm` replaces store badges on marketing site; `POST /api/wishlist` persists to `wishlist_signups` + Resend notification to `WISHLIST_NOTIFY_TO`; per-IP rate limit; works from static export |
| [workout-export-and-share](progress/workout-export-and-share.md) | Phase 1 of workout sharing: GPX/TCX file export from `WorkoutDetailScreen` via OS share sheet (Strava/Garmin/AirDrop/etc.); HR+cadence merged into trackpoints by nearest-timestamp lookup; HR-only workouts supported via TCX without Position elements |
| [passive-activity-notification-skip](progress/passive-activity-notification-skip.md) | Workout reminders + missed-workout reviews now skip passive scheduled types (`rest`, `recovery`, `mobility`, `yoga`) via `notifications.PassiveActivityTypes` threaded into `scheduler.go` + `reminder.go` SQL filters — rest days no longer trigger pushes |
| [how-it-works-app-screenshots](progress/how-it-works-app-screenshots.md) | Real in-app screenshots on marketing `/how-it-works`: new `AppShot` phone-card component, 2-up (chat→review) under "Building your program" + 3-up (edit/review/reminder) under "What Grit can do", breaking out wider than the prose column; light variants shown, dark kept for later |
| [cycling-metrics-and-rounding](progress/cycling-metrics-and-rounding.md) | Workout summary screens: km/h + raw distance fields rounded to 2 decimals, cadence label `rpm` for cycling, power (avg/max W) persisted end-to-end, Energy (kJ) + Moving Time + VAM cycling stats, Apple Health importer now extracts laps from `WorkoutEvent` + cycling cadence/power (iOS 17+) |
| [skip-grit-review-option](progress/skip-grit-review-option.md) | `PostWorkoutReview` now lets users skip Grit's review: explicit "Get review / Skip" prompt when no linkable activity (or already linked) and a third "Skip Grit's review" button alongside the link options |
| [mobile-hero-scrollytelling](progress/mobile-hero-scrollytelling.md) | Mobile hero now runs the same scroll-driven 3-panel cross-fade as desktop: one shared `300vh` sticky stage, scaled-down phone (`MOBILE_SCALE`), `PanelText`/`StepDots`/`phoneScreens` dedup, `#download` anchor moved onto `<section>` |
| [seo-content-expansion](progress/seo-content-expansion.md) | SEO/GEO content depth (follow-on to task-28): 3 intent-targeted landing pages (`/ai-running-coach`, `/ai-strength-coach`, `/ai-triathlon-coach`) via shared `UseCaseLanding` + `lib/seo` JSON-LD helper; 3 real `/learn` articles (seed `welcome.md` removed); `/examples` filled with real prose + screenshots; fact-rich `llms-full.txt` + enriched `llms.txt`; sitemap + Footer "Coaching" column |

## Instructions for Agents

When implementing a new feature:
1. **Append a new row** to the table above with a link and one-line summary.
2. **Create a new file** in `progress/<slug>.md` with full details (bullet points, deviations, key files changed).

To understand what was done for a specific feature, read its file in `progress/`.

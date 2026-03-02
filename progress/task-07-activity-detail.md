## Task 7: Activity Detail and Manual Program Editing — Done
- Backend: `ActivityDetailResponse` model with enriched fields (program_id, program_name, phase_name, week_number, calculated date). `GetActivityDetail` service method with JOIN across scheduled_activities→weeks→phases→programs. `UpdateActivity` service method with ownership verification and partial field updates (prescription, notes, day_of_week, activity_type)
- Backend: `GET /api/v1/activities/{activityId}` and `PUT /api/v1/programs/{id}/activities/{activityId}` endpoints. ProgramHandler extended with chatService for system message insertion
- Backend: On manual edit, inserts system message into chat_messages (role=system, context=free_chat) with diff description so Grit is informed of changes
- Frontend: `ActivityDetailScreen` with rich prescription display by activity type (run, interval, strength, swim, cycling, mobility, rest, drill) and inline edit mode with form fields, day-of-week picker, notes editor, confirmation dialog
- Frontend: `PrescriptionDisplay` component for read-only rendering, `PrescriptionEditor` component with type-specific form fields (add/remove exercises, intervals)
- Frontend: `HomeStackNavigator` wrapping HomeScreen so ActivityDetail is reachable from Home tab. ActivityDetail also added to ProgramsStackNavigator
- Frontend: UpcomingActivityCard now tappable (Pressable with chevron), navigates to ActivityDetail from HomeScreen. Activity rows in ProgramDetailScreen also tappable
- Frontend: Shared utilities extracted to `activityIcons.ts` (icon mapping, formatPrescriptionSummary, dayAbbrev, formatActivityDate)
- **Code simplification pass:** Removed duplicated DAY_NAMES/DAY_LABELS and formatPrescription from ProgramDetailScreen and ActivityDetailScreen in favor of shared activityIcons.ts utilities. Simplified UpcomingActivityCard Pressable wrapping. Removed unused parameter from Go buildActivityDiff function

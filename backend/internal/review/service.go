package review

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
	"google.golang.org/genai"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/memory"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/notifications"
	"github.com/grittyfitness/api/internal/services"
)

// Service handles post-workout reviews and missed workout check-ins.
type Service struct {
	pool           *pgxpool.Pool
	chatService    *services.ChatService
	workoutService *services.WorkoutService
	programService *services.ProgramService
	geminiClient   *ai.GeminiClient
	memoryService  *memory.Service
	notifService   *notifications.Service
	reviewPrompt   string
	missedPrompt   string
}

// NewService creates a new review service.
func NewService(
	pool *pgxpool.Pool,
	chatService *services.ChatService,
	workoutService *services.WorkoutService,
	programService *services.ProgramService,
	geminiClient *ai.GeminiClient,
	memoryService *memory.Service,
	notifService *notifications.Service,
	reviewPrompt string,
	missedPrompt string,
) *Service {
	return &Service{
		pool:           pool,
		chatService:    chatService,
		workoutService: workoutService,
		programService: programService,
		geminiClient:   geminiClient,
		memoryService:  memoryService,
		notifService:   notifService,
		reviewPrompt:   reviewPrompt,
		missedPrompt:   missedPrompt,
	}
}

// TriggerReview runs a post-workout AI review for a completed workout.
func (s *Service) TriggerReview(ctx context.Context, userID, workoutID string) error {
	workout, err := s.workoutService.GetByID(ctx, workoutID, userID)
	if err != nil {
		return fmt.Errorf("load workout: %w", err)
	}

	var maxHR int
	var userName string
	var userTZ *string
	err = s.pool.QueryRow(ctx,
		"SELECT max_heart_rate, name, timezone FROM users WHERE id = $1", userID,
	).Scan(&maxHR, &userName, &userTZ)
	if err != nil {
		maxHR = 185
		userName = "there"
	}

	var durationSec float64
	if workout.FinishedAt != nil {
		durationSec = workout.FinishedAt.Sub(workout.StartedAt).Seconds()
	}
	effortScore := ComputeEffortScore(workout.HeartRateData, maxHR, durationSec)
	effortLabel := EffortLabel(effortScore)

	var prescriptionSummary, deviationMetrics string
	if workout.ScheduledActivityID != nil && *workout.ScheduledActivityID != "" {
		prescriptionSummary, deviationMetrics = s.computeAlignmentSummary(
			ctx, *workout.ScheduledActivityID, workout,
		)
	}

	trendSummary := s.loadTrendSummary(ctx, userID, workout.ActivityType)
	recordedDataSummary := buildRecordedDataSummary(workout)
	userMemory := s.assembleUserMemory(ctx, userID)
	programContext := s.buildProgramContext(ctx, userID)

	prompt := s.reviewPrompt
	prompt = strings.ReplaceAll(prompt, "{{.UserName}}", userName)
	prompt = strings.ReplaceAll(prompt, "{{.UserMemory}}", userMemory)
	prompt = strings.ReplaceAll(prompt, "{{.ProgramContext}}", programContext)
	prompt = strings.ReplaceAll(prompt, "{{.ActivityType}}", workout.ActivityType)
	prompt = strings.ReplaceAll(prompt, "{{.PrescriptionSummary}}", prescriptionSummary)
	prompt = strings.ReplaceAll(prompt, "{{.RecordedDataSummary}}", recordedDataSummary)
	prompt = strings.ReplaceAll(prompt, "{{.DeviationMetrics}}", deviationMetrics)
	prompt = strings.ReplaceAll(prompt, "{{.TrendSummary}}", trendSummary)
	prompt = strings.ReplaceAll(prompt, "{{.EffortScore}}", fmt.Sprintf("%d (%s)", effortScore, effortLabel))

	// Call Gemini — structured JSON response (Standard tier: user-facing)
	reviewText, notifPreview, err := s.generatePostWorkoutReview(ctx, prompt)
	if err != nil {
		return fmt.Errorf("generate review: %w", err)
	}

	// Save Grit's review message with workout_id in metadata for polling.
	reviewMeta, _ := json.Marshal(map[string]string{"workout_id": workoutID})
	savedMsg, err := s.chatService.SaveMessage(ctx, userID, "assistant", reviewText, nil, reviewMeta)
	if err != nil {
		return fmt.Errorf("save review message: %w", err)
	}

	// Close any active segment and start a new post-workout review segment,
	// snapshotting workout summary fields for the chat-grouping header.
	header := buildPostWorkoutHeader(workout, durationSec, userTZ)
	s.startReviewSegment(ctx, userID, "post_workout_review", savedMsg.ID, header)

	// Send push notification — title from activity type, body from LLM preview (or template fallback)
	if s.notifService != nil {
		_ = s.notifService.SendToUser(ctx, userID, "post_workout_review", notifications.Payload{
			Title: notifications.FormatActivityLabel(workout.ActivityType) + " review ready",
			Body:  postWorkoutNotifBody(notifPreview),
			Data:  map[string]string{"workout_id": workoutID},
		})
	}

	log.Info().
		Str("user_id", userID).
		Str("workout_id", workoutID).
		Int("effort_score", effortScore).
		Msg("Post-workout review completed")

	return nil
}

// TriggerMissedReview sends a check-in message for a missed scheduled activity.
func (s *Service) TriggerMissedReview(ctx context.Context, userID, activityID string) error {
	var activityType, phaseName string
	var prescription json.RawMessage
	err := s.pool.QueryRow(ctx,
		`SELECT sa.activity_type, sa.prescription, p2.name
		 FROM scheduled_activities sa
		 JOIN weeks w ON w.id = sa.week_id
		 JOIN phases p2 ON p2.id = w.phase_id
		 WHERE sa.id = $1`,
		activityID,
	).Scan(&activityType, &prescription, &phaseName)
	if err != nil {
		return fmt.Errorf("load activity: %w", err)
	}

	var userName string
	_ = s.pool.QueryRow(ctx, "SELECT name FROM users WHERE id = $1", userID).Scan(&userName)
	if userName == "" {
		userName = "there"
	}

	prescriptionStr := "Not available"
	if len(prescription) > 0 {
		prescriptionStr = string(prescription)
	}

	userMemory := s.assembleUserMemory(ctx, userID)
	programContext := s.buildProgramContext(ctx, userID)

	prompt := s.missedPrompt
	prompt = strings.ReplaceAll(prompt, "{{.UserName}}", userName)
	prompt = strings.ReplaceAll(prompt, "{{.UserMemory}}", userMemory)
	prompt = strings.ReplaceAll(prompt, "{{.ProgramContext}}", programContext)
	prompt = strings.ReplaceAll(prompt, "{{.ActivityType}}", activityType)
	prompt = strings.ReplaceAll(prompt, "{{.PhaseName}}", phaseName)
	prompt = strings.ReplaceAll(prompt, "{{.PrescriptionSummary}}", prescriptionStr)

	// Flex tier: background scheduler, no user waiting
	response, err := s.generateMissedReview(ctx, prompt)
	if err != nil {
		return fmt.Errorf("generate missed review: %w", err)
	}

	missedMeta, _ := json.Marshal(map[string]string{"activity_id": activityID})
	savedMsg, err := s.chatService.SaveMessage(ctx, userID, "assistant", response, nil, missedMeta)
	if err != nil {
		return fmt.Errorf("save missed review message: %w", err)
	}

	// Close any active segment and start a new missed workout segment.
	header := buildMissedWorkoutHeader(activityID, activityType, phaseName)
	s.startReviewSegment(ctx, userID, "missed_workout_checkin", savedMsg.ID, header)

	// Mark as sent
	_, err = s.pool.Exec(ctx,
		"UPDATE scheduled_activities SET missed_review_sent = true WHERE id = $1",
		activityID,
	)
	if err != nil {
		log.Error().Err(err).Str("activity_id", activityID).Msg("Failed to mark missed_review_sent")
	}

	// Send push notification — randomized template body, contextual title
	if s.notifService != nil {
		_ = s.notifService.SendToUser(ctx, userID, "missed_workout", notifications.Payload{
			Title: "Missed your " + notifications.FormatActivityLabel(activityType),
			Body:  notifications.PickMissedWorkoutBody(),
			Data:  map[string]string{"activity_id": activityID},
		})
	}

	log.Info().
		Str("user_id", userID).
		Str("activity_id", activityID).
		Str("activity_type", activityType).
		Msg("Missed workout review sent")

	return nil
}

type postWorkoutReviewResponse struct {
	NotificationPreview string `json:"notification_preview"`
	Review              string `json:"review"`
}

// notifPreviewMaxLen caps the lock-screen preview so it doesn't get truncated by the OS.
const notifPreviewMaxLen = 80

const fallbackPostWorkoutBody = "Tap to see how it went."

// reviewContents builds the user-side request that prompts Grit to write a review.
func reviewContents() []*genai.Content {
	return []*genai.Content{
		{Role: "user", Parts: []*genai.Part{genai.NewPartFromText("Please review my workout.")}},
	}
}

// generatePostWorkoutReview asks Gemini for a structured review and returns
// (review_text, notification_preview). If the JSON is malformed, the raw text
// is returned as the review and the preview is empty (caller falls back).
func (s *Service) generatePostWorkoutReview(ctx context.Context, systemPrompt string) (string, string, error) {
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText(systemPrompt)},
		},
		ResponseMIMEType: "application/json",
		ResponseSchema: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"notification_preview", "review"},
			Properties: map[string]*genai.Schema{
				"notification_preview": {
					Type:        genai.TypeString,
					Description: "One concrete, specific sentence about this workout — max 80 characters. Goes on the user's lock screen.",
				},
				"review": {
					Type:        genai.TypeString,
					Description: "The full post-workout review (under 150 words). Shown to the user in chat.",
				},
			},
		},
	}

	raw, err := s.geminiClient.GenerateContent(ctx, reviewContents(), config)
	if err != nil {
		return "", "", err
	}

	var parsed postWorkoutReviewResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		log.Warn().Err(err).Str("raw", raw).Msg("post-workout review JSON parse failed, using raw text")
		return raw, "", nil
	}
	if parsed.Review == "" {
		return "", "", fmt.Errorf("post-workout review JSON had empty review field")
	}
	return parsed.Review, parsed.NotificationPreview, nil
}

// generateMissedReview produces the missed-workout chat message via the Flex tier.
func (s *Service) generateMissedReview(ctx context.Context, systemPrompt string) (string, error) {
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{genai.NewPartFromText(systemPrompt)},
		},
	}
	return s.geminiClient.GenerateContentFlex(ctx, reviewContents(), config)
}

// postWorkoutNotifBody returns the LLM preview, truncating if it exceeds the
// lock-screen cap. Falls back to a template only when the preview is empty —
// a too-long but specific preview still beats a generic body.
func postWorkoutNotifBody(preview string) string {
	preview = strings.TrimSpace(preview)
	if preview == "" {
		return fallbackPostWorkoutBody
	}
	runes := []rune(preview)
	if len(runes) <= notifPreviewMaxLen {
		return preview
	}
	return string(runes[:notifPreviewMaxLen-3]) + "..."
}

func (s *Service) computeAlignmentSummary(ctx context.Context, activityID string, workout *models.Workout) (string, string) {
	var prescription json.RawMessage
	err := s.pool.QueryRow(ctx,
		"SELECT prescription FROM scheduled_activities WHERE id = $1",
		activityID,
	).Scan(&prescription)
	if err != nil || len(prescription) == 0 {
		return "No prescription data available", ""
	}

	var prescMap map[string]any
	if err := json.Unmarshal(prescription, &prescMap); err != nil {
		return string(prescription), ""
	}

	actType := strings.ToLower(workout.ActivityType)
	var deviation DeviationMetrics

	switch {
	case strings.Contains(actType, "run") || strings.Contains(actType, "cycl"):
		deviation = ComputeRunDeviation(prescMap, workout.RecordedData)
	case strings.Contains(actType, "strength") || strings.Contains(actType, "weight"):
		deviation = ComputeStrengthDeviation(prescMap, workout.RecordedData)
	default:
		var dur float64
		if workout.FinishedAt != nil {
			dur = workout.FinishedAt.Sub(workout.StartedAt).Seconds()
		}
		deviation = ComputeGenericDeviation(prescMap, workout.RecordedData, dur)
	}

	devJSON, _ := json.Marshal(deviation)
	return string(prescription), string(devJSON)
}

func (s *Service) loadTrendSummary(ctx context.Context, userID, activityType string) string {
	rows, err := s.pool.Query(ctx,
		`SELECT recorded_data, started_at FROM workouts
		 WHERE user_id = $1 AND activity_type = $2
		 ORDER BY started_at DESC LIMIT 5`,
		userID, activityType,
	)
	if err != nil {
		return "No recent workout data available"
	}
	defer rows.Close()

	var summaries []string
	for rows.Next() {
		var data json.RawMessage
		var startedAt time.Time
		if err := rows.Scan(&data, &startedAt); err != nil {
			continue
		}
		summaries = append(summaries, fmt.Sprintf("%s: %s",
			startedAt.Format("Jan 2"), string(data)))
	}

	if len(summaries) == 0 {
		return "First workout of this type — no historical data"
	}

	return fmt.Sprintf("Last %d workouts:\n%s", len(summaries), strings.Join(summaries, "\n"))
}

// startReviewSegment closes any active segment (with async summarization) and
// starts a new one anchored to the review message, with a denormalized header
// payload for the chat-grouping UI.
func (s *Service) startReviewSegment(ctx context.Context, userID, segType, startMessageID string, header json.RawMessage) {
	if s.memoryService == nil {
		return
	}
	s.memoryService.CloseActiveAndSummarize(ctx, userID)
	if _, err := s.memoryService.StartSegment(ctx, userID, segType, startMessageID, header); err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Failed to start review segment")
	}
}

// assembleUserMemory returns formatted user facts and recent session summaries,
// or a fallback string if no memory data exists.
func (s *Service) assembleUserMemory(ctx context.Context, userID string) string {
	if s.memoryService == nil {
		return "No prior context available."
	}
	mem, err := s.memoryService.AssembleMemory(ctx, userID, "workout_review")
	if err != nil || mem == "" {
		return "No prior context available."
	}
	return mem
}

// buildProgramContext returns a formatted summary of the user's active program
// (name, sport, goal, criteria) for injection into review prompts.
func (s *Service) buildProgramContext(ctx context.Context, userID string) string {
	program, criteria, err := s.programService.GetActiveProgramSettings(ctx, userID)
	if err != nil || program == nil {
		return "No active program."
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Program: %s\n", program.Name))
	if program.Sport != nil && *program.Sport != "" {
		b.WriteString(fmt.Sprintf("Sport: %s\n", *program.Sport))
	}
	if program.GoalDescription != nil && *program.GoalDescription != "" {
		b.WriteString(fmt.Sprintf("Goal: %s\n", *program.GoalDescription))
	}

	if len(criteria) > 0 {
		b.WriteString("\nSettings:\n")
		for _, c := range criteria {
			b.WriteString(fmt.Sprintf("- %s: %s\n", c.Label, c.Value))
		}
	}

	return b.String()
}

func buildRecordedDataSummary(workout *models.Workout) string {
	var parts []string

	parts = append(parts, fmt.Sprintf("Activity: %s", workout.ActivityType))
	parts = append(parts, fmt.Sprintf("Source: %s", workout.Source))
	parts = append(parts, fmt.Sprintf("Started: %s", workout.StartedAt.Format(time.RFC3339)))
	if workout.FinishedAt != nil {
		dur := workout.FinishedAt.Sub(workout.StartedAt)
		parts = append(parts, fmt.Sprintf("Duration: %.0f minutes", dur.Minutes()))
	}
	if len(workout.RecordedData) > 0 {
		parts = append(parts, fmt.Sprintf("Data: %s", string(workout.RecordedData)))
	}
	if workout.Notes != nil && *workout.Notes != "" {
		parts = append(parts, fmt.Sprintf("User notes: %s", *workout.Notes))
	}

	return strings.Join(parts, "\n")
}

// buildPostWorkoutHeader builds a denormalized SegmentHeader for a post-workout
// review segment, snapshotting the activity type, distance/duration, and the
// workout's start time formatted in the user's timezone (UTC fallback).
func buildPostWorkoutHeader(workout *models.Workout, durationSec float64, userTZ *string) json.RawMessage {
	statParts := []string{titleCaseActivity(workout.ActivityType)}

	if len(workout.RecordedData) > 0 {
		var rec map[string]any
		if err := json.Unmarshal(workout.RecordedData, &rec); err == nil {
			if km, ok := rec["distance_km"].(float64); ok && km > 0 {
				statParts = append(statParts, fmt.Sprintf("%.1f km", km))
			} else if m, ok := rec["distance_m"].(float64); ok && m > 0 {
				statParts = append(statParts, fmt.Sprintf("%.0f m", m))
			}
		}
	}
	if durationSec > 0 {
		statParts = append(statParts, formatDuration(durationSec))
	}

	return models.SegmentHeader{
		Label:    strings.Join(statParts, " · "),
		Subtitle: formatLocalTime(workout.StartedAt, userTZ),
		RefType:  "workout",
		RefID:    workout.ID,
	}.Marshal()
}

// buildMissedWorkoutHeader builds a SegmentHeader for a missed-workout check-in.
// We don't include a timestamp — the message timestamp itself is the anchor —
// just the activity type and phase name as context.
func buildMissedWorkoutHeader(activityID, activityType, phaseName string) json.RawMessage {
	return models.SegmentHeader{
		Label:    "Missed · " + titleCaseActivity(activityType),
		Subtitle: phaseName,
		RefType:  "activity",
		RefID:    activityID,
	}.Marshal()
}

func titleCaseActivity(s string) string {
	s = strings.ReplaceAll(s, "_", " ")
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func formatDuration(seconds float64) string {
	mins := int(seconds / 60)
	if mins < 60 {
		return fmt.Sprintf("%d min", mins)
	}
	h := mins / 60
	m := mins % 60
	if m == 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dh %dm", h, m)
}

func formatLocalTime(t time.Time, tz *string) string {
	loc := time.UTC
	if tz != nil && *tz != "" {
		if l, err := time.LoadLocation(*tz); err == nil {
			loc = l
		}
	}
	return t.In(loc).Format("Mon Jan 2 · 15:04")
}

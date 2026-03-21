package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/models"
)

// Service manages conversation segments, fact extraction, and memory assembly.
type Service struct {
	pool     *pgxpool.Pool
	aiClient *ai.GeminiClient
}

// NewService creates a new memory service.
func NewService(pool *pgxpool.Pool, aiClient *ai.GeminiClient) *Service {
	return &Service{pool: pool, aiClient: aiClient}
}

// GetLastMessageID returns the ID of the most recent chat message for a user, or empty string if none.
func (s *Service) GetLastMessageID(ctx context.Context, userID string) string {
	var id string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID,
	).Scan(&id)
	if err != nil {
		return ""
	}
	return id
}

// GetActiveSegment returns the current active segment for a user, or nil if none exists.
func (s *Service) GetActiveSegment(ctx context.Context, userID string) (*models.ChatSegment, error) {
	var seg models.ChatSegment
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, segment_type, status, start_message_id, end_message_id, summary, tags, started_at, completed_at, created_at
		 FROM chat_segments WHERE user_id = $1 AND status = 'active' LIMIT 1`,
		userID,
	).Scan(&seg.ID, &seg.UserID, &seg.SegmentType, &seg.Status, &seg.StartMessageID, &seg.EndMessageID, &seg.Summary, &seg.Tags, &seg.StartedAt, &seg.CompletedAt, &seg.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get active segment: %w", err)
	}
	return &seg, nil
}

// StartSegment creates a new active segment. Any existing active segment for
// the user is closed first (without summarization — call SummarizeSegment
// separately if needed).
func (s *Service) StartSegment(ctx context.Context, userID, segmentType, startMessageID string) (*models.ChatSegment, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("start segment tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Close any active segment.
	_, err = tx.Exec(ctx,
		`UPDATE chat_segments SET status = 'completed', completed_at = NOW()
		 WHERE user_id = $1 AND status = 'active'`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("close existing active segment: %w", err)
	}

	var seg models.ChatSegment
	err = tx.QueryRow(ctx,
		`INSERT INTO chat_segments (user_id, segment_type, status, start_message_id)
		 VALUES ($1, $2, 'active', $3)
		 RETURNING id, user_id, segment_type, status, start_message_id, end_message_id, summary, tags, started_at, completed_at, created_at`,
		userID, segmentType, startMessageID,
	).Scan(&seg.ID, &seg.UserID, &seg.SegmentType, &seg.Status, &seg.StartMessageID, &seg.EndMessageID, &seg.Summary, &seg.Tags, &seg.StartedAt, &seg.CompletedAt, &seg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert segment: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit start segment: %w", err)
	}
	return &seg, nil
}

// CloseSegment marks a segment as completed. Idempotent — no error if already closed.
func (s *Service) CloseSegment(ctx context.Context, segmentID, endMessageID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE chat_segments SET status = 'completed', end_message_id = $2, completed_at = NOW()
		 WHERE id = $1 AND status = 'active'`,
		segmentID, endMessageID,
	)
	if err != nil {
		return fmt.Errorf("close segment: %w", err)
	}
	return nil
}

// CloseActiveSegment finds the active segment for a user, closes it, and returns its ID.
// Returns empty string if no active segment exists.
func (s *Service) CloseActiveSegment(ctx context.Context, userID, endMessageID string) (string, error) {
	var segmentID string
	err := s.pool.QueryRow(ctx,
		`UPDATE chat_segments SET status = 'completed', end_message_id = $2, completed_at = NOW()
		 WHERE user_id = $1 AND status = 'active'
		 RETURNING id`,
		userID, endMessageID,
	).Scan(&segmentID)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("close active segment: %w", err)
	}
	return segmentID, nil
}

// getSegmentMessages fetches all messages between a segment's start and end message timestamps.
func (s *Service) getSegmentMessages(ctx context.Context, segmentID string) ([]models.ChatMessage, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT m.id, m.user_id, m.role, m.content, m.program_id, m.metadata, m.created_at
		 FROM chat_messages m
		 JOIN chat_segments seg ON seg.id = $1
		 WHERE m.user_id = seg.user_id
		   AND m.created_at >= (SELECT created_at FROM chat_messages WHERE id = seg.start_message_id)
		   AND (seg.end_message_id IS NULL OR m.created_at <= (SELECT created_at FROM chat_messages WHERE id = seg.end_message_id))
		 ORDER BY m.created_at`,
		segmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("get segment messages: %w", err)
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		if err := rows.Scan(&msg.ID, &msg.UserID, &msg.Role, &msg.Content, &msg.ProgramID, &msg.Metadata, &msg.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan segment message: %w", err)
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

// SummarizeSegment fetches the messages in a segment, calls the LLM for a summary
// and fact extraction, then updates the segment and inserts facts.
// Intended to be called asynchronously in a goroutine.
func (s *Service) SummarizeSegment(ctx context.Context, segmentID string) error {
	// Load segment metadata.
	var segType, userID string
	err := s.pool.QueryRow(ctx,
		`SELECT user_id, segment_type FROM chat_segments WHERE id = $1`,
		segmentID,
	).Scan(&userID, &segType)
	if err != nil {
		return fmt.Errorf("load segment for summarization: %w", err)
	}

	messages, err := s.getSegmentMessages(ctx, segmentID)
	if err != nil {
		return err
	}
	if len(messages) == 0 {
		return nil
	}

	prompt := buildSummarizePrompt(segType, messages)
	raw, err := s.aiClient.GenerateCheap(ctx, prompt)
	if err != nil {
		return fmt.Errorf("summarize LLM call: %w", err)
	}

	var result struct {
		Summary string `json:"summary"`
		Facts   []struct {
			Type    string `json:"type"`
			Content string `json:"content"`
		} `json:"facts"`
		Tags []string `json:"tags"`
	}
	cleaned := stripCodeFence(raw)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		log.Warn().Err(err).Str("segment_id", segmentID).Str("raw", raw).Msg("Failed to parse summarization response, using raw text")
		result.Summary = raw
	}

	// Save summary and tags.
	if result.Summary != "" {
		_, err = s.pool.Exec(ctx,
			`UPDATE chat_segments SET summary = $2, tags = $3 WHERE id = $1`,
			segmentID, result.Summary, result.Tags,
		)
		if err != nil {
			return fmt.Errorf("save segment summary: %w", err)
		}
	}

	// Save extracted facts.
	for _, f := range result.Facts {
		if f.Content == "" {
			continue
		}
		// Deactivate older facts of the same type that might be outdated.
		_, _ = s.pool.Exec(ctx,
			`UPDATE chat_facts SET active = false, updated_at = NOW()
			 WHERE user_id = $1 AND fact_type = $2 AND active = true AND content != $3`,
			userID, f.Type, f.Content,
		)
		// Insert the new fact (skip if exact duplicate already exists and is active).
		_, err = s.pool.Exec(ctx,
			`INSERT INTO chat_facts (user_id, fact_type, content, source_segment_id)
			 SELECT $1::uuid, $2::text, $3::text, $4::uuid
			 WHERE NOT EXISTS (
			   SELECT 1 FROM chat_facts WHERE user_id = $1 AND fact_type = $2 AND content = $3 AND active = true
			 )`,
			userID, f.Type, f.Content, segmentID,
		)
		if err != nil {
			log.Warn().Err(err).Str("fact_type", f.Type).Msg("Failed to insert fact")
		}
	}

	log.Debug().Str("segment_id", segmentID).Int("facts", len(result.Facts)).Msg("Segment summarized")
	return nil
}

// CheckSegmentCompletion uses the LLM to determine if a conversation segment
// looks complete (topic resolved, no unanswered questions).
func (s *Service) CheckSegmentCompletion(ctx context.Context, segmentID string) (bool, error) {
	messages, err := s.getSegmentMessages(ctx, segmentID)
	if err != nil {
		return false, err
	}
	if len(messages) == 0 {
		return true, nil
	}

	prompt := buildCompletionCheckPrompt(messages)
	raw, err := s.aiClient.GenerateCheap(ctx, prompt)
	if err != nil {
		// On error, default to "complete" so we don't block summarization.
		log.Warn().Err(err).Str("segment_id", segmentID).Msg("Completion check failed, defaulting to complete")
		return true, nil
	}

	var result struct {
		Complete bool   `json:"complete"`
		Reason   string `json:"reason"`
	}
	cleaned := stripCodeFence(raw)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		log.Warn().Err(err).Str("raw", raw).Msg("Failed to parse completion check, defaulting to complete")
		return true, nil
	}

	return result.Complete, nil
}

// DetectSegmentType classifies what kind of segment is starting based on the message content.
// For explicit tool-based signals, the caller should provide the type directly.
// This method is for ambiguous user-initiated messages.
func (s *Service) DetectSegmentType(ctx context.Context, messageContent string) string {
	prompt := buildClassifyPrompt(messageContent)
	raw, err := s.aiClient.GenerateCheap(ctx, prompt)
	if err != nil {
		return "general_coaching"
	}

	var result struct {
		Type string `json:"type"`
	}
	cleaned := stripCodeFence(raw)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return "general_coaching"
	}

	// Map LLM classification to valid DB segment types.
	// "injury_health" and "goal_life_change" aren't DB segment types —
	// they're still general_coaching segments but facts will be extracted during summarization.
	switch result.Type {
	case "program_creation":
		return "program_creation"
	case "program_modification":
		return "program_modification"
	default:
		return "general_coaching"
	}
}

// RunFactDecay deactivates stale facts based on type-specific expiry periods.
// Returns the total number of facts deactivated.
func (s *Service) RunFactDecay(ctx context.Context) (int64, error) {
	// Injuries and health conditions: 4 months.
	tag1, err := s.pool.Exec(ctx,
		`UPDATE chat_facts SET active = false, updated_at = NOW()
		 WHERE fact_type IN ('injury', 'health_condition')
		   AND created_at < NOW() - INTERVAL '4 months'
		   AND active = true`,
	)
	if err != nil {
		return 0, fmt.Errorf("decay injury/health facts: %w", err)
	}

	// Schedule constraints: 3 months.
	tag2, err := s.pool.Exec(ctx,
		`UPDATE chat_facts SET active = false, updated_at = NOW()
		 WHERE fact_type = 'schedule_constraint'
		   AND created_at < NOW() - INTERVAL '3 months'
		   AND active = true`,
	)
	if err != nil {
		return 0, fmt.Errorf("decay schedule facts: %w", err)
	}

	injuryHealth := tag1.RowsAffected()
	schedule := tag2.RowsAffected()
	total := injuryHealth + schedule

	if total > 0 {
		log.Info().
			Int64("injury_health", injuryHealth).
			Int64("schedule_constraint", schedule).
			Int64("total", total).
			Msg("Fact decay deactivated stale facts")
	}

	return total, nil
}

// GetActiveFacts returns the 20 most recent active facts for a user.
func (s *Service) GetActiveFacts(ctx context.Context, userID string) ([]models.ChatFact, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, fact_type, content, source_segment_id, active, created_at, updated_at
		 FROM chat_facts WHERE user_id = $1 AND active = true
		 ORDER BY created_at DESC LIMIT 20`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("get active facts: %w", err)
	}
	defer rows.Close()

	var facts []models.ChatFact
	for rows.Next() {
		var f models.ChatFact
		if err := rows.Scan(&f.ID, &f.UserID, &f.FactType, &f.Content, &f.SourceSegmentID, &f.Active, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan fact: %w", err)
		}
		facts = append(facts, f)
	}
	return facts, nil
}

// AssembleMemory builds the complete memory string for injection into the system prompt.
// The mode parameter filters segment summaries by relevance; empty string defaults to general_coaching.
func (s *Service) AssembleMemory(ctx context.Context, userID, mode string) (string, error) {
	var b strings.Builder

	// 1. Active facts.
	facts, err := s.GetActiveFacts(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Failed to load facts for memory assembly")
	}
	if len(facts) > 0 {
		b.WriteString("### User Facts\n")
		for _, f := range facts {
			b.WriteString(fmt.Sprintf("- [%s] %s\n", formatFactType(f.FactType), f.Content))
		}
		b.WriteString("\n")
	}

	// 2. Mode-aware segment summaries.
	summaries := s.getSegmentSummaries(ctx, userID, mode)
	if len(summaries) > 0 {
		b.WriteString("### Recent Sessions\n")
		// Reverse to show oldest first.
		for i := len(summaries) - 1; i >= 0; i-- {
			ss := summaries[i]
			date := ss.completedAt.Format("Jan 2")
			label := formatSegmentType(ss.segType)
			b.WriteString(fmt.Sprintf("%d. (%s) %s: %s\n", len(summaries)-i, date, label, ss.summary))
		}
		b.WriteString("\n")
	}

	log.Debug().
		Str("user_id", userID).
		Str("mode", mode).
		Int("facts", len(facts)).
		Int("segments", len(summaries)).
		Msg("Memory assembled")

	if b.Len() == 0 {
		return "", nil
	}
	return b.String(), nil
}

type segSummary struct {
	segType     string
	summary     string
	completedAt time.Time
}

// getSegmentSummaries returns completed segment summaries filtered by mode relevance.
// For specialized modes (program_creation, program_management, workout_review), it applies
// tag-based filtering and falls back to the most recent segments if fewer than 3 are found.
func (s *Service) getSegmentSummaries(ctx context.Context, userID, mode string) []segSummary {
	// Tags covering sport activities and coaching topics used by all specialized modes.
	sportAndTopicTags := []string{
		"running", "cycling", "swimming", "strength", "mobility",
		"injury", "goal", "program", "review", "nutrition",
	}

	var query string
	var args []any

	switch mode {
	case "program_creation":
		query = `SELECT segment_type, summary, completed_at
			FROM chat_segments
			WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
			  AND tags && $2
			ORDER BY completed_at DESC LIMIT 5`
		args = []any{userID, sportAndTopicTags}

	case "program_management":
		query = `SELECT segment_type, summary, completed_at
			FROM chat_segments
			WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
			  AND (segment_type = 'program_modification' OR tags && $2)
			ORDER BY completed_at DESC LIMIT 5`
		args = []any{userID, sportAndTopicTags}

	case "workout_review":
		query = `SELECT segment_type, summary, completed_at
			FROM chat_segments
			WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
			  AND tags && $2
			ORDER BY completed_at DESC LIMIT 3`
		args = []any{userID, sportAndTopicTags}

	default:
		// general_coaching or unknown: return last 3 segments unfiltered.
		query = `SELECT segment_type, summary, completed_at
			FROM chat_segments
			WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
			ORDER BY completed_at DESC LIMIT 3`
		args = []any{userID}
	}

	summaries := s.querySegmentSummaries(ctx, query, args)

	// Fallback: if a specialized mode returned fewer than 3 segments, pad with the
	// most recent segments not already included.
	isSpecializedMode := mode != "" && mode != "general_coaching"
	if isSpecializedMode && len(summaries) < 3 {
		existing := make(map[string]bool, len(summaries))
		for _, ss := range summaries {
			existing[ss.completedAt.String()+ss.summary] = true
		}

		needed := 3 - len(summaries)
		fallbackQuery := `SELECT segment_type, summary, completed_at
			FROM chat_segments
			WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
			ORDER BY completed_at DESC LIMIT $2`
		// Fetch enough candidates to have at least `needed` unseen rows.
		candidates := s.querySegmentSummaries(ctx, fallbackQuery, []any{userID, needed + len(summaries)})
		for _, c := range candidates {
			if !existing[c.completedAt.String()+c.summary] {
				summaries = append(summaries, c)
				needed--
				if needed == 0 {
					break
				}
			}
		}
	}

	return summaries
}

// querySegmentSummaries executes a segment summary query and returns the results.
func (s *Service) querySegmentSummaries(ctx context.Context, query string, args []any) []segSummary {
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load segment summaries for memory assembly")
		return nil
	}
	defer rows.Close()

	var summaries []segSummary
	for rows.Next() {
		var ss segSummary
		if err := rows.Scan(&ss.segType, &ss.summary, &ss.completedAt); err != nil {
			continue
		}
		summaries = append(summaries, ss)
	}
	return summaries
}

// CloseAndSummarize closes a segment by ID and triggers async summarization.
func (s *Service) CloseAndSummarize(ctx context.Context, segmentID string) {
	if segmentID == "" {
		return
	}
	endMsgID := s.getEndMessageIDForSegment(ctx, segmentID)
	if err := s.CloseSegment(ctx, segmentID, endMsgID); err != nil {
		log.Warn().Err(err).Str("segment_id", segmentID).Msg("Failed to close segment")
		return
	}
	go func() {
		if err := s.SummarizeSegment(context.Background(), segmentID); err != nil {
			log.Warn().Err(err).Str("segment_id", segmentID).Msg("Async segment summarization failed")
		}
	}()
}

// CloseActiveAndSummarize finds the active segment for a user, closes it, and triggers async summarization.
func (s *Service) CloseActiveAndSummarize(ctx context.Context, userID string) {
	endMsgID := s.GetLastMessageID(ctx, userID)
	closedID, err := s.CloseActiveSegment(ctx, userID, endMsgID)
	if err != nil || closedID == "" {
		return
	}
	go func() {
		if err := s.SummarizeSegment(context.Background(), closedID); err != nil {
			log.Warn().Err(err).Str("segment_id", closedID).Msg("Async segment summarization failed")
		}
	}()
}

// getEndMessageIDForSegment returns the last message ID within a segment's time range.
func (s *Service) getEndMessageIDForSegment(ctx context.Context, segmentID string) string {
	var id string
	err := s.pool.QueryRow(ctx,
		`SELECT m.id FROM chat_messages m
		 JOIN chat_segments seg ON seg.id = $1
		 WHERE m.user_id = seg.user_id
		   AND m.created_at >= (SELECT created_at FROM chat_messages WHERE id = seg.start_message_id)
		 ORDER BY m.created_at DESC LIMIT 1`,
		segmentID,
	).Scan(&id)
	if err != nil {
		return ""
	}
	return id
}

// GetLastMessageTime returns the created_at of the most recent chat message for a user.
func (s *Service) GetLastMessageTime(ctx context.Context, userID string) (time.Time, error) {
	var t time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT created_at FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID,
	).Scan(&t)
	if err == pgx.ErrNoRows {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("get last message time: %w", err)
	}
	return t, nil
}

func formatFactType(ft string) string {
	switch ft {
	case "injury":
		return "Injury"
	case "health_condition":
		return "Health"
	case "preference":
		return "Preference"
	case "goal":
		return "Goal"
	case "schedule_constraint":
		return "Schedule"
	case "equipment":
		return "Equipment"
	case "sport_focus":
		return "Sport"
	default:
		return strings.ReplaceAll(ft, "_", " ")
	}
}

func formatSegmentType(st string) string {
	switch st {
	case "program_creation":
		return "Program Creation"
	case "post_workout_review":
		return "Post-Workout Review"
	case "missed_workout_checkin":
		return "Missed Workout Check-in"
	case "program_modification":
		return "Program Modification"
	case "general_coaching":
		return "General Coaching"
	default:
		return strings.ReplaceAll(st, "_", " ")
	}
}

// ClearAll deletes all segments and facts for a user, effectively resetting Grit's memory.
func (s *Service) ClearAll(ctx context.Context, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("clear memory tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `DELETE FROM chat_facts WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("delete facts: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chat_segments WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("delete segments: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit clear memory: %w", err)
	}

	log.Info().Str("user_id", userID).Msg("All memory cleared for user")
	return nil
}

// stripCodeFence removes ```json ... ``` wrapping that LLMs sometimes add.
func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```json") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimSuffix(s, "```")
		s = strings.TrimSpace(s)
	} else if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(s, "```")
		s = strings.TrimSpace(s)
	}
	return s
}

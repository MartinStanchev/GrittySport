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
		`SELECT id, user_id, segment_type, status, start_message_id, end_message_id, summary, started_at, completed_at, created_at
		 FROM chat_segments WHERE user_id = $1 AND status = 'active' LIMIT 1`,
		userID,
	).Scan(&seg.ID, &seg.UserID, &seg.SegmentType, &seg.Status, &seg.StartMessageID, &seg.EndMessageID, &seg.Summary, &seg.StartedAt, &seg.CompletedAt, &seg.CreatedAt)
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
		 RETURNING id, user_id, segment_type, status, start_message_id, end_message_id, summary, started_at, completed_at, created_at`,
		userID, segmentType, startMessageID,
	).Scan(&seg.ID, &seg.UserID, &seg.SegmentType, &seg.Status, &seg.StartMessageID, &seg.EndMessageID, &seg.Summary, &seg.StartedAt, &seg.CompletedAt, &seg.CreatedAt)
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
	}
	cleaned := stripCodeFence(raw)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		log.Warn().Err(err).Str("segment_id", segmentID).Str("raw", raw).Msg("Failed to parse summarization response, using raw text")
		result.Summary = raw
	}

	// Save summary.
	if result.Summary != "" {
		_, err = s.pool.Exec(ctx,
			`UPDATE chat_segments SET summary = $2 WHERE id = $1`,
			segmentID, result.Summary,
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
			 SELECT $1, $2, $3, $4
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
	case "program_modification":
		return "program_modification"
	default:
		return "general_coaching"
	}
}

// GetActiveFacts returns all active facts for a user.
func (s *Service) GetActiveFacts(ctx context.Context, userID string) ([]models.ChatFact, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, fact_type, content, source_segment_id, active, created_at, updated_at
		 FROM chat_facts WHERE user_id = $1 AND active = true
		 ORDER BY created_at`,
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
func (s *Service) AssembleMemory(ctx context.Context, userID string) (string, error) {
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

	// 2. Last 3 completed segment summaries.
	rows, err := s.pool.Query(ctx,
		`SELECT segment_type, summary, completed_at
		 FROM chat_segments
		 WHERE user_id = $1 AND status = 'completed' AND summary IS NOT NULL
		 ORDER BY completed_at DESC LIMIT 3`,
		userID,
	)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Failed to load segment summaries for memory assembly")
	} else {
		defer rows.Close()
		type segSummary struct {
			segType     string
			summary     string
			completedAt time.Time
		}
		var summaries []segSummary
		for rows.Next() {
			var ss segSummary
			if err := rows.Scan(&ss.segType, &ss.summary, &ss.completedAt); err != nil {
				continue
			}
			summaries = append(summaries, ss)
		}
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
	}

	if b.Len() == 0 {
		return "", nil
	}
	return b.String(), nil
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

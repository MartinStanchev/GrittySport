package services

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grittyfitness/api/internal/models"
)

type ChatService struct {
	pool *pgxpool.Pool
}

func NewChatService(pool *pgxpool.Pool) *ChatService {
	return &ChatService{pool: pool}
}

func (s *ChatService) SaveMessage(ctx context.Context, userID, role, content, chatContext string, programID *string, metadata json.RawMessage) (*models.ChatMessage, error) {
	var msg models.ChatMessage
	err := s.pool.QueryRow(ctx,
		`INSERT INTO chat_messages (user_id, role, content, context, program_id, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, role, content, context, program_id, metadata, created_at`,
		userID, role, content, chatContext, programID, metadata,
	).Scan(&msg.ID, &msg.UserID, &msg.Role, &msg.Content, &msg.Context, &msg.ProgramID, &msg.Metadata, &msg.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *ChatService) GetHistory(ctx context.Context, userID string, chatContext string, limit int, beforeID string) ([]models.ChatMessage, bool, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	fetchLimit := limit + 1

	query := `SELECT id, user_id, role, content, context, program_id, metadata, created_at
		FROM chat_messages WHERE user_id = $1`
	args := []interface{}{userID}
	argIdx := 2

	if chatContext != "" {
		query += ` AND context = $` + strconv.Itoa(argIdx)
		args = append(args, chatContext)
		argIdx++
	}

	if beforeID != "" {
		query += ` AND created_at < (SELECT created_at FROM chat_messages WHERE id = $` + strconv.Itoa(argIdx) + `)`
		args = append(args, beforeID)
		argIdx++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(argIdx)
	args = append(args, fetchLimit)

	messages, err := s.queryMessages(ctx, query, args...)
	if err != nil {
		return nil, false, err
	}

	hasMore := len(messages) > limit
	if hasMore {
		messages = messages[:limit]
	}

	reverseMessages(messages)
	return messages, hasMore, nil
}

func (s *ChatService) GetRecentMessages(ctx context.Context, userID string, limit int) ([]models.ChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}

	messages, err := s.queryMessages(ctx,
		`SELECT id, user_id, role, content, context, program_id, metadata, created_at
		 FROM chat_messages WHERE user_id = $1
		 ORDER BY created_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}

	reverseMessages(messages)
	return messages, nil
}

func (s *ChatService) queryMessages(ctx context.Context, query string, args ...interface{}) ([]models.ChatMessage, error) {
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		if err := rows.Scan(&msg.ID, &msg.UserID, &msg.Role, &msg.Content, &msg.Context, &msg.ProgramID, &msg.Metadata, &msg.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func reverseMessages(messages []models.ChatMessage) {
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
}

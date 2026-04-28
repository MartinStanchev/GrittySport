package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/usage"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// ExpoPushMessage is the payload sent to the Expo Push API.
type ExpoPushMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title,omitempty"`
	Body  string            `json:"body"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

// ExpoPushResponse is a single ticket from the Expo Push API.
type ExpoPushResponse struct {
	Status  string `json:"status"` // "ok" or "error"
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"` // e.g. "DeviceNotRegistered"
	} `json:"details,omitempty"`
}

// Service handles sending push notifications via the Expo Push API.
type Service struct {
	pool       *pgxpool.Pool
	usageSvc   *usage.Service
	httpClient *http.Client
}

// NewService creates a new notification service.
func NewService(pool *pgxpool.Pool, usageSvc *usage.Service) *Service {
	return &Service{
		pool:     pool,
		usageSvc: usageSvc,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SaveToken upserts a push token for a user.
func (s *Service) SaveToken(ctx context.Context, userID, token, platform string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO push_tokens (user_id, token, platform)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, token) DO UPDATE SET
		   platform = EXCLUDED.platform,
		   updated_at = NOW()`,
		userID, token, platform,
	)
	return err
}

// DeleteToken removes a specific push token.
func (s *Service) DeleteToken(ctx context.Context, userID, token string) error {
	_, err := s.pool.Exec(ctx,
		"DELETE FROM push_tokens WHERE user_id = $1 AND token = $2",
		userID, token,
	)
	return err
}

// GetPreferences returns all notification preferences for a user.
// Types without an explicit row get DefaultEnabled from the registry.
func (s *Service) GetPreferences(ctx context.Context, userID string) (map[string]bool, error) {
	prefs := make(map[string]bool, len(Registry))
	for _, nt := range Registry {
		prefs[nt.Key] = nt.DefaultEnabled
	}

	rows, err := s.pool.Query(ctx,
		"SELECT notif_type, enabled FROM notification_preferences WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return prefs, err
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		var enabled bool
		if err := rows.Scan(&key, &enabled); err != nil {
			continue
		}
		if _, ok := registryMap[key]; ok {
			prefs[key] = enabled
		}
	}
	return prefs, nil
}

// SetPreference updates a single notification preference for a user.
func (s *Service) SetPreference(ctx context.Context, userID, notifType string, enabled bool) error {
	if _, ok := registryMap[notifType]; !ok {
		return fmt.Errorf("unknown notification type: %s", notifType)
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO notification_preferences (user_id, notif_type, enabled)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, notif_type) DO UPDATE SET enabled = EXCLUDED.enabled`,
		userID, notifType, enabled,
	)
	return err
}

// Payload is the contextual content for a single push notification.
// Title falls back to the registry's DefaultTitle if empty.
type Payload struct {
	Title string
	Body  string
	Data  map[string]string
}

// SendToUser sends a push notification to a user, checking preferences and tier.
func (s *Service) SendToUser(ctx context.Context, userID, notifType string, payload Payload) error {
	nt, ok := Lookup(notifType)
	if !ok {
		return fmt.Errorf("unknown notification type: %s", notifType)
	}

	// Check premium gating
	if nt.RequiresPremium {
		tier, err := s.usageSvc.GetTier(ctx, userID)
		if err != nil {
			log.Warn().Err(err).Str("user_id", userID).Msg("Failed to check tier for notification, skipping")
			return nil
		}
		if tier != usage.TierPremium {
			log.Debug().Str("user_id", userID).Str("type", notifType).Msg("Notification skipped: requires premium")
			return nil
		}
	}

	// Check user preference
	prefs, err := s.GetPreferences(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Failed to load notification preferences, sending anyway")
	} else if !prefs[notifType] {
		log.Debug().Str("user_id", userID).Str("type", notifType).Msg("Notification skipped: user disabled")
		return nil
	}

	// Look up push tokens
	rows, err := s.pool.Query(ctx,
		"SELECT token FROM push_tokens WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return fmt.Errorf("query push tokens: %w", err)
	}
	defer rows.Close()

	title := payload.Title
	if title == "" {
		title = nt.DefaultTitle
	}

	var messages []ExpoPushMessage
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			continue
		}
		msgData := make(map[string]string, len(payload.Data)+1)
		for k, v := range payload.Data {
			msgData[k] = v
		}
		msgData["type"] = notifType
		messages = append(messages, ExpoPushMessage{
			To:    token,
			Title: title,
			Body:  payload.Body,
			Data:  msgData,
			Sound: "default",
		})
	}

	if len(messages) == 0 {
		log.Debug().Str("user_id", userID).Msg("No push tokens registered, skipping notification")
		return nil
	}

	responses, err := s.sendBatch(ctx, messages)
	if err != nil {
		return err
	}

	// Clean up invalid tokens
	for i, resp := range responses {
		if resp.Details.Error == "DeviceNotRegistered" && i < len(messages) {
			log.Info().Str("token", messages[i].To).Msg("Removing invalid push token")
			_ = s.DeleteToken(ctx, userID, messages[i].To)
		}
	}

	log.Info().
		Str("user_id", userID).
		Str("type", notifType).
		Int("tokens", len(messages)).
		Msg("Push notification sent")

	return nil
}

func (s *Service) sendBatch(ctx context.Context, messages []ExpoPushMessage) ([]ExpoPushResponse, error) {
	payload, err := json.Marshal(messages)
	if err != nil {
		return nil, fmt.Errorf("marshal push messages: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send push request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read push response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().Int("status", resp.StatusCode).Str("body", string(body)).Msg("Expo Push API error")
		return nil, fmt.Errorf("expo push API returned %d", resp.StatusCode)
	}

	var result struct {
		Data []ExpoPushResponse `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal push response: %w", err)
	}

	return result.Data, nil
}

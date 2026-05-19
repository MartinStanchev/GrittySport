package review

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/grittyfitness/api/internal/memory"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/notifications"
	"github.com/grittyfitness/api/internal/services"
)

// UserReminderChecker delivers user-scheduled reminders set via the
// set_reminder tool. The reminder body is written by the LLM at creation time
// and stored verbatim, so delivery is a pure DB + push operation — no LLM call
// on the hot path.
type UserReminderChecker struct {
	chatService   *services.ChatService
	reminderSvc   *services.ReminderService
	notifService  *notifications.Service
	memoryService *memory.Service
}

// NewUserReminderChecker creates a new user-reminder scheduler.
func NewUserReminderChecker(chatSvc *services.ChatService, reminderSvc *services.ReminderService, notifSvc *notifications.Service, memorySvc *memory.Service) *UserReminderChecker {
	return &UserReminderChecker{
		chatService:   chatSvc,
		reminderSvc:   reminderSvc,
		notifService:  notifSvc,
		memoryService: memorySvc,
	}
}

// Run starts the per-minute check loop. Blocks until context is cancelled.
// 1-minute granularity keeps "remind me at 8:00" landing within 60 seconds of
// the wall-clock target without burning quota on cheap selects.
func (c *UserReminderChecker) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Info().Msg("User reminder checker started")

	// Fire once on startup so reminders that came due during downtime are
	// delivered immediately rather than waiting up to a full tick.
	c.check(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("User reminder checker stopped")
			return
		case <-ticker.C:
			c.check(ctx)
		}
	}
}

func (c *UserReminderChecker) check(ctx context.Context) {
	due, err := c.reminderSvc.ListDue(ctx, time.Now())
	if err != nil {
		log.Error().Err(err).Msg("User reminder checker: failed to list due reminders")
		return
	}
	if len(due) == 0 {
		return
	}

	var delivered int
	for _, r := range due {
		if c.deliver(ctx, r) {
			delivered++
		}
	}
	if delivered > 0 {
		log.Debug().Int("reminders_delivered", delivered).Msg("User reminder checker: cycle complete")
	}
}

func (c *UserReminderChecker) deliver(ctx context.Context, r services.Reminder) bool {
	meta, _ := json.Marshal(map[string]string{"reminder_id": r.ID})
	msg, err := c.chatService.SaveMessage(ctx, r.UserID, "assistant", r.Content, nil, meta)
	if err != nil {
		log.Error().Err(err).Str("reminder_id", r.ID).Msg("Failed to save reminder chat message")
		// Don't mark delivered — retry next tick.
		return false
	}

	// Open a reminder-delivery segment so the chat UI can group any follow-up
	// exchange under a header. Best-effort: a failure here doesn't block delivery.
	if c.memoryService != nil {
		header := models.SegmentHeader{
			Label:   "Reminder",
			RefType: "reminder",
			RefID:   r.ID,
		}.Marshal()
		c.memoryService.CloseActiveAndSummarize(ctx, r.UserID)
		if _, err := c.memoryService.StartSegment(ctx, r.UserID, "reminder_delivery", msg.ID, header); err != nil {
			log.Warn().Err(err).Str("user_id", r.UserID).Msg("Failed to start reminder segment")
		}
	}

	if c.notifService != nil {
		_ = c.notifService.SendToUser(ctx, r.UserID, "reminder", notifications.Payload{
			Body: r.Content,
			Data: map[string]string{"reminder_id": r.ID},
		})
	}

	if err := c.reminderSvc.MarkDelivered(ctx, r.ID); err != nil {
		// Worst-case the next tick re-delivers — chat message + push are
		// already out, so we accept the rare duplicate over swallowing the
		// log and forgetting we did the work.
		log.Error().Err(err).Str("reminder_id", r.ID).Msg("Failed to mark reminder delivered (may re-fire next tick)")
	}
	return true
}

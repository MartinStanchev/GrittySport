package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const resendURL = "https://api.resend.com/emails"

type ResendSender struct {
	apiKey string
	from   string
	http   *http.Client
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func (s *ResendSender) SendOTP(ctx context.Context, toEmail, code string) error {
	body := resendRequest{
		From:    s.from,
		To:      []string{toEmail},
		Subject: fmt.Sprintf("%s is your Gritty Fitness sign-in code", code),
		HTML:    otpHTML(code),
		Text:    otpText(code),
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal resend request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("send resend request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func otpText(code string) string {
	return fmt.Sprintf(`Your Gritty Fitness sign-in code is: %s

This code expires in 10 minutes. If you didn't request it, ignore this email.`, code)
}

func otpHTML(code string) string {
	return fmt.Sprintf(`<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 16px;">Your sign-in code</h2>
  <p style="font-size: 16px; color: #111;">Your Gritty Fitness verification code is <strong>%s</strong>.</p>
  <div style="font-size: 32px; font-weight: 600; letter-spacing: 6px; padding: 16px 24px; background: #f4f4f5; border-radius: 8px; display: inline-block; margin: 8px 0;">%s</div>
  <p style="font-size: 13px; color: #777;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
</body></html>`, code, code)
}

package email

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestResendSender_SendOTP_BuildsRequest(t *testing.T) {
	var captured *http.Request
	var capturedBody []byte

	rt := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		captured = r
		body, _ := io.ReadAll(r.Body)
		capturedBody = body
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"id":"abc"}`)),
			Header:     make(http.Header),
		}, nil
	})

	s := &ResendSender{
		apiKey: "test-key",
		from:   "Gritty <noreply@grittyfitness.app>",
		http:   &http.Client{Transport: rt},
	}

	if err := s.SendOTP(context.Background(), "user@example.com", "123456"); err != nil {
		t.Fatalf("SendOTP failed: %v", err)
	}

	if captured == nil {
		t.Fatal("expected request to be made")
	}
	if got := captured.URL.String(); got != resendURL {
		t.Errorf("expected URL %s, got %s", resendURL, got)
	}
	if got := captured.Header.Get("Authorization"); got != "Bearer test-key" {
		t.Errorf("unexpected Authorization header: %s", got)
	}
	if got := captured.Header.Get("Content-Type"); got != "application/json" {
		t.Errorf("unexpected Content-Type: %s", got)
	}

	var body resendRequest
	if err := json.Unmarshal(capturedBody, &body); err != nil {
		t.Fatalf("body not JSON: %v", err)
	}
	if body.From != "Gritty <noreply@grittyfitness.app>" {
		t.Errorf("unexpected From: %s", body.From)
	}
	if len(body.To) != 1 || body.To[0] != "user@example.com" {
		t.Errorf("unexpected To: %v", body.To)
	}
	if !strings.Contains(body.Text, "123456") || !strings.Contains(body.HTML, "123456") {
		t.Errorf("expected code in both text and HTML body")
	}
}

func TestResendSender_SendOTP_NonOKError(t *testing.T) {
	rt := roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusForbidden,
			Body:       io.NopCloser(strings.NewReader(`{"message":"forbidden"}`)),
			Header:     make(http.Header),
		}, nil
	})
	s := &ResendSender{apiKey: "k", from: "f", http: &http.Client{Transport: rt}}

	err := s.SendOTP(context.Background(), "u@e.com", "111111")
	if err == nil || !strings.Contains(err.Error(), "403") {
		t.Errorf("expected error containing 403, got %v", err)
	}
}

func TestResendSender_SendOTP_TransportError(t *testing.T) {
	rt := roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, errors.New("dial error")
	})
	s := &ResendSender{apiKey: "k", from: "f", http: &http.Client{Transport: rt}}

	if err := s.SendOTP(context.Background(), "u@e.com", "111111"); err == nil {
		t.Error("expected error on transport failure")
	}
}

func TestNew_DefaultsToMockWhenNoAPIKey(t *testing.T) {
	s := New(Config{ResendAPIKey: ""})
	if _, ok := s.(*MockSender); !ok {
		t.Errorf("expected MockSender when API key empty, got %T", s)
	}
}

func TestNew_UsesResendWhenAPIKeyPresent(t *testing.T) {
	s := New(Config{ResendAPIKey: "k", From: "f"})
	if _, ok := s.(*ResendSender); !ok {
		t.Errorf("expected ResendSender when API key present, got %T", s)
	}
}

func TestMockSender_RecordsAndResets(t *testing.T) {
	m := &MockSender{}
	if err := m.SendOTP(context.Background(), "a@b.com", "999999"); err != nil {
		t.Fatalf("SendOTP: %v", err)
	}
	if got := m.Sent(); len(got) != 1 || got[0].Code != "999999" {
		t.Errorf("unexpected Sent(): %+v", got)
	}
	m.Reset()
	if got := m.Sent(); len(got) != 0 {
		t.Errorf("expected empty after Reset, got %+v", got)
	}
}

# Flex Inference Tier

Implemented Gemini Flex service tier for background operations, achieving ~50% cost reduction on non-real-time API calls.

## What Changed

### Backend — `internal/ai/gemini.go`
- Added `flexHTTPOptions()` helper — injects `service_tier: "FLEX"` via `ExtraBody` + 10-minute timeout + `X-Server-Timeout: 600` header
- Added `applyFlexTier()` to set Flex options on any `GenerateContentConfig` while preserving existing settings
- Added `isFlexRetryable()` — detects transient 503/429/RESOURCE_EXHAUSTED errors
- Added `generateWithFlexRetry()` — shared retry loop (3 attempts, exponential backoff 1s/2s/4s) with fallback to Standard tier
- Added `GenerateContentFlex()` — Flex variant of `GenerateContent` (gemini-3-flash)
- Added `GenerateCheapFlex()` — Flex variant of `GenerateCheap` (gemini-2.0-flash-lite)

### Backend — `internal/review/service.go`
- `generateReview()` now accepts a `flex bool` parameter
- `TriggerReview()` passes `flex: false` — user-facing, real-time (Standard tier)
- `TriggerMissedReview()` passes `flex: true` — background scheduler (Flex tier)

### Backend — `internal/memory/service.go`
- `SummarizeSegment()` now uses `GenerateCheapFlex()` — async goroutine, no user waiting

### Tests — `internal/ai/flex_test.go`
- `TestFlexHTTPOptions` — verifies timeout, ExtraBody, headers
- `TestApplyFlexTier_NilConfig` — nil config creates fresh config with Flex
- `TestApplyFlexTier_PreservesExisting` — preserves SystemInstruction, MaxOutputTokens
- `TestIsFlexRetryable` — 8 subtests covering nil, non-retryable, 503, 429, RESOURCE_EXHAUSTED

## Tier Assignment

| Operation | Tier | Reason |
|-----------|------|--------|
| Chat with tools | Standard | Real-time streaming to user |
| Segment type detection | Standard | In request path (~500ms) |
| Segment completion check | Standard | In request path (~500ms) |
| Preference condensing | Standard | In request path |
| Post-workout review | Standard | User polls for result immediately |
| **Missed workout review** | **Flex** | Background scheduler, no user waiting |
| **Segment summarization** | **Flex** | Async goroutine |
| Pre-workout check-in (Task 14) | Flex (planned) | Hours before workout |

## Cost Impact

- Flex tier = 50% of Standard pricing on all supported models
- Background operations represent ~40-50% of total Gemini API spend
- Net savings: ~20-25% reduction in total per-user API cost
- Fallback to Standard tier ensures zero user-facing failures

## SDK Note

The `google.golang.org/genai` SDK v1.48.0 does not yet have a native `ServiceTier` field. Used `HTTPOptions.ExtraBody` to inject `service_tier: "FLEX"` into the request body — no SDK upgrade required.

## Key Files
- `backend/internal/ai/gemini.go` — Flex methods + retry logic
- `backend/internal/ai/flex_test.go` — Unit tests
- `backend/internal/review/service.go` — Missed review on Flex
- `backend/internal/memory/service.go` — Summarization on Flex

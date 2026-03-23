# Live Workout Screen Redesign

Redesigned the GPS live workout recording screen to match the app's newer dark Aura Kinetic language while preserving the existing workout tracking behavior.

## Changes

### Live Tracker UI
- Rebuilt **`frontend/src/screens/RecordGPSScreen.tsx`** with a new structure:
  - dominant live map with route polyline and custom current-position dot
  - floating top HUD for dismiss, workout type, recording state, and GPS quality
  - large hero metrics for elapsed time, distance, and current pace/speed
  - compact secondary metric cards for average pace/speed, heart rate, cadence, elevation, and lap
  - upgraded control dock for start, pause/resume, lap, finish, and discard
  - heart-rate sensor connection row styled to match the rest of the app
- Follow-up UX pass:
  - changed the default state to a map-first collapsed mode where only the time/distance/pace pill remains docked at the bottom
  - moved the full metrics into a larger expanded bottom sheet with more room for cards and controls
  - removed the wasted "Live Session / Key Metrics" header chrome
  - moved the old points pill into the metrics grid as a proper GPS points stat
  - tightened the top workout-status pill so short labels like `Run` do not leave excessive empty space

### Supporting Helpers
- Added **`frontend/src/utils/liveWorkout.ts`** for reusable live-workout presentation helpers:
  - activity label formatting
  - recording status labels
  - GPS quality classification

### Tests
- Added **`frontend/src/__tests__/liveWorkout.test.ts`** covering the new live-workout UI helpers.

## Stitch
- Used the existing Stitch design project **`18237625510161915188`** as the design-system reference for colors, typography, and overall screen direction.
- Attempted new in-project Stitch generation for the live workout mockup via MCP, but Stitch generation timed out; implementation was aligned to the established project language after reviewing the existing project context.

## Verification
- Frontend tests: `npm test -- --runInBand` passed (`162` tests)
- Frontend lint: `npm run lint` passed with pre-existing warnings elsewhere in the repo
- Backend lint: `golangci-lint run` passed
- Backend tests: `go test ./...` failed in existing `internal/ai/prompt_test.go` prompt-loading tests unrelated to this UI change

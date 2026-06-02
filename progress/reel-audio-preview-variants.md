# Reel audio, live preview & A/B variants (marketing studio — Phase 9)

Third and final planned phase of the reel-compositor expansion. Adds sound,
an in-dashboard scrubbable preview, and one-click hook A/B batches. On the
`marketing-playground` branch.

## What shipped (features 2, 12, 13)

### #2 Audio track + beat-synced cuts
- `reels/src/ReelAudio.tsx`: background music via `<Audio>` with a 0.4s fade-in and
  0.8s fade-out, `volume` + `startFromSec` controls. Rendered by both `StoryReel`
  and `SingleHero` (new optional `music` prop).
- Tracks live in `reels/public/audio/<file>` (gitignored except the README; a
  `test-tone.mp3` is generated locally for testing). `staticFile` for render,
  served by the dashboard at `/api/audio/<file>` for preview.
- **Beat-synced cuts:** a `bpm` setting snaps each beat's duration to a whole
  number of musical beats (`applyBpm` in `reel.mjs`) so cuts land on the beat —
  deterministic, no audio analysis.

### #12 Live scrub preview (`@remotion/player`)
- `reels/preview/`: a small esbuild IIFE bundle (`build.mjs` → `dist/preview.js`,
  `npm run build:preview`) that hosts `@remotion/player` + the reel compositions and
  mounts a `<Player>` on a `postMessage('preview')`. `index.html` is the iframe doc.
- `reel.mjs` `resolveReelPreview()` resolves a reel to `{compositionId, inputProps,
  durationInFrames, fps, width, height}` **without rendering**, using a `url` media
  resolver so beat assets point at the dashboard's `/api/posts/:id/asset` endpoint
  (and music at `/api/audio/...`) — both same-origin in the preview iframe.
- Dashboard: a **Preview** button POSTs the current builder state to
  `/api/reel/preview` and `postMessage`s the spec into the `<iframe src="/preview/">`;
  the Player plays/scrubs frame-accurately. Kills the "re-render to see it" loop.

### #13 Hook A/B variants
- `reel.mjs` `buildReelVariants({hookVariants, ...base})` builds one reel per
  alternate hook line (swapping the first `hook` beat's text, everything else held
  constant). Each variant is its own queue post with its caption set to the hook line.
- Dashboard: an **A/B hook lines** textarea (one line each) + **Build variants**
  button → `POST /api/reel/variants`.

## Refactor enabling the above

- `reel.mjs` media resolution is now a **pluggable resolver**: `stageResolver`
  (copies into `public/staged/` for an actual render) vs `urlResolver` (asset URL
  for preview). A shared `prepareReel()` core validates + resolves beats + assembles
  `inputProps`; `buildReel` (render) and `resolveReelPreview` (no render) both go
  through it. `music`/`bpm` persist in the recipe (so editing restores them).
- `reels/src/metadata.ts` `storyDurationInFrames()` is shared by Root's
  `calculateMetadata` and the preview duration so they can't disagree — and it fixes
  a latent bug where `transition: 'none'` (hard cuts, no overlap) truncated the last
  beat.
- `dashboard/server.mjs`: `/api/audio` (list) + `/api/audio/:file` (serve, path-
  traversal-guarded), `/api/reel/preview`, `/api/reel/variants`, and `/preview/*`
  static serving of the Player bundle.
- Dashboard JS factored a shared `reelBuildPayload()` + `validateReelBeats()` used by
  build / preview / variants.

## New deps

- `@remotion/player@4.0.471` (dep) + `esbuild` (devDep) in `reels/package.json`.

## Verified

- `reels` `tsc --noEmit` clean (preview/entry.tsx is esbuild-bundled, intentionally
  outside tsc); `node --check` on `reel.mjs` + `server.mjs`; dashboard JS parses.
- #2: rendered a reel with `test-tone.mp3` + `bpm 120` — output has an audio stream,
  duration matches the beat-snapped frames, recipe persists music + bpm.
- #13: `buildReelVariants` with two hook lines produced two distinct posts (captions
  = the hook lines). (Test posts deleted.)
- #12: all endpoints return correctly (`/api/audio`, `/api/reel/preview` →
  url-resolved assets + 148-frame bpm-snapped duration, `/preview/*` serves the
  1.2 MB bundle); a headless-Chromium smoke loaded `/preview/`, posted a spec, and
  the Player rendered the reel (captured the stat beat mid-count-up) with no console
  errors.
- Code-simplifier pass applied (CLAMP const + named fades in `ReelAudio`,
  `flatMap` in `StoryReel`, `urlResolver` de-factoried); preview bundle rebuilt after.

## Operational notes

- Backend studio modules (`reel.mjs`, `dashboard/server.mjs`) require a dashboard
  **restart** to take effect; the `index.html` UI is served fresh. After changing
  `reels/src/**` that the preview imports, rerun `npm run build:preview`.
- Publishing automation (X / Reddit / IG / TikTok) remains deferred — manual posting.

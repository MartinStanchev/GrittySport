# Marketing Content Studio (Phase 1: headless still capture)

Foundation for a semi-autonomous marketing pipeline: generate → render → review →
export for manual posting. Phase 1 delivers automated **image** capture of the
existing Marketing Playground scenes. Built on the `marketing-playground` branch so
none of it touches the stable app build.

## Branch setup

- `marketing-playground` was ~11 commits behind `main`. Merged `main` in (only
  `PROGRESS.md` conflicted — took main's index and re-added the dropped
  `marketing-playground` row). Branch now contains all of main + the playground.
- Safety backup branch `marketing-playground-premerge` left at the pre-merge tip.

## Headless render route (frontend)

- `App.tsx`: on **web + `__DEV__`**, if `?marketingRender=<sceneId>` is in the URL,
  render the scene standalone — bypasses auth/navigation entirely.
- `src/marketing/renderParams.ts`: parses `marketingRender` + `theme` from the URL
  (returns null on native / when absent).
- `src/marketing/MarketingRender.tsx`: looks up the scene, renders the existing
  `SceneStage` so output is pixel-identical to the playground. Publishes scene
  metadata (kind, device, width, height, found) on `window.__marketingScene` and a
  `data-testid="marketing-render-ready"` readiness marker for the capture tool.
- `src/contexts/ThemeContext.tsx`: added optional `forceDark` prop so the theme is
  pinned deterministically for capture (skips the stored preference).
- `src/screens/MarketingPlaygroundScreen.tsx`: exported `SceneStage` +
  `getMarkdownStyles` for reuse (no behavior change to the playground).

URL: `http://localhost:8081/?marketingRender=<sceneId>&theme=light|dark`

## Capture tooling (`marketing-studio/`)

- Standalone in-repo Node package (`type: module`). Playwright pinned to **1.59.0**
  to match the Chromium build (1217) already cached in `~/.cache/ms-playwright`
  (1.60 expects 1223 → would force a download).
- `capture/still.mjs`: drives the render route with headless Chromium, reads device
  dims off `window.__marketingScene` (single source of truth — no duplicated table),
  sizes the viewport, screenshots at `deviceScaleFactor: 3`.
- `config.mjs`: base URL (`localhost:8081`), scale, paths, timeouts.
- `.gitignore`: `node_modules/`, `content/` (generated assets stay local).

## Verified

- `npx tsc --noEmit`: no errors in changed files (5 pre-existing chart/notification
  library-typing errors only).
- `eslint` on all changed files: clean (removed a pre-existing unused `Text` import
  in `App.tsx`).
- End-to-end captures against the running Expo web server produced crisp 1179×2556
  PNGs for all three scene kinds: chat (`sanity-check`, `example-post-workout-review`),
  lockscreen (`example-missed-workout-lockscreen`), edit-proposal
  (`example-edit-proposal`), in both light and dark.

## Known issue

- Inline markdown code renders with a line-overlap quirk on react-native-web (fine on
  device). Not a blocker — marketing scenes avoid inline code.

## Next phases

- Video templates (chat replay, screenshot scroll) → MP4 via Playwright frames + ffmpeg.
- Content queue (`content/<id>/post.json` + asset + caption + platforms + status).
- Local review dashboard (preview, edit caption, set status, download for manual posting).
- Publishing automation deferred until platform API access is approved.

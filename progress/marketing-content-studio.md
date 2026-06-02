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

## Phase 2: video templates (MP4)

Vertical MP4 output for TikTok / IG Reels / Shorts. Playwright's bundled ffmpeg is a
stripped VP8/WebM build (no H.264, no `zoompan`/`xfade`/`fps`), so the studio depends
on **`ffmpeg-static`** (full libx264 build, no sudo).

Frontend (replay support):
- `src/marketing/ChatReplayStage.tsx` (new): renders a chat scene with a
  controllable visible-message count + optional "Thinking..." typing row, reusing the
  real `ChatHeader` / `ChatMessageItem` and a static input bar. Exposes
  `window.__marketingReplay = { ready, total, roles, setStep(count, typing) }` so the
  capture tool drives timing (timing lives in the tool, not the app).
- `renderParams.ts` + `App.tsx` + `MarketingRender.tsx`: thread a `replay` flag
  (`?…&replay`); chat scenes with `replay` render `ChatReplayStage`.

Studio:
- `lib/browser.mjs`: `withScenePage()` — shared boot + readiness handshake (still,
  scroll, replay all use it; `waitForReplay` waits on `window.__marketingReplay`).
- `lib/ffmpeg.mjs`: `runFfmpeg`, `readPngSize`, `encodeScroll` (pan a tall still down
  a 1080×1920 window), `encodeFrameSequence` (held stills → constant-fps MP4 via the
  concat demuxer; last frame repeated so its duration is honored).
- `lib/cli.mjs`: `parseSceneArgs` + `isMain` (dedupes the per-script arg parsing).
- `video/chat-replay.mjs`: builds a storyboard from message roles (typing hold before
  each Grit message), steps the page, screenshots each state, encodes. Output is
  1080-wide at the phone's natural aspect (e.g. 1080×2342).
- `video/scroll.mjs`: full-page screenshot → `encodeScroll` → 1080×1920 9:16.
- `still.mjs` refactored onto `withScenePage`.

Verified end-to-end against the running Expo web server:
- `example-post-workout-review` chat replay → valid 1080×2342 H.264, 8.2s; mid-frame
  shows header + segment eyebrow + first Grit message + input bar.
- `example-program-proposal` scroll → 1080×1920 H.264, 7s; pans the full conversation
  through the proposal card.
- `eslint` clean on changed frontend files; `node --check` clean on all studio files.

## Phase 3: content queue + local review dashboard

Filesystem-backed queue + a local web dashboard that is the single control surface
(generate → review → export). No DB, no extra runtime deps (Node built-in `http`).

Frontend (scene-registry probe):
- `src/marketing/MarketingSceneList.tsx` (new): visiting `?marketingScenes` publishes
  the scene registry on `window.__marketingScenes` and renders nothing. Wired in
  `App.tsx` via `isMarketingSceneListRequest()` (`renderParams.ts`). Lets the
  dashboard populate its scene picker without duplicating the list.

Studio:
- `lib/queue.mjs`: post CRUD over `content/posts/<id>/` (`post.json` + `asset.*`).
  Only caption/platforms/status/notes are user-editable; `makePostId` = sortable
  `YYYYMMDDHHMM-<scene>-<format>`.
- `lib/scenes.mjs`: `fetchSceneList()` reads the probe via Playwright.
- `generate.mjs`: format → capture fn (still/chat-replay/scroll), renders straight
  into the post folder, writes `post.json` (stills also store width/height). CLI +
  exported `generatePost()`.
- `dashboard/server.mjs`: Node `http` API — `GET /api/posts`, `GET /api/scenes`
  (cached), `POST /api/generate`, `PATCH/DELETE /api/posts/:id`, and
  `GET /api/posts/:id/asset` with HTTP range support so video seeks work.
- `dashboard/index.html`: single-file vanilla-JS UI — create panel (scene/format/
  theme/caption/platforms + Generate) and a queue grid (inline image/video preview,
  editable caption, platform checkboxes, status select, download, delete).
- `package.json` scripts: `still`, `scroll`, `chat-replay`, `generate`, `dashboard`.

Gotcha found + fixed during testing: `expo start --web` was launched with `CI=1`,
which **disables Metro's file watcher**, so newly-added files (the scene-list probe)
weren't bundled. Restart without `CI=1` (the `dev-server` script does). Documented.

Verified end-to-end: generated a still + a chat-replay post via the generator;
dashboard listed both, played the replay inline, previewed the lockscreen still,
PATCH moved a post to `ready` (green badge), assets served with correct
content-types, scene picker populated with all 9 scenes.

## Phase 4: Remotion reel compositor (iPhone frame + transitions + stitching)

Turns bare screen captures into polished vertical reels. New `marketing-studio/reels/`
Remotion project (React DOM, separate package + node_modules; pinned 4.0.471).

- `reels/src/PhoneFrame.tsx`: titanium bezel + rounded screen + side buttons. Dynamic
  Island is **off by default** — captures already include their own status bar / chat
  header, so an overlaid island covered content.
- `reels/src/ScreenMedia.tsx`: fills the screen with `<Img>`/`<OffthreadVideo>`; src is
  an http URL or a path relative to `public/` (staged there per render).
- `reels/src/SingleHero.tsx`: one scene in a floating/tilting phone on a branded
  gradient + headline + GRITTY wordmark.
- `reels/src/StoryReel.tsx`: `TransitionSeries` of beats (slide transitions) with
  per-beat captions.
- `reels/src/Root.tsx`: registers both, `calculateMetadata` derives duration from
  props (Hero: prop; Story: Σ beats − transitions). Sample assets in `public/` for
  Remotion Studio preview.
- `reels/render.mjs`: programmatic render (`@remotion/bundler` + `@remotion/renderer`)
  → MP4. Bundles per call so freshly-staged assets are picked up.

Studio orchestration + dashboard:
- `reel.mjs`: `buildReel({template, beats, headline, theme})` — resolves each beat from
  a queued post (or path), copies it into `reels/public/staged/<id>/`, times beats
  (video = probed duration via new `probeDurationSec` in `lib/ffmpeg.mjs`; images get a
  default), builds inputProps, renders into a new queue post, cleans up staged. CLI +
  exported.
- `dashboard/server.mjs`: `POST /api/reel`; `/api/posts` now also returns
  `reelTemplates`.
- `dashboard/index.html`: "+ Reel" on each card adds it as a beat; a "Build a reel"
  panel (template/theme/headline + per-beat captions) calls the endpoint; the finished
  `*-reel` MP4 appears in the queue.

De-risked first: confirmed Remotion renders 1080×1920 H.264 in this WSL env (no Chrome
issue; it fetches its own Headless Shell). Verified end-to-end: a 3-beat **story reel**
(14.2s) and a **hero reel** rendered both via CLI and via the dashboard `POST /api/reel`,
landing in the queue with `sourcePosts` tracked; reel-builder UI wired (+Reel → panel →
Build). `reels` `tsc --noEmit` clean.

Note: Remotion is free for individuals / teams ≤3; a company license applies above that.

## Phase 5: reel controls + clipping fix (from testing feedback)

- **Clipping fix:** `ScreenMedia` now uses `objectFit: contain` (was `cover`). Scroll
  videos are 9:16 (1080×1920) — wider than the phone screen (≈0.461) — so `cover`
  side-cropped them (lost the day labels). `contain` fits any aspect fully (matching
  stills/chat-replays still fill edge-to-edge; scroll gets subtle top/bottom letterbox
  that reads as screen bezel).
- **Per-beat timing:** `reel.mjs` accepts per-beat `seconds` (override) + `speed`
  (video `playbackRate`); video beats default to full-clip/speed, stills to a readable
  default (story 4.5s). Compositions take `media.playbackRate`. Fixes "scenes too short
  / don't show".
- **Transition + animation:** `StoryReel` takes `transition` (slide/fade/wipe/flip/none
  → `@remotion/transitions`) and `motion` (float/kenburns/tilt/none) applied per beat;
  `SingleHero` takes `motion`. New `reels/src/presets.ts` maps both.
- **Generation speed:** `chat-replay` gets a `--speed` multiplier (scales typing/message
  holds); `scroll` keeps `--duration`. `generate.mjs` threads `seconds`/`speed` per
  format.
- **Dashboard:** reel builder gains Transition + Animation selects and per-beat
  duration/speed inputs; generate panel gains a contextual Duration(s)/Speed(×) field.

Verified: scroll beat renders fully contained (no crop); chat-replay at 2× = 4.2s (vs
8.2s); a reel with wipe transition + tilt motion + per-beat speed/duration rendered via
`POST /api/reel`; reel-builder UI shows all controls; `reels tsc` clean.

**Reel-in-reel guard (follow-up):** a finished `*-reel` is already framed, so using one
as a beat produced a phone-in-phone (+ doubled caption). The dashboard now hides "+ Reel"
on `*-reel` cards, and `reel.mjs` rejects a reel-format beat server-side.

## Deferred

- Publishing automation (X / Reddit / IG / TikTok). Manual posting for now; wire in
  here once platform API access is approved.

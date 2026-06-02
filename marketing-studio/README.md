# Gritty Marketing Studio

Local tooling to turn the in-app **Marketing Playground** scenes into social-media
assets: render images (and soon video), queue them, review locally, and export for
manual posting. Lives on the `marketing-playground` branch so nothing here touches
the stable app build.

## How it works

The Expo app exposes a headless render route in **dev + web only**: opening
`http://localhost:8081/?marketingRender=<sceneId>&theme=light|dark` mounts a single
`Scene` full-screen through the *real* chat / lockscreen / proposal components
(`frontend/src/marketing/MarketingRender.tsx`, wired in `App.tsx`). The page
publishes the scene's target device dimensions on `window.__marketingScene`.

The capture tooling here drives that route with headless Chromium (Playwright),
sizes the viewport to the device, and screenshots at 3× for crisp output.

## Prerequisites

1. Install deps: `npm install` (Playwright is pinned to **1.59.0** to match the
   Chromium build already cached on this machine).
2. Start the Expo **web dev server** (the render route does not exist in a static
   export, because it's `__DEV__`-gated):
   ```
   cd ../frontend && npx expo start --web --port 8081
   ```

## Capture a still

```
node capture/still.mjs <sceneId> [--theme light|dark] [--out file.png] [--url http://localhost:8081]
```

Example:
```
node capture/still.mjs example-post-workout-review --theme dark
# → content/_stills/example-post-workout-review-dark.png  (393×852 @3x = 1179×2556)
```

Scene ids come from the registry in `frontend/src/marketing/scenes.ts`. Author new
scenes with the `marketing-scene` skill.

## Capture a video (MP4, for TikTok / IG Reels / Shorts)

Uses `ffmpeg-static` (bundled full H.264 build — no system ffmpeg needed).

**Chat replay** — a chat scene plays back message-by-message with the real
"Thinking..." typing indicator, like watching the conversation happen:
```
node video/chat-replay.mjs <chatSceneId> [--theme light|dark] [--out file.mp4]
# → content/_video/<scene>-<theme>-replay.mp4  (1080-wide, phone aspect, 30fps H.264)
```

**Scroll** — pan a vertical 1080×1920 window down the full content of a (tall) scene:
```
node video/scroll.mjs <sceneId> [--theme light|dark] [--duration 8] [--out file.mp4]
# → content/_video/<scene>-<theme>-scroll.mp4  (1080×1920 9:16, 30fps H.264)
```

Chat-replay pacing lives in `video/chat-replay.mjs` (typing / message / end holds).

## Queue + review dashboard

Generated posts live in `content/posts/<id>/` (a `post.json` + the asset). The
dashboard is the main control surface: generate, preview, edit caption, pick
platforms, set status (draft → ready → posted), download, delete.

```
npm run dashboard          # → http://localhost:4321
```

Keep the Expo web server running too — the dashboard's scene picker and the
"Generate" button drive it. From the dashboard you can render a new post in the
browser, or use the CLI:

```
node generate.mjs <sceneId> --format still|chat-replay|scroll \
  [--theme light|dark] [--caption "..."] [--platforms instagram,tiktok]
```

Publishing is intentionally manual for now: download the asset, copy the caption,
post it yourself. Auto-publishing slots in here later once platform API access
is approved.

## Reels (iPhone frame + transitions)

The `reels/` sub-project (Remotion) composes the rendered scene assets into polished
vertical videos: each scene sits in an iPhone frame on a branded gradient, with
animation and (for multi-beat reels) sliding transitions + per-beat captions.

Two templates:
- **Single Hero** — one scene in a floating/tilting phone + a headline.
- **Story Reel** — multiple beats stitched with transitions (e.g. notification → chat → week).

From the dashboard: hit **“+ Reel”** on queued posts to add them as beats, pick a
template + theme (+ headline for Hero), write a caption per beat, and **Build reel**.
The finished MP4 lands back in the queue as a `*-reel` post.

CLI equivalent:
```
node reel.mjs --template story --theme dark \
  --beat <postId>:"Grit notices when you miss." \
  --beat <postId>:"And starts the conversation." \
  --beat <postId>:"Your whole week, adjusted."
```

Preview/iterate on the templates live with Remotion Studio:
```
cd reels && npm run studio
```
(One-time: `cd reels && npm install`. Remotion is free for individuals/small teams;
a company license applies above ~3 people.)

## Notes

- Inline code (markdown `` `code` ``) renders with a layout quirk on react-native-web;
  it's fine on device. Grit's marketing voice avoids code anyway.
- Config (base URL, scale factor, paths, timeouts) lives in `config.mjs`.

## Roadmap

- [x] Still capture → PNG
- [x] Video templates (chat replay message-by-message, screenshot scroll) → MP4 via ffmpeg
- [x] Content queue (`content/posts/<id>/post.json` + asset + caption + target platforms + status)
- [x] Local review dashboard (generate, preview, edit caption, set status, download)
- [x] Reels compositor (Remotion): iPhone frame, animation, transitions, multi-scene stitching
- [ ] Publishing (deferred — manual posting until platform API access is approved)

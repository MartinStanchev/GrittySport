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

## Notes

- Inline code (markdown `` `code` ``) renders with a layout quirk on react-native-web;
  it's fine on device. Grit's marketing voice avoids code anyway.
- Config (base URL, scale factor, paths, timeouts) lives in `config.mjs`.

## Roadmap

- [ ] Video templates (chat replay message-by-message, screenshot scroll) → MP4 via ffmpeg
- [ ] Content queue (`content/<id>/post.json` + asset + caption + target platforms + status)
- [ ] Local review dashboard (preview, edit caption, set status, download)
- [ ] Publishing (deferred — manual posting until platform API access is approved)

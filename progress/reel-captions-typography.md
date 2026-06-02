# Reel captions & typography (marketing studio — Phase 7)

First of three planned phases expanding the Remotion reel compositor. Phase 7 is
the text-rendering foundation everything downstream renders through: real brand
fonts, word-by-word kinetic captions, selectable caption presets, and
platform-safe-zone-aware layout. All on the `marketing-playground` branch.

## What shipped (features 11, 1, 14, 9)

- **#11 Real brand fonts.** `reels/src/fonts.ts` loads Space Grotesk (display /
  captions / wordmark) + Inter (body) via `@remotion/google-fonts` at module eval,
  latin subset only (keeps per-render font fetches small — was 21 requests).
  Replaces the old system-font fallback. Note: Space Grotesk tops out at 700, so
  headlines use 700 (the old code asked for a synthetic 800).
- **#1 Word-by-word kinetic captions.** `reels/src/Caption.tsx` reveals a caption
  one word at a time with a spring pop-in; the most-recently-revealed word is
  "active" and emphasised per the preset. Timing is **scripted** (words spread
  evenly over a reveal window) — no Whisper/transcription, because reel captions are
  authored, not spoken. Replaces the single static caption block in `StoryReel`.
- **#14 Caption presets / brand kit.** `reels/src/brandKit.ts` centralises the
  palette + `CAPTION_PRESETS` (`clean` / `karaoke` / `boxed` / `pop`) and
  `resolveCaptionStyle(preset, theme)`. Highlight modes: `none` (pop-in only),
  `dim` (past words fade, active takes accent), `box` (accent pill behind white text
  — TikTok classic), `pop` (active word scales + accent). Theme-aware (accent
  lightens on dark, base text colour follows theme).
- **#9 Platform safe-zones.** `reels/src/safeZones.tsx` holds `SAFE_ZONES` insets
  for `tiktok` / `reels` / `shorts` (px at 1080×1920), `stageLayout(zone)` which
  scales + repositions the phone and lifts the caption clear of the bottom chrome
  band, and a dev-only `SafeZoneOverlay` (toggled by the `showSafeZones` prop in
  Remotion Studio). `none` is the default and reproduces the original framing
  exactly, so pre-existing reels are visually unchanged.

## Wiring

- `theme.ts` slimmed to just `background()`; palette/fonts/text-colour moved to
  `brandKit`/`fonts`. `StoryReel` + `SingleHero` rewired onto `stageLayout` +
  `resolveCaptionStyle`/`FONTS`. `Root.tsx` default props gain
  `captionPreset` / `safeZone` / `showSafeZones`.
- `reel.mjs`: `buildReel` accepts `captionPreset` + `safeZone`, threads them into
  the composition `inputProps` (renders force `showSafeZones:false`) and persists
  them in the saved recipe; `--caption-preset` / `--safe-zone` CLI flags added.
- `dashboard/index.html`: reel builder gains **Captions (Story)** + **Safe zone**
  selects, included in the build/update payload and restored when editing a reel's
  recipe.

## New deps

- `@remotion/google-fonts@4.0.471` added to `reels/package.json`.

## Verified

- `reels` `npx tsc --noEmit` clean; `node --check reel.mjs` ok; dashboard inline JS
  parses.
- End-to-end renders against the sample assets in `reels/public/`:
  - Story / `boxed` / `tiktok` zone / `showSafeZones` on → phone scales to fit above
    the bottom safe band, caption sits inside the safe area, active-word accent pill
    visible ("ADJUSTED").
  - Story / `pop` / `none` zone → original centred framing preserved; early frame
    shows only the first revealed words (word-by-word confirmed); real Space Grotesk
    face rendering.
- Code-simplifier pass applied (notably renamed a `window`-shadowing local in
  `Caption.tsx`).

## Next (planned)

- **Phase 8 — template library:** hook card, before/after split, stat count-up, CTA
  end card (badges + QR), tap-pointer realism.
- **Phase 9 — audio, live preview, A/B variants:** music + beat-synced cuts
  (`@remotion/media-utils`), in-dashboard `@remotion/player` scrub preview, one-click
  N-variant hook batches.

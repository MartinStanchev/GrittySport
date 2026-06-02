# Reel template library (marketing studio — Phase 8)

Second of three phases expanding the Remotion reel compositor. Phase 8 turns a
Story reel from "phone screenshots only" into a sequence of **heterogeneous
beats**, so one reel can run hook → screenshots → stat → CTA. All on the
`marketing-playground` branch.

## Architecture: heterogeneous beats

A Story reel is now `Beat[]` where each beat has a `kind` (`reels/src/beats/types.ts`).
All kinds render on the same branded background and stitch through the existing
`TransitionSeries`, dispatched by `reels/src/beats/BeatScene.tsx`. **Default kind is
`media`**, so pre-Phase-8 reels/recipes (which have no `kind`) still render
unchanged.

## What shipped (features 4, 5, 6, 7, 8)

- **#4 Hook card** (`beats/HookBeat.tsx`) — opening pattern-interrupt: accent kicker
  over a big Space-Grotesk line that reveals word-by-word, with an accent underline
  that swipes in.
- **#5 Before/After split** (`beats/SplitBeat.tsx`) — two phones slide in from
  opposite edges with ✕/✓ labels (the "before" side desaturated + dimmed), an arrow
  between, and an optional caption. Built for "generic plan vs Grit's adaptive plan".
- **#6 Stat count-up** (`beats/StatBeat.tsx`) — a huge accent number springs up from
  0 to `value` (integer or 1-decimal), with `prefix`/`suffix` and a label.
- **#7 CTA end card** (`beats/CtaBeat.tsx`) — GRITTY wordmark, headline, sub, App
  Store + Google Play badges (inline SVG logos), and an optional QR. The QR is
  pre-rendered to a data URL by `reel.mjs` (via the `qrcode` dep) from the CTA's `qr`
  URL and passed in as `qrDataUrl`.
- **#8 Tap-pointer realism** (`reels/src/TapPointer.tsx`) — a soft touch pointer
  glides to each `{xPct,yPct,atSec}` and a ripple pulses at the tap moment, rendered
  inside `PhoneFrame` over the media so it inherits the screen clip. Makes a still
  screenshot read as real usage.

`beats/MediaBeat.tsx` is the original phone-framed scene (caption + optional tap
overlay), extracted from the old `StoryReel` body. `safeZones.tsx` gained
`usableCenterOffset(zone)` so card content centres in the usable area under a safe
zone.

## Orchestration (`reel.mjs`)

- `buildBeat()` resolves each authoring beat into the concrete render beat:
  media/split stage their asset(s) into `reels/public/staged/<id>/`
  (`stageMedia`/`resolveSource`, reused for both split sides); cta generates the QR
  data URL; hook/stat pass through; defaults per kind via `DEFAULT_CARD_SECONDS`,
  overridable with `seconds`.
- `hero` template still single-scene and now explicitly rejects non-media beats.
- Recipe persists the raw authoring beats (keeps `qr` URL + postIds/src so editing
  re-renders), `sourcePostIds` tracks media + split postIds.

## Dashboard (`dashboard/index.html`)

- Reel builder is now **model-bound**: inputs mutate the `reelBeats` array via
  `setBeatField` (no re-render on keystroke → focus kept); only add/remove/move/kind
  changes re-render. `beatFields()` renders kind-specific editors; `beatPayload()`
  coerces to the API shape.
- New **Insert card** control (hook / stat / CTA / before-after) + per-beat move
  up/down. Split beats pick before/after from image posts in the queue. Media beats
  gain a `taps` field (`x,y@s; …`). Editing a reel restores all beat kinds from the
  recipe.

## New deps

- `qrcode@1.5.4` added to the **studio** `package.json` (used by `reel.mjs`, node
  side — not the reels bundle).

## Verified

- `reels` `tsc --noEmit` clean; `node --check reel.mjs` ok; dashboard inline JS parses.
- Rendered a 5-beat reel (hook → stat → split → cta → media+taps) against the sample
  assets and inspected one frame per kind: hook headline + underline, stat counted to
  7 + label, split with desaturated "before"/vibrant "after" + labels, CTA with both
  store badges, media with the tap pointer clipped inside the phone + word-by-word
  caption. All correct.
- Integration test through `reel.mjs buildReel`: hook → split(from src) → cta(qr)
  rendered end-to-end, recipe persisted the `qr` URL + split sides, staged dir cleaned
  up, asset written. (Test post deleted after.)
- Code-simplifier pass applied (switch-based dispatch in `BeatScene`, `buildBeat`,
  and the dashboard `beatFields`/`beatPayload`, with explicit `default` arms).

## Next (planned)

- **Phase 9 — audio, live preview, A/B variants:** music + beat-synced cuts
  (`@remotion/media-utils`), in-dashboard `@remotion/player` scrub preview, one-click
  N-variant hook batches.

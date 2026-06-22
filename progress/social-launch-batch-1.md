# Social launch — content batch 1

First batch of marketing content for the Instagram/TikTok launch, all built on the
`marketing-playground` branch via the marketing studio. Goal: buffer posts that hammer
the product wedge — **Gritty is for people who do *many* things** (football Sunday,
climbing Saturday, long rides, plus the strength/yoga/physio scheduled around them) —
not single-sport apps like Runna/Nike. Grit doesn't force a program; the user stays in
control and the plan flexes around their life.

## 5-post concept set

| # | Angle | Format(s) | Scene |
|---|-------|-----------|-------|
| 1 | "The week no single-sport app can hold" | still (feed cover) + scroll reel (full week) | `post-real-week` (new) |
| 2 | "You add it, Grit reshuffles — you're in control" | chat-replay | `post-you-are-in-control` (new) |
| 3 | "Missed a session? No streak-shaming" | lockscreen still | `example-missed-workout-lockscreen` |
| 4 | "Every workout reviewed, across all your sports" | chat-replay | `example-post-workout-review` |
| 5 | "Tell Grit what you're into → plan in seconds" | chat-replay | `example-program-proposal` |

## New scenes

- `frontend/src/marketing/scenes/post-real-week.ts` — `program-week` scene, a believable
  multi-sport week incl. **running** (per request): Mon strength, Tue run, Wed long ride,
  Thu yoga (today), Fri strength, Sat climbing, Sun football. Early week completed (green
  ticks = progress tracked), `highlightDayIdx: 3` makes Thu "today".
- `frontend/src/marketing/scenes/post-you-are-in-control.ts` — `chat` scene with a
  `program_edit` proposal: user adds a Sunday 5-a-side; Grit `add_activity` football +
  `update_activity` to lighten Friday strength (before→after), plus quick-reply chips.
- Registered both in `frontend/src/marketing/scenes.ts` under a new `Social posts` group.

## Cosmetic activity types (football / climbing)

`frontend/src/constants/activityIcons.ts` gained `football` and `climbing` entries in
`ACTIVITY_ICONS` (`football-outline` / `triangle-outline`), `ACTIVITY_DISPLAY_NAMES`
("Football"/"Climbing"), and `SPORT_COLOR_MAP` (`#EF4444` red / `#D97706` amber).
**Cosmetic only** — the lookups are `includes`-based, so these render correctly without
being added to the canonical `ACTIVITY_TYPES` enum (kept out to avoid backend/enum
coupling). This is what makes the multi-sport week read clearly (distinct icon+color per
sport) instead of three generic purple rows. If football/climbing ever become
first-class logged types, do it properly across backend + intake then.

## Assets generated (studio queue, all `draft`)

Rendered dark theme, captions + `platforms: [instagram, tiktok]` pre-filled:
- `post-real-week` — still (1179×2556) + scroll mp4 (1080×1920, 9s)
- `example-missed-workout-lockscreen` — still
- `post-you-are-in-control` — chat-replay mp4 (1080×2342, ~9s)
- `example-post-workout-review` — chat-replay mp4 (~8s)
- `example-program-proposal` — chat-replay mp4 (~13s)

## Notes / gotchas

- **Metro can't watch `/mnt/c` (Windows FS) in WSL** — newly *added* scene files are not
  picked up by HMR; Expo web must be **restarted** for new scenes to appear (edits to
  existing files hot-reload fine). First cold web bundle ≈ 130s.
- Captures are raw screen recordings. Polishing into framed reels (phone frame + branded
  gradient + kinetic captions + audio) is the optional next step via the Remotion reel
  compositor in `marketing-studio/reels/` / the dashboard "Build a reel" flow — left for
  manual arrangement. Publishing is manual (deferred, per the studio design).

## Narrative Story reel (compositor)

Stitched the captures into one ~20.5s vertical reel via the Remotion compositor
(`POST /api/reel`) → `202606201242-story-reel` (1080×1920 H.264). Beats:
**hook card** ("Your week isn't one sport." / GRITTY) → **media** post-real-week scroll
(speed 1.5, "Run · ride · lift · climb · footy") → **media** reshuffle chat-replay
(speed 1.7) → **media** post-workout review (speed 1.6) → **cta card** ("One coach for
everything you do.", App Store + Google Play badges). `transition: slide`, `motion: float`,
`captionPreset: clean`, `safeZone: reels`. Media beats run inside the titanium phone frame
on the branded dark gradient. Recipe persisted in `post.json` → editable from the dashboard
(Edit reopens the builder pre-filled). Verified by extracting frames at the hook/media/CTA.

**Hook A/B variants** (`POST /api/reel/variants`, `buildReelVariants`): two more 20.5s
reels, identical except the hook line — "Stop forcing your life into a running app." and
"Football. Climbing. Cycling. One coach." Hook cards animate word-by-word.

**Short punchy cut** (`POST /api/reel`): a ~10.7s TikTok-leaning version — hook → week →
reshuffle → CTA only, faster speeds (2.2–2.4×), `motion: tilt`, `captionPreset: pop`,
`safeZone: tiktok`. Queue now holds 10 posts: 6 base captures + 4 story-reels.

## Round 2 — more variants + static captions + hybrid-athlete angle

**Static captions / instant hook (compositor feature).** Added a way to show text
*directly* instead of revealing word-by-word like subtitles:
- `reels/src/brandKit.ts`: new `static` caption preset + `instant` flag on
  `CaptionPreset`/`ResolvedCaptionStyle`.
- `reels/src/Caption.tsx`: when `instant`, all words share one fade-in spring, no
  active-word emphasis.
- `reels/src/beats/HookBeat.tsx` + `beats/types.ts`: hook headline supports `instant`
  (whole line at once); `reel.mjs` threads `instant` through the hook beat.
- `dashboard/index.html`: `static` option in the caption `<select>`, an **instant**
  checkbox on the hook-beat editor, and `instant` in the hook payload. Rebuilt the
  live-preview bundle (`reels && npm run build:preview`).
- **Gotcha (cost a re-render):** the dashboard server caches `reel.mjs` at startup, so
  after editing `reel.mjs` you must **restart `dashboard/server.mjs`** before the new
  `instant` passthrough takes effect — captions worked immediately (compositions bundle
  per-render) but the hook flag was silently dropped until restart. See
  [[marketing-studio-dashboard-ops]].

**New scene** `frontend/src/marketing/scenes/post-hybrid-week.ts` — a hybrid-athlete
week (3 strength + 3 run + 2 ride... actually 2/3/2: heavy lower, run intervals, Z2 ride,
upper, easy run, long ride, long run), `highlightDayIdx: 3`. Targets the "strong AND fast"
crowd. Registered in `scenes.ts`.

**New assets:** `post-hybrid-week` still + scroll; three new story-reels (all
`captionPreset: static`, instant hooks): hybrid story (~22s), a static-caption rebuild of
the multi-sport master (~20.5s), and a hybrid short cut (~10s, tilt/tiktok). Queue now: 15
posts / 7 reels (4 kinetic-caption + 3 static-caption).

**CRLF note:** Edits initially saved as CRLF (inflating diffs); code-simplifier normalized
all touched files back to LF to match HEAD. Watch for this on `/mnt/c`.

## Round 3 — before/after split reel (single-sport vs Grit)

Showcases Grit's smart sequencing: it won't stack a leg day or heavy run right before a
run/ride/match. Built with the compositor's `split` beat (two phones, ✕/✓ labels, the
"before" desaturated).

- New scenes (program-week): `post-single-sport-plan.ts` (the ✕ "before" — a rigid
  running-only plan, all-teal, blind to the rest of your life: drops a 20k long run the
  day before your Sunday football) and `post-grit-around-life.ts` (the ✓ "after" — same
  person, multi-sport + sequenced: hard run on fresh legs Mon, leg-heavy strength placed
  mid-week clear of Sunday, weekend kept light for the match). Notes spell out the
  reasoning. Registered in `scenes.ts`.
- Stills generated for both halves, then a split reel `…408-story-reel` (~15s):
  **hook (instant)** "Most plans can't see the rest of your life." → **split** (Single-sport
  app ✕ → With Grit ✓, caption "No heavy legs the day before your match") → **media** the
  reshuffle chat-replay (shows Grit's logic) → **CTA**. Static captions, slide, float.
- The monochrome (single-sport) vs colorful (Grit) phone contrast reads instantly even at
  split size; caption carries the sequencing benefit. Verified by extracting the split
  frame. Queue now: 18 posts / 8 reels.
- Pure-data scene additions (mirror existing scene idiom); lint + tsc clean, LF endings.

## Round 4 — pre-launch wishlist CTA ("Link in bio")

App isn't released, so the App Store / Google Play CTA was wrong. Added a pre-launch CTA
mode to the compositor's `cta` beat:
- `reels/src/beats/types.ts`: optional `pill?: string` on `CtaBeatData`.
- `reels/src/beats/CtaBeat.tsx`: renders a filled accent **pill** (e.g. "Link in bio 👆")
  when `pill` is set; the store-badges block now only renders when `badges.length` > 0.
- `reel.mjs`: cta builder preserves an explicit `badges: []` (`Array.isArray` check) so a
  pre-launch CTA hides store badges, and passes `pill` through. **Contract:** badges
  `undefined` → both stores; `[]` → none.
- `dashboard/index.html`: pill input on the cta beat editor, `pill` in the payload, and the
  cta `CARD_DEFAULTS` changed to the wishlist default (headline "Wishlist the app", sub
  "Be first in when Grit launches.", pill "Link in bio 👆", badges []). Rebuilt preview
  bundle; restarted dashboard (reel.mjs cached at startup).
- **Re-rendered all 8 existing reels in place** (`/tmp/swap-cta.mjs`: patch each saved
  recipe's cta beat → wishlist, re-POST with `id`) so the whole library now funnels to the
  waitlist. Verified the rendered CTA: GRITTY · "Wishlist the app" · sub · accent "Link in
  bio 👆" pill · no badges.
- The marketing site already has the wishlist signup ([[wishlist-signup]] — `WishlistForm`
  + `POST /api/wishlist`); "Link in bio" points there. reels `tsc` clean; simplifier
  normalized a CRLF regression on CtaBeat.tsx back to LF.

## Round 5 — reel speed/duration bug fix (decoupled, fit-to-window)

Reported bug: bumping a media beat's **speed** (e.g. a program-week scroll, or a chat
replay) made the clip "stop" — the scroll halted partway, the chat froze on the first
message. Root cause: `playbackRate` was set from `beat.speed` in the resolvers
(`playbackOf`) while the on-screen window was `probe/speed`. When the user set an explicit
**duration** that didn't match `probe/speed`, the clip either **froze** on its last frame
(window too long) or got **cut off** before finishing (window too short).

Fix (`marketing-studio/reel.mjs`): removed `playbackOf` from `stageResolver`/`urlResolver`;
`buildBeat`'s media branch now computes the window first (explicit `beat.seconds`, else
`probe/speed`) and derives `media.playbackRate = probe / seconds`, so the **whole clip is
always time-scaled to the on-screen window** — never freezes, never cuts off. Two clean,
independent knobs now:
- **speed** — how fast the clip plays; sets the *default* window when duration is blank
  (blank ⇒ `probe/speed`, so `playbackRate = speed`, whole clip at the chosen speed).
- **duration** — the on-screen window (how long shown before the next beat); whatever you
  set, the whole clip is fit to it (`playbackRate = probe/duration`).

Dashboard helper text updated to explain both knobs. Verified by rendering a 9s scroll
forced into a 6s window: at t≈5.8s the scroll has reached the source's end (vs. the old
behaviour where it'd only be ~⅔ through). `node --check` + preview-resolve math confirm:
explicit 12s on 9s clip → rate 0.75; speed 2 → 4.6s window, rate 2; blank → rate 1.
code-simplifier deduped the shared `return` (byte-identical output). LF endings kept.
Restarted `dashboard/server.mjs` (it caches `reel.mjs` at startup); no preview-bundle
rebuild needed (`reels/src` unchanged).

Of the 8 existing reels, only `202606201305-story-reel` (the hybrid short cut) had media
beats with explicit `seconds` + high `speed` (`seconds:5, speed:4` scroll; `seconds:5,
speed:3` chat) — i.e. the exact freeze case — so it was **re-rendered in place** with the
fix; the other 7 use auto-duration (only `speed`), which already rendered correctly, so
they were left as-is. Re-verified mid-beat frames on the fixed reel: scroll mid-window
shows mid-week content (not the frozen end), chat mid-window shows Grit's review streaming
(not frozen on the first state).

## Round 6 — full-week scroll capture (Sat/Sun no longer clipped)

The program-week **scroll source** only captured through ~Friday — Sat/Sun rows were
clipped because `program-week` renders inside a react-native-web `<ScrollView>`
(→ `overflow:auto` div at viewport height), so Playwright's `fullPage` screenshot couldn't
see below the fold.

Fix (`marketing-studio/video/scroll.mjs`): new `expandScrollContainers(page)` runs before
the screenshot. It finds every internal scroller (computed `overflowY` auto/scroll with
`scrollHeight > clientHeight`) and relaxes it **and its ancestors** — `overflow:visible`,
`height:auto`, `max-height:none`, `flex:none`, `flex-shrink:0` — then sets `html`/`body` to
`height:auto` + `overflow:visible`, so the full content lands in normal document flow and
`fullPage` captures all of it. (Mirrors `chat-replay.mjs`'s `pinChatToBottom` scroller
detection.) LF endings kept; code-simplifier: no changes.

New asset queued: **`202606201508-post-real-week-scroll`** — 12s dark scroll of
`post-real-week` that now pans all the way to **Sat — Climbing** and **Sun — Football**
("Grit kept Friday light so you've got legs"); caption "Run · ride · lift · yoga · climb ·
footy — one plan", `instagram,tiktok`, `draft`. The earlier clipped scroll
(`202606201214-post-real-week-scroll`) is left in place since existing reels reference it;
the new full-week clip is meant to be dropped into a reel manually. Queue: 19 posts.

## Verified

- Both new scenes render via `?marketingRender=` (found+ready); football/climbing show
  correct icons/colors; Post 2 video mid-frame shows full proposal auto-scrolled to the
  action buttons.
- All 6 assets valid H.264/PNG, listed in the dashboard queue.
- `tsc --noEmit` clean on changed files; `eslint` clean; code-simplifier: no changes.

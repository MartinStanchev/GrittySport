# Marketing app-screen scenes (home / live-workout / workout-summary)

On the `marketing-playground` branch. Extends the Marketing Playground beyond chat/lockscreen so we can stage the **product itself** — the home progress dashboard, the live GPS recording HUD, and the post-workout metrics — for reels/posts, authored via the `/marketing-scene` skill.

## Why

Existing scenes were chat-centric. The reels needed the rest of the wedge: progress tracking on the home page, live-recording features, and the workout-summary metrics. These are now first-class scene kinds.

## New scene kinds

Added three `Scene` variants in `frontend/src/marketing/types.ts`:

- **`home`** (`HomeSceneProps`) — HomeScreen card stack with every value injected.
- **`live-workout`** (`LiveWorkoutSceneProps`) — live GPS recording HUD.
- **`workout-summary`** (`WorkoutSummarySceneProps`) — post-workout metrics screen.

`MetricAccent` (`primary|secondary|tertiary|hr|muted`) keeps scene files free of raw colors.

## Key constraints that shaped the design

- **No NavigationContainer in the headless renderer.** `MarketingRender` (App.tsx) mounts only `SafeAreaProvider` + `ThemeProvider`. Any component calling `useFocusEffect`/`useFetchOnFocus` throws there. So the three self-fetching home cards were split into presentational `*View` bodies (no hooks) + thin fetching containers:
  - `GritInsightCard` → `GritInsightCardView`
  - `WeeklyEffortCounter` → `WeeklyEffortCounterView`
  - `LastWorkoutCard` → `LastWorkoutCardView`
  Production keeps using the containers; marketing imports the `*View`s. `QuickStatsRow`, `TodayWorkoutCard`, `StreakDots` were already pure.
- **`react-native-maps` renders a gray "not available" box on web** (where captures run). So route is drawn as an SVG polyline by the new `MarketingMapBackdrop` (themed surface + faint grid + route + start/end dots). Live + summary scenes pass `routePoints`, never `MapView`.

## Components added

- `frontend/src/components/liveWorkoutMetrics.tsx` — `HeroMetric`, `SecondaryMetricCard`, `ControlButton` extracted from `RecordGPSScreen` (with their styles) so the HUD tiles are shared, not duplicated. `RecordGPSScreen` now imports them (behavior unchanged; the live screen is otherwise untouched).
- `frontend/src/marketing/MarketingMapBackdrop.tsx` — SVG route stand-in.
- `frontend/src/marketing/MarketingHome.tsx` — composes the real home cards.
- `frontend/src/marketing/MarketingLiveWorkout.tsx` — recording HUD chrome (top bar, badges, hero metrics card, controls dock, secondary grid, sensor row) over the backdrop, reusing the shared tiles.
- `frontend/src/marketing/MarketingWorkoutSummary.tsx` — backdrop + stat grid + HR-zone bar (small primitives mirroring the screen) + real `EffortScoreCard` / `SplitsCard` / `HROverTimeChart` / `PRBadge` / `PremiumStatsCard`.
- `frontend/src/marketing/mockData.ts` — `makeRoute()` and `makeHRSeries()` so scene files stay declarative.

`SceneStage` (in `MarketingPlaygroundScreen.tsx`) gained `home` / `live-workout` / `workout-summary` branches delegating to those components.

## Example scenes (group `App screens`)

- `app-home-progress` — multi-sport mid-program dashboard (tempo run + strength today, climbing yesterday).
- `app-home-alldone` — both sessions done, weekly goal beaten, 5-day streak.
- `app-live-run` — running HUD, recording, HR strap connected.
- `app-live-ride` — cycling HUD, auto-paused (speed/power metrics).
- `app-summary-run` — run metrics: route, HR zones, HR chart, per-km splits, PR, effort score.
- `app-summary-ride` — ride metrics: speed/power/energy stats, HR zones + chart, effort score (no splits).

## Skill

`~/.claude/skills/marketing-scene/SKILL.md` updated: full `Scene` union, the three new prop interfaces, the `App screens` group, the map/web caveat, and the `mockData` helpers.

## Realism pass (follow-up)

After the first reels looked unlike the app, three fixes landed:

- **Real map.** `MarketingMapBackdrop` now draws a real slippy map on web from **CARTO raster tiles** (`dark_all`/`light_all`) with the route projected on top in **Web Mercator** (so it sits on the streets), start/end dots, and OSM/CARTO attribution. `lib/browser.mjs` waits for tile requests to drain before capturing. Native still gets the lightweight surface (captures are web-only).
- **Live-workout proportions.** `MarketingLiveWorkout` now uses a **dominant map band** (fixed 392 height, route framed inside it) with the HUD metrics flowing below — mirrors `RecordGPSScreen` (map-dominant) instead of the earlier thin-strip map / oversized panel. The screen overflows one viewport on purpose.
- **Animated, real-size clips.** New capture mode **`screen-scroll`** (`video/screen-scroll.mjs`, format in `generate.mjs`) records a *real* scroll of the actual ScrollView at device aspect → fills a reel's phone frame at readable size. The old fullPage **`scroll`** pan collapses chart/flex screens (RN-web re-clamps height on Playwright's fullPage resize → content squished to ~one viewport), so app screens use `screen-scroll`; `scroll` stays for chat/program-week. `encodeScroll` gained `width`/`height` window overrides; `captureScroll` gained a `fit: 'device'` option (kept, but `screen-scroll` is preferred).

Four reels were rebuilt on these clips (queue: `…-story-reel`/`…-hero-reel`): **Every sport, one plan** (home), **Record. Review. Repeat.** (live → summary), **A coach who never misses** (summary → Grit chat → home), **Metrics that actually mean something** (hero summary). 3 without Grit chat, 1 with.

## Gotchas

- Metro can't watch `/mnt/c` in WSL → restart `expo start --web` after adding **or editing** scene/component files (cold bundle ~2 min); HMR does not fire. `--clear` if a stale bundle persists.
- `screen-scroll` needs the screen to overflow one viewport; if it fits, it errors "nothing to scroll" → use a `still`. It finds the largest inner ScrollView, else falls back to page-level scrolling (the live-workout HUD overflows the document, not an inner scroller).

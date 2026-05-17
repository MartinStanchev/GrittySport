# Marketing Playground

Dev-only screen for rendering real chat and lockscreen components against
mock data so the team can capture pixel-accurate screenshots for marketing
posts (notification → action carousels, standalone chat shots, etc.) without
having to orchestrate the scenarios in the live app.

## What was built

- **Extracted `ChatMessageItem`** (`frontend/src/components/ChatMessageItem.tsx`)
  — Pulls the renderMessage logic out of `HomeScreen` so the same component
  draws bubbles in production chat and in the playground. Handles segment
  headers, tool-action rows, program proposals, program edits, and
  user/assistant text bubbles (markdown for Grit, plain for user).
- **Extracted `ChatHeader`** (`frontend/src/components/ChatHeader.tsx`)
  — Same goal for the chat modal header (Grit avatar, AI badge, connection
  status). Takes `onClose` + `isConnected`; HomeScreen passes the live
  connection state, the playground hard-codes `isConnected`.
- **`LockScreenMockup`** (`frontend/src/components/LockScreenMockup.tsx`)
  — iOS-style lockscreen: status bar, clock block, stacked notifications,
  home indicator. Takes a wallpaper image source so authors can drop in
  their actual phone wallpaper.
- **`MarketingPlaygroundScreen`** (`frontend/src/screens/MarketingPlaygroundScreen.tsx`)
  — Two modes: scene picker (grouped list) and scene stage (selected scene
  full-screen with a small "Done" pill anchored top-right).
- **Scene registry** (`frontend/src/marketing/{types.ts,scenes.ts}` +
  `frontend/src/marketing/scenes/`)
  — `Scene` discriminated union (chat | lockscreen), `groupScenes()` helper
  for the picker, `findScene()` for lookup, `DEVICE_DIMENSIONS` map for the
  "capture at this resolution" hint. One scene per file under `scenes/`,
  imported + pushed into `SCENES` by the registry. Ships with one sanity
  scene as the pattern reference.
- **`marketing-scene` skill** (`~/.claude/skills/marketing-scene/SKILL.md`,
  user-level, not committed) — generates new scene files from a brief.
  Encodes Grit's voice rules, naming conventions, the 3 scene patterns
  (notification→action, standalone chat, lockscreen-only), and references
  the type files so it stays in sync as types evolve.
- **Navigation wiring**
  - `SettingsStackNavigator` adds a `MarketingPlayground` route behind
    `__DEV__`; `SettingsScreen` adds a "Developer" section with a single
    entry behind `__DEV__` (post-login path).
  - `App.tsx` `RootNavigator` hosts a `playgroundOpen` flag; when set, the
    playground renders full-screen even if the user is unauthenticated.
    Trigger is a small "dev · open Marketing Playground" link at the bottom
    of `AuthScreen`, gated on `__DEV__`. The playground accepts an optional
    `onClose` prop that renders a "Back to sign-in" link in the picker
    header — only used by this entry-point. Means the playground is fully
    usable with the backend down.

## Capturing scenes

1. Run the app on a simulator at the device size the scene declares
   (default scenes target iPhone 15 Pro: 393×852).
2. Settings → Developer → Marketing Playground → tap a scene.
3. Use the simulator's native screenshot command (`Cmd+S` on iOS Simulator)
   for pixel-native PNG output, or the OS screenshot. The "Done" pill is
   intentionally low-contrast so it can be cropped out.

## Key files changed

- `frontend/src/components/ChatMessageItem.tsx` (new)
- `frontend/src/components/ChatHeader.tsx` (new)
- `frontend/src/components/LockScreenMockup.tsx` (new)
- `frontend/src/screens/MarketingPlaygroundScreen.tsx` (new)
- `frontend/src/marketing/types.ts` (new)
- `frontend/src/marketing/scenes.ts` (new — registry)
- `frontend/src/marketing/scenes/sanity-check.ts` (new — example scene)
- `~/.claude/skills/marketing-scene/SKILL.md` (new — user-level skill)
- `frontend/src/screens/HomeScreen.tsx` (refactor)
- `frontend/src/navigation/SettingsStackNavigator.tsx` (route)
- `frontend/src/screens/SettingsScreen.tsx` (dev nav entry)
- `frontend/App.tsx` (auth-bypass routing in `RootNavigator`)
- `frontend/src/screens/auth/AuthScreen.tsx` (optional dev link)

## Follow-ups (out of scope here)

- Author the first batch of scenes (notification → action 3-frame templates,
  standalone chat shots) — either manually or by invoking
  `/marketing-scene <brief>`.
- Optional: add a "Capture all" button that drives the picker through each
  scene with a settle-delay between, so a screen recording produces every
  shot in one pass.

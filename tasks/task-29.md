## Feature 29: App Store Optimization (ASO) — Listings, Keywords, Screenshots, Reviews

### Goal
Prepare and ship the App Store / Play Store listing assets that drive organic install conversion: keyword research, listing copy (EN + DE), screenshot storyboards, an optional app preview video, and an in-app review prompt strategy. ASO is the single highest-leverage acquisition channel for a fitness app pre-launch — keyword-targeted listings can deliver thousands of organic installs/month with zero ad spend.

### Why this approach
- For fitness apps, ~40–60% of installs come from organic search within the stores. Getting the keyword field, title, and subtitle right outweighs months of social content.
- The Apple keyword field (100 chars, hidden from users) is heavily underused by indie developers. Researching what users actually search for (vs. what we think they search for) typically doubles impressions.
- Screenshots convert more than copy. The first three screenshots determine ~80% of the install decision.
- An in-app review prompt with correct timing (post-positive-moment) lifts average rating from ~3.5 → ~4.5+, which compounds with ranking.

### Out of scope
- Actually creating screenshots — design work happens in a tool (Figma, Screenshot.rocks, etc.); this task documents the storyboard + copy.
- App preview video production — same.
- App Store Connect / Play Console actual entry — manual one-time work after assets are ready.
- Apple Search Ads spend strategy — separate decision; this task notes the recommendation but doesn't launch campaigns.

### Constraint reminders from launch checklist
- **"Not a medical device" disclaimer** must appear in paragraph 1 of both store descriptions (Apple §1.4.1, Google's Jan 2026 health-app rule). Same copy lifted from `LAUNCH_CHECKLIST.md §3.3` / `§4.4`.
- Listings need EN + DE for soft-launch in Germany.
- Health Connect data types must be listed honestly in the Play Data Safety section (handled in the launch checklist, not here).

---

### Task 29.1: Keyword research

Output a single `marketing/aso/keywords.md` file documenting the keyword strategy. Use a free or low-cost tool:

- **AppFollow** (free trial), **SearchAdsHQ** (limited free), **Sensor Tower** (limited free), or **App Radar** (free for one app).
- Cross-reference with **Apple Search Ads** Keyword Popularity (free with an Apple Developer account — gives popularity scores 1–100 for any keyword on the App Store).

For each keyword, record:
- Keyword phrase
- Popularity score (ASA Keyword Popularity, 1–100)
- Difficulty (how many strong apps already rank for it)
- Whether competitors (Strava, TrainingPeaks, MacroFactor, Hevy, TrainerRoad) rank for it
- Whether we should target it in: **title**, **subtitle**, **keyword field**, **description body**, or **none**

**Target ~25 high-relevance keywords**, divided across positioning angles:

| Angle | Example keywords |
|------|------------------|
| Multi-sport coaching | `multi sport training`, `triathlon training plan`, `endurance coach` |
| AI coaching (the differentiator) | `ai fitness coach`, `personalized training plan`, `adaptive workout plan` |
| Sport-specific intake | `marathon training`, `cycling training plan`, `swim training`, `strength program`, `5k training` |
| Workout tracker (broad) | `workout tracker`, `gps run tracker`, `heart rate workout`, `fitness log` |
| Import/sync (capability) | `apple health import`, `garmin import`, `gpx import`, `fit file import` |

Avoid wasting keyword-field characters on terms already in the **title** or **subtitle** — Apple indexes both, so duplication is wasted space. Plurals and stems are also auto-indexed (don't include both "trainer" and "trainers").

---

### Task 29.2: Apple App Store listing copy (EN + DE)

Write `marketing/aso/apple-listing-en.md` and `marketing/aso/apple-listing-de.md`. Fields per locale:

| Field | Limit | Notes |
|------|-------|-------|
| **App name** | 30 chars | Include 1 high-volume keyword if it fits naturally. Example: `Gritty: AI Fitness Coach` (24). |
| **Subtitle** | 30 chars | Different keywords from the name. Example: `Multi-sport training plans` (27). |
| **Promotional text** | 170 chars | Updatable without resubmission — use for launch promos, new features. |
| **Keyword field** | 100 chars | Comma-separated, no spaces between (Apple ignores them and you reclaim chars). No duplicates with name/subtitle. |
| **Description** | 4000 chars | First paragraph = "not a medical device" disclaimer + value prop. Follow with 3–5 short paragraphs grouped by benefit. End with a "Premium" section listing premium features (allowed; just no purchase CTA). |
| **What's New** | 4000 chars | Per-release notes; placeholder for v1.0 here. |

**Description structure (proven pattern):**

```
[Disclaimer paragraph — verbatim from LAUNCH_CHECKLIST.md]

[2-sentence value prop: who it's for + the unique thing]

WHAT GRITTY DOES
- 3–5 short bullets, each starting with a verb

HOW IT WORKS
- Step 1: ...
- Step 2: ...
- Step 3: ...

BUILT FOR
- Runners, cyclists, swimmers, triathletes, lifters, hybrid athletes...

CONNECT YOUR GEAR
- Apple Health, GPS, Bluetooth HR, GPX/TCX/FIT/CSV import

GRITTY PREMIUM
- 3–5 outcome-grouped bullets matching web/components/sections/Premium.tsx
- Price + cancel-anytime line

[Privacy line: "Your workout data stays yours. See our privacy policy: ..."]
[Contact: "Questions or feedback? support@..."]
```

DE copy is a translation — but **not** a 1:1 translation of keywords. Re-do keyword research for the German store (different popularity scores, different competitor set, different vocabulary). For example, EN `marathon training` → DE could be `Marathon Trainingsplan` (high) or `Lauftraining` (different intent).

---

### Task 29.3: Google Play listing copy (EN + DE)

Write `marketing/aso/google-listing-en.md` and `marketing/aso/google-listing-de.md`. Play uses a different field structure than Apple:

| Field | Limit | Notes |
|------|-------|-------|
| **App title** | 30 chars | Same constraints as Apple title. |
| **Short description** | 80 chars | Heavy SEO weight. First 80 chars users see in search. |
| **Full description** | 4000 chars | Same disclaimer-first rule. Google **does** index the full description for keywords — repeat important terms 2–3 times naturally. |

Play has no hidden keyword field — keywords go in title, short description, and full description. Density matters more than for Apple. Aim for natural-sounding repetition of 5–10 target keywords across the description.

---

### Task 29.4: Screenshot storyboard

Write `marketing/aso/screenshots-storyboard.md` describing 8 screens for Apple (required sizes: 6.9", 6.5", iPad 13"/12.9" — check Apple's current list) and 8 for Google Play (phone + 7" + 10" tablet).

Each screenshot has two layers: the **screen capture** itself and the **caption** overlaid. Captions sell harder than the UI.

**Proposed sequence** (order matters — first 3 are what users see in the search results carousel):

1. **Hero shot.** Home screen with hero workout card. Caption: *"One AI coach for every sport"*.
2. **The differentiator.** Grit chat banner with a proposal card visible. Caption: *"Plans that adapt after every workout"*.
3. **Outcome proof.** Post-workout review screen with metrics. Caption: *"Smart reviews after every session"*.
4. **Multi-sport visual.** Program detail showing 4–5 different sport-colored activity rows. Caption: *"Run, ride, swim, lift — one plan"*.
5. **Import / connectivity.** Apple Health / Health Connect import screen with file import below. Caption: *"Bring your existing data"*.
6. **GPS recording.** Live workout map screen. Caption: *"Track outdoor workouts with GPS + HR"*.
7. **History + insights.** History screen with effort score / weekly chart. Caption: *"See your progress, not just your data"*.
8. **Premium teaser.** PremiumStatsCard or analytics screen. Caption: *"Go deeper with Gritty Premium"*.

For each, the storyboard doc records:
- Source screen route in the app
- App state required to capture it (e.g., "user has 1 active marathon program with 3 completed workouts")
- Caption copy (EN + DE)
- Background color / device frame style (recommend: brand gradient background from `frontend/src/constants/colors.ts`, no device frame for a flatter modern look)

Tools: Figma + the iOS / Android device frame Figma libraries, or [Screenshot.rocks](https://screenshot.rocks/) for fast iteration.

---

### Task 29.5: App preview video (optional, recommended)

Write a 1-page brief in `marketing/aso/app-preview-video.md`:

- 15–30s max (Apple's limit is 30s, Google Play has no hard cap but ~30s converts best).
- No voiceover — silent autoplay is the default. Captions/text overlays only.
- Beat sheet (one shot per beat, 2–3s each):
  1. Open: phone showing the home screen
  2. Tap chat → Grit responds with a proposal card
  3. Accept proposal → program updates
  4. Hit "Start workout" → live GPS screen
  5. Finish → post-workout review with Grit's feedback
  6. End card: logo + "Gritty Fitness — one AI coach for every sport"
- Tools: capture with iOS Simulator screen recording (`xcrun simctl io booted recordVideo`) or Android Studio's emulator; edit in DaVinci Resolve / iMovie / CapCut.
- Apple has strict rules: no hands, no fingers, no real-world footage. Pure screen capture only.

---

### Task 29.6: In-app review prompt strategy

The app currently has no review prompt. Add one, triggered at moments of demonstrated user delight:

**Frontend implementation:**
- Use `expo-store-review` (already supported by Expo SDK; verify it's installed).
- Wrap in a small helper `frontend/src/lib/reviewPrompt.ts` that:
  - Checks if review prompting is supported (`StoreReview.isAvailableAsync()`).
  - Tracks "moments of delight" counter in AsyncStorage (incremented from the call sites below).
  - Triggers `StoreReview.requestReview()` only on the **3rd qualifying moment**, no more than once per 120 days.
  - Per platform, respects OS quota (iOS: 3 prompts per 365 days; Android handled by Play Core silently).

**Call sites (moments of delight):**
1. After a user accepts a Grit proposal that successfully creates/modifies their program (success path only).
2. After a user completes a workout AND a post-workout review (the "Continue in chat" / "Quick reply" flow finishes positively).
3. After a 7-day streak of activity (computed from `streak dots` data per `progress/home-screen-aura-kinetic-redesign.md`).

Do **not** trigger on:
- Account creation / first launch (too early).
- After any error state.
- After a missed-workout review (negative moment).

**Settings escape hatch:** add a "Rate the app" row in `SettingsScreen.tsx` that calls `StoreReview.requestReview()` directly — for the small subset of users who actively want to rate but were never prompted.

---

### Task 29.7: Apple Search Ads — recommendation (no code)

Document in `marketing/aso/apple-search-ads.md` a starting-budget recommendation:

- **Search Match** campaign at €10/day for the first 2 weeks — Apple's algorithm discovers which keywords convert; cheap data.
- After 2 weeks: pull the converting keywords, move them to a dedicated **Exact-match** campaign at €20–30/day with bid caps tied to your estimated LTV / install.
- Defensive campaign on brand term `gritty fitness` (€2/day) — prevents competitors from bidding on your brand.
- Track via Apple's free Attribution API (no need for AppsFlyer/Adjust pre-launch).

This document exists to make the decision easy when launch comes; it's not a task to actually launch ads.

---

### Key Files to Create

| File | Purpose |
|------|--------|
| `marketing/aso/keywords.md` | Keyword research output |
| `marketing/aso/apple-listing-en.md` | Apple listing copy (EN) |
| `marketing/aso/apple-listing-de.md` | Apple listing copy (DE) |
| `marketing/aso/google-listing-en.md` | Play listing copy (EN) |
| `marketing/aso/google-listing-de.md` | Play listing copy (DE) |
| `marketing/aso/screenshots-storyboard.md` | 8-screen storyboard with captions |
| `marketing/aso/app-preview-video.md` | Video beat sheet |
| `marketing/aso/apple-search-ads.md` | Launch-day ad strategy |
| `frontend/src/lib/reviewPrompt.ts` | New — `expo-store-review` wrapper with delight-moment gating |
| `frontend/src/screens/SettingsScreen.tsx` | Modify — add "Rate the app" row |
| Call sites for `reviewPrompt.recordDelight(...)` | Modify — proposal accept, post-workout review, 7-day streak |

---

### How to Test

1. **Keyword field within limit:** verify Apple keyword field is ≤100 characters (counted after stripping spaces).
2. **Disclaimer placement:** confirm "not a medical device" sentence is the **first paragraph** of both Apple and Play descriptions (Google's 2026 rule rejects bottom-of-description disclaimers).
3. **Screenshot resolution:** confirm each screenshot file matches the required pixel dimensions for the device class (Apple's spec page is the source of truth).
4. **In-app review prompt:** smoke-test on a real device by manipulating the AsyncStorage counter to hit the 3rd-delight threshold; confirm OS dialog appears and that subsequent prompts are throttled.
5. **No review prompt on first launch:** delete app, reinstall, complete onboarding — confirm no prompt appears.
6. **EN ↔ DE parity:** all 4 listing copy files have the same sections, same disclaimer, same Premium description.
7. **Lint + typecheck:** `frontend/` Jest tests for `reviewPrompt.ts` (mock `StoreReview` and AsyncStorage); typecheck passes.

---

### Open Questions

- **App name:** `Gritty` alone, `Gritty Fitness`, or `Gritty: AI Fitness Coach`? Shorter = cleaner brand; longer = better keyword coverage in the title. Recommend the third for launch, can shorten later once brand is established.
- **Default localization:** ship EN as primary with DE secondary, or DE primary for the soft launch in Germany? Affects which listing the worldwide audience sees pre-DE-localization.
- **"Not a medical device" wording:** stick with the LAUNCH_CHECKLIST.md verbatim copy, or soften slightly for marketing tone? Recommend verbatim — legal trumps marketing here.
- **Review prompt timing per moment:** is "3rd delight" too few or too many? Adjust after first 100 prompts based on the rate of "Yes, rate" vs dismiss.
- **App preview video:** ship at launch or wait until v1.1 with real user data?

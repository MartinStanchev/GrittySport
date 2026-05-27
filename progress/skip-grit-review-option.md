# Skip Grit's Review Option

After saving a workout (manual log, GPS recording, or imported file), the
`PostWorkoutReview` widget already lets the user choose between linking to a
scheduled activity or skipping the link. We now also let them skip Grit's
review entirely.

## Behavior

`PostWorkoutReview` now branches inside its `linking` phase based on two
inputs: whether the workout was already linked via `scheduledActivityId`, and
whether `getLinkableActivities` returned any compatible matches.

- **Linkable activities found** — full link UI as before, with three actions:
  - `Link & Review` (primary)
  - `Skip linking — review without linking` (text)
  - `Skip Grit's review` (text, new) — only shown when `onSkipReview` is passed
- **No linkable activities, or workout already linked** — replaces the previous
  silent auto-trigger with a small consent panel:
  - `Get review` (primary)
  - `Skip Grit's review` (text)
- **Still loading the link lookup** — same pulsing "Checking your schedule..."
  loader as before.

Skipping the review means we simply never call `POST
/workouts/{id}/review/trigger`, so no quota is consumed and no review message is
generated. The caller's `onSkipReview` callback is responsible for navigating
away (all three callers go back to `Home → HomeMain`).

## Key files changed

- `frontend/src/components/PostWorkoutReview.tsx` — added `onSkipReview` prop,
  replaced the `scheduledActivityId ? 'polling' : 'linking'` initial-phase
  trick with derived `showLinkOptions / showReviewPrompt / showLinkingLoader`
  flags, added the new "Get Grit's review?" panel for the no-link case.
- `frontend/src/screens/WorkoutSummaryScreen.tsx`,
  `frontend/src/screens/LogActivityScreen.tsx`,
  `frontend/src/screens/ImportPreviewScreen.tsx` — pass
  `onSkipReview={() => navigation.getParent()?.navigate('Home', { screen: 'HomeMain' })}`.

No backend changes — `TriggerReview` was already gated on an explicit frontend
call (see `link-before-review.md`).

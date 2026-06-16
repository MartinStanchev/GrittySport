# Post-Workout Review Flow Clarity

Reworked the `PostWorkoutReview` link/review options so the choices are
unambiguous. Previously the linkable-activities panel showed three inline
buttons — "Link & Review", "Skip linking — review without linking", and
"Skip Grit's review" — and the blanket skip just navigated home, which read as
"the button did nothing."

## Behavior

The navbar **Done** button (already present in all three caller screens, shown
once a workout is saved) is now the single way to skip everything — link nothing,
review nothing, go home.

The inline options in the linkable-activities panel are now three meaningful
flows, all parallel in wording:

- **Link & Review** (primary) — links the selected activity then triggers Grit's
  review. Requires a selection. Unchanged from before.
- **Link without review** — links the selected activity then leaves (calls
  `onSkipReview`). Requires a selection. New.
- **Review without linking** — triggers Grit's review without linking. (Was
  "Skip linking — review without linking".)

The "Get review?" prompt panel (shown when there are no linkable activities or
the workout is already linked) no longer carries an inline skip button — the
navbar Done covers that case.

## Implementation

- `handleLink` now takes a `review: boolean`: after linking it either
  `triggerAndPoll()` (review) or `onSkipReview?.()` (leave).
- "Link without review" / "Link & Review" share the `selectedActivityId`/`linking`
  disabled guard.
- The two standalone inline "Skip Grit's review" buttons were removed.

## Key files changed

- `frontend/src/components/PostWorkoutReview.tsx` — parameterized `handleLink`,
  relabeled/restructured the link-options buttons, dropped inline skip buttons.

No backend changes for the link-options rework.

## Follow-on: "Saved" toast + originating-stack reset

Two issues addressed after the link-options rework:

1. **No save confirmation on silent exits.** Added a lightweight global toast.
   - New `ToastContext` (`src/contexts/ToastContext.tsx`) exposing `useToast()` →
     `showToast(msg)`. Renders a bottom-anchored animated pill (checkmark + text,
     auto-dismiss ~2.2s) above the tab bar. `ToastProvider` mounted in `App.tsx`
     inside `WorkoutProvider`, wrapping the app container so it overlays the
     navigator.
   - Each save screen shows "Workout saved" / "Activity saved" on the Done button
     and on `onSkipReview` (which now also covers "Link without review").

2. **Stale summary/preview reappearing.** The summary (`WorkoutSummaryScreen`),
   manual-log (`LogActivityScreen`), and import-preview (`ImportPreviewScreen`)
   screens are pushed onto whichever tab's stack the user came from (Home /
   History / Programs). The old exit just did
   `navigation.getParent()?.navigate('Home', ...)`, which switched tabs but left
   the screen mounted — returning to e.g. History re-showed the already-saved
   workout. New helper `goHomeAndReset(navigation)` (`src/utils/navigation.ts`)
   captures the parent, `popToTop()`s the originating stack, then navigates Home.
   All "done"/skip/continue-in-chat/offline exits route through it (the offline
   GPS path pops then goes to the History tab).

## Key files changed (full)

- `frontend/src/components/PostWorkoutReview.tsx` — link-options rework.
- `frontend/src/contexts/ToastContext.tsx` — new global toast.
- `frontend/src/utils/navigation.ts` — new `goHomeAndReset` helper.
- `frontend/App.tsx` — mount `ToastProvider`.
- `frontend/src/screens/WorkoutSummaryScreen.tsx`,
  `frontend/src/screens/LogActivityScreen.tsx`,
  `frontend/src/screens/ImportPreviewScreen.tsx` — `finishAndGoHome` (toast +
  reset) wired into Done / skip / continue-in-chat / offline exits.

# How-it-works app screenshots

Integrated real in-app screenshots into the marketing site's `/how-it-works` page so the prose is backed by visuals of the actual features.

## What was done

- Renamed the raw timestamped PNGs the user dropped in `web/public/app_screenshots/` to stable, descriptive slugs. Kept both light and dark variants of each shot for future use; the page currently uses the **light** variants to match the page's white/`paper` aesthetic.
  - `program-chat-light.png` — chat intake ending in a program-proposal card
  - `program-review-light.png` / `program-phases-light.png` — full-screen Review Proposal (phase 1 expanded / all phases)
  - `edit-proposal-light.png` — "Program Adjustment" before/after edit card
  - `post-workout-review-light.png` — Saturday long-run review with quick-reply chips
  - `reminder-light.png` — `set_reminder` confirmation with recurring options
  - `*-dark.png` equivalents retained but unused for now
- New reusable component `web/components/AppShot.tsx`: renders a screenshot via `next/image` inside a soft rounded phone-styled card (gradient halo, `border-black/5`, shadow) with optional `eyebrow` + `caption`. Mirrors the phone-frame idiom in `Hero.tsx`.
- `web/app/how-it-works/page.tsx`:
  - Added optional `visual?: React.ReactNode` to the `Section` type.
  - `ProgramBuildingVisual` (2-up: chat → review) attached to the **Building your program** section.
  - `GritToolsVisual` (3-up: edit / review / reminder) attached to the **What Grit can do** section, illustrating three of the listed tools.
  - Visuals render under each section body and break out wider than the `max-w-3xl` prose column on large screens via `lg:-mx-24 xl:-mx-32`; collapse to a single stacked column on mobile.

## Verification

- `npm run lint` clean, `npm run build` (static export) succeeds.
- Headless-chromium screenshots at 1280px and 390px confirmed: desktop shows centered, complete 2-up and 3-up galleries with captions; mobile stacks each gallery into one readable column.

## Key files changed

- `web/components/AppShot.tsx` (new)
- `web/app/how-it-works/page.tsx`
- `web/public/app_screenshots/*` (renamed)

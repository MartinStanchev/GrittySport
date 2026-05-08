# Marketing hero — scrollytelling rebuild

Replaced the static one-shot hero in `web/components/sections/Hero.tsx` with a scroll-driven, three-panel hero that animates the title and the phone mockup as the user scrolls into the section. Download buttons stay pinned across all three panels.

## Panels

1. **One coach. Every sport. Built around you.** — Phone shows a stylized Home screen: greeting + quick stats, today's hero workout (5 × 1000m intervals), tomorrow's strength + mobility upcoming rows.
2. **Meet Grit. Tracks every session. Adjusts your plan.** — Phone shows a Grit chat: user asks to bump the pace, Grit replies, an inline "Program Adjustment" card appears with a before/after activity diff and Apply / Let's Discuss buttons (mirrors the real `ProgramEditCard`).
3. **Real data. Real progress. Grit notices.** — Phone shows a stylized workout summary: distance/time/avg-pace stats, route SVG, effort score bar, HR-zone strip, mini km splits.

## Mechanics

- Wrapper is `300vh` tall on `lg:`+ screens; the inner stage is `sticky top-0 h-screen` so it pins for two viewport heights → two transitions across three panels.
- A `scroll`/`resize` listener reads `wrapperRef.getBoundingClientRect()` and sets the active panel index from `floor((scrolled / total) * 3)`. Cheap to compute; only re-renders when the integer step changes.
- Title block and phone block each cross-fade between three absolutely-positioned variants via opacity (500ms).
- A small step-dot indicator under the download buttons shows which panel is active.
- Below `lg:` the page renders three stacked `MobilePanel` blocks instead — no sticky, no scroll math. Download badges live under the first panel only.

## Files changed

- `web/components/sections/Hero.tsx` — full rewrite. New top-level `"use client"` component with helpers `EyebrowBadge`, `PhoneGlowWrapper`, `DownloadBlock`, `PhoneFrame`, `PanelScreen`, `MobilePanel`, plus the three phone screens `PhoneHome`, `PhoneChat`, `PhoneSummary`.
- `PROGRESS.md` — added a row for this entry.

## Validation

- `npm run lint` clean.
- `npm run build` (Next.js 16) clean — all five static routes still prerender.
- Code-simplifier pass extracted shared bits (`GRADIENT_TEXT` const, `EyebrowBadge`, `PhoneGlowWrapper`, `DownloadBlock`, `UpcomingActivityRow`) and inlined the scroll-progress math.

## Notes / future work

- The remaining sections (Problem, HowItWorks, Features, Premium, FAQ, FinalCTA) are unchanged. The user has not yet decided whether they stay as-is.
- The phone screens are static visual stand-ins built in plain Tailwind — they don't import the real React Native components from `frontend/`. Visual fidelity is intentional; behavioral fidelity is not.

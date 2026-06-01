# Mobile hero — scrollytelling on phones too

Previously the scroll-driven 3-panel cross-fade hero only ran on `lg:`+ screens; below that, `web/components/sections/Hero.tsx` fell back to three plain stacked `MobilePanel` blocks (static, no scroll animation). This brings the same scroll-driven cross-fade to mobile, scaled to fit one pinned viewport.

## What changed

- **Single shared scroll wrapper.** The old code had two separate branches — a static mobile stack and a `300vh` desktop scrollytelling wrapper that held `wrapperRef`. On mobile the ref was never mounted, so there was no scroll progress to drive anything. Merged both into ONE `300vh` `wrapperRef` with a single `sticky top-0 h-screen overflow-hidden` stage. The same `progress` value now drives both breakpoints.
- **Two layouts inside the one stage:**
  - `hidden lg:flex` — the existing desktop side-by-side grid (title + download + dots on the left, phone on the right).
  - `flex lg:hidden` — new mobile vertical layout: cross-fading title block on top, a scaled-down phone in the middle, and step dots + the waitlist form pinned at the bottom (`flex-col justify-between`). `text-center`, `pt-16 pb-6`.
- **`PhoneGlowWrapper` gained a `scale` prop.** The 300×600 phone mockup is scaled to `MOBILE_SCALE = 0.52` on mobile, with the layout footprint collapsed to the scaled size (`origin-top-left` transform inside a fixed-size box) so it stacks cleanly under the title and leaves room for the form.
- **Dedup:** cross-fading phone screens factored into a shared `phoneScreens` array; the step indicator into a `StepDots` helper; the title/eyebrow/subtitle block into a `PanelText` component used by both branches (code-simplifier pass).
- **`#download` anchor** moved off `DownloadBlock` and onto the `<section>` to avoid duplicate ids now that `DownloadBlock` renders in both branches. The header's "Join the waitlist" CTA (`/#download`) still lands on the hero.
- Removed the old `MobilePanel` function.

## Files changed

- `web/components/sections/Hero.tsx`
- `PROGRESS.md` — added a row.

## Validation

- `npm run lint` clean, `npm run build` (Next.js 16) clean — all routes still prerender.
- Visually verified via headless Chromium at 390×700 and 375×667 (iPhone SE): all three panels cross-fade on scroll, and title + phone + waitlist form fit inside the pinned viewport without clipping.

## Notes

- Mobile keeps the same `300vh` scroll length as desktop. The effect is necessarily smaller (scaled phone, compact title) but is now animated rather than a static stack.
- The phone screens remain static Tailwind stand-ins — visual fidelity only, no real RN components.

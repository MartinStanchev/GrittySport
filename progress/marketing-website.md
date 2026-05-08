# Marketing Website

## Summary

Single-page marketing site for Gritty Fitness with German legal pages. Lives in a new top-level `web/` folder, separate from the mobile `frontend/` Expo app. Built with Next.js 16 (App Router, Turbopack) + Tailwind v4 + React 19, using Inter + Space Grotesk to match the app's Aura Kinetic visual language. Brand tokens (`--color-brand` `#7C5CFC`, `--color-teal` `#0EA5B0`, `--color-orange` `#E68A2E`) ported from `frontend/src/constants/colors.ts` so the site shares a palette with the app.

## Pages

- **`/`** — landing. Sections: Hero (with phone mockup) → Problem → How it works → Features → Premium → FAQ → Final CTA.
- **`/impressum`** — § 5 TMG Anbieterkennzeichnung skeleton with `[placeholder]` spans for every field that needs the user's real legal info.
- **`/datenschutz`** — DSGVO Datenschutzerklärung covering hosting (DigitalOcean EU), cookies (none), email contact, app data delegation to in-app policy, processors, and data subject rights.
- **`/agb`** — placeholder T&Cs skeleton (Vertragsschluss, Leistungsumfang, Preise, Widerruf, Haftung). Marked as needing legal review before Stripe goes live.

All four routes prerender as static content (`○ (Static)`).

## Premium positioning

Per the user's framing — "improving their experience, adding on top of what users will have" — the Premium section is grouped by **outcomes** (Sharper insights / More coaching / Total control) rather than a feature checklist. Header reads "More signal. More control. Same coach, a deeper relationship." Pricing is a placeholder (€7.99/mo, €69/yr) and the CTA goes to `#download` with copy "Start free, upgrade in-app" and a "Web checkout coming soon" footnote — wired so the same component switches to a `/checkout` route once Stripe is added.

## Key decisions

- **Top-level `web/` folder, not nested under `frontend/`** — `frontend/` is the Expo app and Expo also targets web. Keeping marketing separate avoids ambiguity and lets it deploy as its own DO App Platform component.
- **Legal pages in German, marketing copy in English** — required for German visitors per TMG/DSGVO; app UI is English so marketing matches.
- **Brand-styled store badges, not official artwork** — pre-launch placeholder. README flags the requirement to swap in Apple/Google's official badges before listing.
- **No analytics, no cookie banner** — launching cookieless. README points at Plausible as the GDPR-friendly option to add later.
- **Tailwind v4 `@theme` directive** — brand colors as design tokens (`bg-brand`, `text-teal`, etc.) using v4's CSS-based config rather than `tailwind.config.js`.
- **`npx eslint .` instead of `npm run lint`** — Next 16 deprecated `next lint` and the create-next-app default `lint` script is broken. Documented in the README.

## Files

### New top-level folder
- `web/` — Next.js project (`package.json`, `next.config.ts`, `tsconfig.json`, etc.)

### App routes
- `web/app/page.tsx` — composes the seven landing sections
- `web/app/layout.tsx` — fonts, metadata, Header + Footer
- `web/app/globals.css` — Tailwind import, `@theme` brand tokens, `.bg-hero-gradient`, `.bg-mesh-soft`, `.prose-legal`
- `web/app/impressum/page.tsx`, `web/app/datenschutz/page.tsx`, `web/app/agb/page.tsx`

### Components
- `web/components/Header.tsx` — sticky nav with anchor links + "Get the app" CTA
- `web/components/Footer.tsx` — Product / Legal columns + copyright
- `web/components/StoreBadges.tsx` — Apple + Google badge stand-ins (light/dark variants)
- `web/components/LegalLayout.tsx` — shared header + `prose-legal` wrapper for the three legal pages
- `web/components/sections/Hero.tsx` — headline, sub, store badges, phone mockup with mock home-screen content
- `web/components/sections/Problem.tsx` — three-column problem framing
- `web/components/sections/HowItWorks.tsx` — four-step horizontal flow
- `web/components/sections/Features.tsx` — six-card free-tier grid
- `web/components/sections/Premium.tsx` — three outcome groups + price card
- `web/components/sections/FAQ.tsx` — `<details>`-based accordion, six entries
- `web/components/sections/FinalCTA.tsx` — closing dark section with badges + email

### Docs
- `web/README.md` — local dev, build, project layout, **before-going-live checklist**, DigitalOcean App Platform deploy notes, future-work pointers

## Validation

- `npm run build` — green; static prerender for all 4 routes (`/`, `/impressum`, `/datenschutz`, `/agb`).
- `npx eslint .` — clean (exit 0, no warnings).

## Follow-ups for the user

The README's "Before going live" checklist is the source of truth, but the headline items:

1. Fill in every `<span class="placeholder">[...]</span>` in the three legal pages.
2. Have AGB + Datenschutz reviewed by a German lawyer once Stripe is wired.
3. Replace placeholder store URLs in `StoreBadges.tsx` with real ones, and swap the SVG stand-ins for Apple/Google's official badge artwork.
4. Add real `app/icon.png` and `app/opengraph-image.png`.
5. Update `metadataBase` to the production domain.

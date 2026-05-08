# Gritty Fitness — Marketing Site

Single-page marketing site for Gritty Fitness, plus the German legal pages (Impressum, Datenschutz, AGB). Built with Next.js 16 (App Router) + Tailwind v4.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build & lint

```bash
npm run build   # static prerender of /, /impressum, /datenschutz, /agb
npx eslint .    # `npm run lint` is broken in Next 16 — run eslint directly
```

## Project layout

```
app/
  page.tsx              # landing (Hero → Problem → How → Features → Premium → FAQ → CTA)
  impressum/page.tsx    # § 5 TMG
  datenschutz/page.tsx  # DSGVO
  agb/page.tsx          # T&Cs
  layout.tsx            # shared Header + Footer, fonts, metadata
  globals.css           # Tailwind + brand tokens (--color-brand etc.)
components/
  Header.tsx, Footer.tsx, StoreBadges.tsx, LegalLayout.tsx
  sections/             # one file per landing-page section
```

## Before going live — checklist

- [ ] Replace every `<span class="placeholder">[...]</span>` in
      `app/impressum/page.tsx`, `app/datenschutz/page.tsx`, and
      `app/agb/page.tsx` with real legal info.
- [ ] Have the AGB and Datenschutz reviewed by a German lawyer
      (especially before enabling Stripe checkout).
- [ ] Replace the placeholder store URLs in `components/StoreBadges.tsx`
      with real Apple App Store / Google Play links.
- [ ] Swap the brand-styled badges in `StoreBadges.tsx` for the official
      Apple / Google badge artwork once the apps are listed (Apple and
      Google's brand guidelines require their own assets).
- [ ] Confirm the contact email (`hello@grittyfitness.app`) is set up
      and monitored.
- [ ] Update `metadataBase` in `app/layout.tsx` to the final domain.
- [ ] Add a real `app/icon.png` and `app/opengraph-image.png`.

## Deployment to DigitalOcean App Platform

The backend already lives on DigitalOcean, so the simplest setup is to add this
folder as a separate App Platform component:

1. Push the `web/` folder to GitHub (same repo or its own — both work).
2. In DO App Platform → "Create App" → connect the repo, set source dir to
   `web/`.
3. App Platform auto-detects Next.js. Default build command `npm run build`
   and run command `npm start` are correct.
4. Set **HTTP Port** to `3000`.
5. Add a custom domain (e.g. `grittyfitness.app`) and let DO provision the
   Let's Encrypt certificate.

Alternatively, since every route is statically prerendered, you can
`next export`-equivalent it (`output: "export"` in `next.config.ts`) and host
on any static host (Cloudflare Pages, DO Spaces + CDN, etc.). Skip this until
you actually need login / Stripe — then you'll want the Node runtime back.

## Future work (placeholders already wired)

- **Login & Stripe checkout** — add `app/login/`, `app/account/`, and
  `app/api/stripe/` route handlers. The Premium section's CTA already points
  at `#download`; switch the href to `/checkout` when ready.
- **Cookie banner** — only required if you add non-essential cookies.
  Plausible Analytics is GDPR-friendly and cookieless if you want stats
  without a banner.

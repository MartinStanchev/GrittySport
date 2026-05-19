# Gritty Fitness — Marketing Site

Single-page marketing site for Gritty Fitness, plus legal pages (Terms of Service, Privacy Policy, Impressum). Built with Next.js 16 (App Router) + Tailwind v4.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build & lint

```bash
npm run build   # static prerender of /, /terms, /privacy, /impressum
npx eslint .    # `npm run lint` is broken in Next 16 — run eslint directly
```

## Project layout

```
app/
  page.tsx              # landing (Hero → Problem → How → Features → Premium → FAQ → CTA)
  terms/page.tsx        # Terms of Service (English)
  privacy/page.tsx      # Privacy Policy (GDPR, English)
  impressum/page.tsx    # § 5 TMG (German — required for German jurisdiction)
  layout.tsx            # shared Header + Footer, fonts, metadata
  globals.css           # Tailwind + brand tokens (--color-brand etc.)
components/
  Header.tsx, Footer.tsx, WishlistForm.tsx, LegalLayout.tsx
  sections/             # one file per landing-page section
```

## Wishlist signup

The Hero and Final CTA use `components/WishlistForm.tsx`, which POSTs to
`${NEXT_PUBLIC_API_URL}/api/wishlist` on the Go backend. Each new signup is
stored in the `wishlist_signups` table and triggers a Resend notification to
`WISHLIST_NOTIFY_TO` (set on the backend).

Required env at build time (baked into the static export):

```bash
NEXT_PUBLIC_API_URL=https://api.grittyfitness.app   # backend base URL
```

When you switch from waitlist → live launch, swap `WishlistForm` back for
real Apple / Google store badges in `Hero.tsx#DownloadBlock` and
`FinalCTA.tsx`, and update `Header.tsx` CTA copy.

## Before going live — checklist

- [ ] Replace every `<span class="placeholder">[...]</span>` in
      `app/impressum/page.tsx`, `app/privacy/page.tsx`, and
      `app/terms/page.tsx` with real legal info.
- [ ] Have the Terms and Privacy Policy reviewed by a lawyer
      (especially before enabling Stripe checkout).
- [ ] Update `app/privacy/page.tsx` to mention wishlist email collection
      (purpose: launch notification, retention until launch + unsubscribe).
- [ ] Add the marketing domain to backend `CORS_ALLOWED_ORIGINS`
      (e.g. `https://grittyfitness.app,https://www.grittyfitness.app`).
- [ ] Set `WISHLIST_NOTIFY_TO=hello@grittyfitness.app` on the backend so
      Resend forwards each signup to your inbox.
- [ ] Set `NEXT_PUBLIC_API_URL` on the web App Platform component so the
      form points at the real API host.
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
  at `#download` (the wishlist form); switch the href to `/checkout` when ready.
- **Cookie banner** — only required if you add non-essential cookies.
  Plausible Analytics is GDPR-friendly and cookieless if you want stats
  without a banner.
- **Wishlist → launch announcement** — query `SELECT email FROM wishlist_signups`
  to get the launch mailing list. Use Resend's broadcast API or export to your
  ESP of choice.

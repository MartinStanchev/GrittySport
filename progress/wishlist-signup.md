# Pre-launch wishlist signup

Replaces the "Download on the App Store / Get it on Google Play" badges on
the marketing site with a "Join the waitlist" email form. Stays compatible
with `output: "export"` (static site) by `fetch()`ing the existing Go
backend from the client.

## Why

The apps aren't in the stores yet (legal/admin in progress). The marketing
domain still has SEO value and external links, so it needs a real CTA. An
email-only waitlist costs nothing, gives a launch mailing list, and avoids a
third-party form processor (no extra GDPR DPA, no extra dependency).

## How it works

1. User enters email on `WishlistForm` → POSTs `{"email":"..."}` to
   `${NEXT_PUBLIC_API_URL}/api/wishlist`.
2. Go backend validates the address (lowercased, RFC-parsed, ≤254 chars).
3. Row inserted into `wishlist_signups` with `ON CONFLICT (email) DO NOTHING`
   — duplicate signups silently succeed (no enumeration, no double-email).
4. On a **new** row, Resend fires a notification to `WISHLIST_NOTIFY_TO`
   ("New wishlist signup: foo@bar.com"). Re-signups skip the email.
5. Response is `204 No Content` on success, `422` on bad email, `429` on rate
   limit.

The endpoint is unauthenticated. Per-IP token bucket (5 burst, then 1 every
30 s) caps abuse of the Resend send budget without blocking legitimate users
who only sign up once.

## Files

### Backend
- `db/migrations/031_wishlist_signups.sql` — table (`id`, `email UNIQUE`,
  `created_at`).
- `backend/internal/services/wishlist.go` — `WishlistService.Subscribe`,
  `normalizeWishlistEmail`.
- `backend/internal/services/wishlist_test.go` — new/duplicate/invalid/empty
  notify-to coverage.
- `backend/internal/handlers/wishlist.go` — `Subscribe` handler.
- `backend/internal/email/sender.go` — extended `Sender` interface with
  `SendWishlistNotification`.
- `backend/internal/email/resend.go` — `wishlistText` / `wishlistHTML` +
  shared `send` helper (deduped from `SendOTP`).
- `backend/internal/email/mock.go` — `SendWishlistNotification` + capture
  buffer.
- `backend/main.go` — service+handler wiring, `WISHLIST_NOTIFY_TO` env var,
  `POST /api/wishlist` route with dedicated `wishlistLimiter`.

### Frontend
- `web/components/WishlistForm.tsx` — client form (loading/success/error
  states, Privacy Policy link, `NEXT_PUBLIC_API_URL` env).
- `web/components/sections/Hero.tsx` — `DownloadBlock` now renders
  `WishlistForm` instead of `StoreBadges`.
- `web/components/sections/FinalCTA.tsx` — same swap; copy updated.
- `web/components/sections/Premium.tsx` — "Premium coming soon" CTA → "Join
  the waitlist".
- `web/components/Header.tsx` — sticky CTA "Get the app" → "Join the
  waitlist" (still anchors to `#download`).
- `web/components/StoreBadges.tsx` — **deleted** (dead code).
- `web/README.md` — wishlist setup notes + updated launch checklist.

## Required env on deploy

| Where    | Var                     | Example                                |
|----------|-------------------------|----------------------------------------|
| Web      | `NEXT_PUBLIC_API_URL`   | `https://api.grittyfitness.app`        |
| Backend  | `WISHLIST_NOTIFY_TO`    | `hello@grittyfitness.app`              |
| Backend  | `CORS_ALLOWED_ORIGINS`  | `https://grittyfitness.app,…`          |

`NEXT_PUBLIC_API_URL` is baked at build time because the site is statically
exported. If unset, defaults to `https://api.grittyfitness.app`.

## When the app launches

1. Bring `StoreBadges`-style component back (git history has the original).
2. Swap `WishlistForm` for it in `Hero.tsx#DownloadBlock` and `FinalCTA.tsx`.
3. Update header CTA copy back to "Get the app".
4. `SELECT email FROM wishlist_signups ORDER BY created_at` → feed into
   Resend Audiences (or your ESP) for the launch broadcast.

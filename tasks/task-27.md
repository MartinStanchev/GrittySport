## Feature 27: Web-Only Premium Unlock (Stripe)

### Goal
Sell premium subscriptions exclusively on the marketing site (`web/`) via Stripe Checkout. The mobile app is fully free to download and contains **no in-app upgrade UI**. Premium status is determined by the backend from Stripe webhooks; the app reads `subscription_tier` from `GET /users/me` and unlocks features when the tier flips. No StoreKit / Play Billing integration in v1.

### Why this approach
- Avoids Apple's 15–30% and Google's 15–30% cuts. Stripe is ~1.5% + €0.25 in the EU.
- This is the model Netflix, Spotify, Audible, Kindle, Disney+, Basecamp/Hey, and (with markup) YouTube Premium and Patreon use. Users recognize the pattern.
- Stripe handles renewals, dunning, refunds, proration, VAT/MOSS, and Customer Portal out of the box — all of which we'd otherwise hand-roll against Apple's S2S notifications and Google's Real-Time Developer Notifications.
- Sidesteps Apple §3.1.1 review risk (no "Coming Soon" upgrade buttons, no functional purchase outside IAP).

### Out of scope for v1
- IAP via StoreKit / Play Billing — revisit once we have actual demand data and want to optimize mobile conversion.
- In-app links to the web checkout. The EU DMA and US Epic injunction permit this, but the universally-safe v1 stance is "no upgrade UI in app at all." Discovery happens on the marketing site, in email, or via word of mouth.

---

### Task 27.1: Strip in-app upgrade UI

Remove every reference to premium upgrades from the mobile app. Premium feature gating (the *enforcement* — quota counters, premium-only API responses) stays exactly as it is. We're only deleting the *promotion*.

**Frontend:**
- `frontend/src/screens/CreateProgramReviewScreen.tsx:47–50` — remove the "Upgrade (Coming Soon)" Alert button; replace the message body with neutral copy ("Free accounts are limited to 1 active program. Delete or archive your current program to create a new one.").
- `frontend/src/screens/SettingsScreen.tsx:510` — drop the "Upgrade to Premium" / "Manage Subscription" row entirely for `tier === 'free'`. For `tier === 'premium'`, keep a "Manage Subscription" row that opens the Stripe Customer Portal in the system browser (see 27.5).
- `frontend/src/components/PremiumStatsCard.tsx` — audit for any "unlock with premium" copy; replace with neutral "available on Gritty Premium" labels (no link, no CTA).
- Search the codebase for `Premium`, `premium`, `Upgrade`, `upgrade`, `subscription` strings and audit each. Anything that prompts the user to take action becomes neutral feature-naming.

**Backend tool error messages:**
- `backend/internal/tools/tools.go:224` — change `"You've reached your free draft program limit (3). Delete an existing draft or upgrade to premium."` to `"You've reached your draft program limit (3). Delete an existing draft to continue."`.
- `backend/internal/tools/tools.go:818` — same treatment for the preference-limit string.
- Audit any other tool / API error that mentions upgrading.

---

### Task 27.2: Database schema

**Migration `0XX_stripe_subscriptions.sql`:**
```sql
ALTER TABLE users
    ADD COLUMN stripe_customer_id     TEXT UNIQUE,
    ADD COLUMN stripe_subscription_id TEXT UNIQUE;

CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
```

`subscription_tier` and `premium_until` already exist (per `db/migrations/010_premium_tier.sql`). The webhook writes to those columns.

---

### Task 27.3: Stripe webhook endpoint

**`backend/internal/handlers/stripe.go`** — new handler.

Route: `POST /api/webhooks/stripe` (mounted outside `/api/v1`, no JWT auth — signature is the auth).

1. Read raw request body before any JSON decode.
2. Verify `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` env var (use `stripe-go/webhook.ConstructEvent`).
3. Dispatch on `event.Type`:
   - `checkout.session.completed` → look up user by `customer_email` (fall back to `customer` ID lookup), set `stripe_customer_id`, `stripe_subscription_id`, `subscription_tier = 'premium'`, `premium_until = subscription.current_period_end`.
   - `customer.subscription.updated` → refresh `premium_until` from `current_period_end`. If `cancel_at_period_end = true`, leave tier=premium until expiry.
   - `customer.subscription.deleted` → set `subscription_tier = 'free'`, clear `premium_until`, clear `stripe_subscription_id` (keep `stripe_customer_id` for resubscribe).
   - `invoice.payment_failed` → log + (later) trigger an email reminder. Don't downgrade immediately — Stripe handles dunning.
4. Return 200 OK on success, 400 on signature failure, 500 on DB error (Stripe will retry 5xx).

**Idempotency:** every event has an `id` — store recent event IDs in a small `stripe_events` table (TTL 30 days via retention scheduler) and skip duplicates.

**Body-limit middleware exception:** the global 8 MB cap added in the server-hardening pass is fine for Stripe payloads (kilobytes), no change needed.

---

### Task 27.4: Marketing site — pricing + checkout

**`web/app/pricing/page.tsx`** (new):
- Free vs Premium feature comparison.
- "Subscribe" button → opens Stripe Checkout in a hosted session.
- Pricing TBD — recommend starting at €7.99/month (small-business 1.5% Stripe fee on €7.99 = €0.37 + €0.25 fixed; net €7.37 per subscriber).

**`web/app/api/checkout/route.ts`** (new, server-side):
- POST with `{ email: string }`.
- Creates a Stripe Checkout Session with `mode: 'subscription'`, `customer_email`, success_url, cancel_url.
- Returns the session URL.

**`web/app/subscribe/success/page.tsx`** (new):
- Shown after Stripe redirects back. Copy: "Subscription active. Open the Gritty app — your premium features unlock automatically." Optional deep link button `grittyfitness://refresh-status` for users who came from the app.

**Auth note:** Stripe Checkout collects the email itself. We do *not* require the user to be logged into the marketing site. The webhook matches by email against `users.email`. Edge case: paid with a different email than their app account → success page shows a "wrong email?" support link. Document this on the pricing page.

---

### Task 27.5: Stripe Customer Portal (premium-only)

For users who already have premium, `SettingsScreen.tsx` shows a "Manage Subscription" row that:
1. Calls `POST /api/v1/billing/portal` → backend creates a Stripe Billing Portal session keyed by `stripe_customer_id` → returns the portal URL.
2. App opens the URL via `Linking.openURL` (system browser).

Backend handler `backend/internal/handlers/billing.go`:
- `POST /api/v1/billing/portal` — requires JWT + consents. Looks up `stripe_customer_id`, creates portal session via Stripe API, returns `{ url }`. Returns 404 if user has no Stripe customer (shouldn't happen for premium users but defensive).

This route is permitted by Apple/Google because it's account management, not a purchase flow.

---

### Task 27.6: App sync flow

Already mostly works. Verify:
- `useFocusEffect` on `HomeScreen` / `SettingsScreen` refetches `GET /users/me` so a user who paid on web sees premium unlock on next app foreground.
- Add a one-time refetch on app foreground in `AuthContext` if not already present.
- Optional: deep-link handler for `grittyfitness://refresh-status` that force-refetches and shows a "Welcome to Premium" toast.

---

### Task 27.7: Account deletion (Art. 17) — cancel Stripe subscription

In `backend/internal/handlers/user.go` `DeleteMe` (or wherever the cascade happens):
1. Before deleting the user row, if `stripe_subscription_id IS NOT NULL`, call Stripe API to cancel the subscription immediately (or at period end — confirm with legal which is GDPR-correct).
2. Log the Stripe response; don't block deletion on Stripe failure (best-effort), but alert.

---

### Task 27.8: Stripe configuration (one-time)

Operational, not code:
- Stripe account in the entity's name (per `LAUNCH_CHECKLIST.md` §0).
- VAT/OSS registration via Stripe Tax (handles EU MOSS).
- Product + price created (`Gritty Premium`, recurring monthly, €7.99 EUR).
- Webhook endpoint registered (production + staging URLs), `STRIPE_WEBHOOK_SECRET` added to deployment env.
- `STRIPE_API_KEY` (secret key) added to deployment env.
- Test mode used for local dev — `.env.example` updated.

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `db/migrations/0XX_stripe_subscriptions.sql` | Create — Stripe ID columns + idempotency table |
| `backend/internal/handlers/stripe.go` | Create — webhook handler |
| `backend/internal/handlers/billing.go` | Create — Customer Portal session endpoint |
| `backend/internal/services/billing.go` | Create — Stripe API client wrapper |
| `backend/main.go` | Modify — register routes, read `STRIPE_*` env, fail fast if missing in prod |
| `backend/internal/handlers/user.go` | Modify — cancel Stripe subscription on `DeleteMe` |
| `backend/internal/tools/tools.go` | Modify — neutral wording on quota-exceeded errors (lines 224, 818) |
| `web/app/pricing/page.tsx` | Create — pricing + subscribe CTA |
| `web/app/api/checkout/route.ts` | Create — server-side Stripe Checkout session |
| `web/app/subscribe/success/page.tsx` | Create — post-checkout landing |
| `frontend/src/screens/CreateProgramReviewScreen.tsx` | Modify — strip upgrade Alert |
| `frontend/src/screens/SettingsScreen.tsx` | Modify — drop upgrade row for free; "Manage Subscription" → portal for premium |
| `frontend/src/components/PremiumStatsCard.tsx` | Modify — neutral copy audit |
| `.env.example` | Modify — `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` placeholders |

---

### How to Test

1. **Webhook signature:** post a forged event with a bad signature → 400. Use Stripe CLI `stripe trigger checkout.session.completed --add checkout_session:customer_email=test@example.com` in local dev.
2. **Happy path:** sign up in app with email X → on web, subscribe with email X → in app, force foreground refresh → tier flips to premium, quota limits relax.
3. **Cancellation:** cancel in Customer Portal → user stays premium until `premium_until` → after period end, retention job or next webhook flips tier to free.
4. **Email mismatch:** subscribe on web with email Y while app account is email X → tier on X stays free → success page warns user → support flow.
5. **Refund:** issue refund in Stripe dashboard → `customer.subscription.deleted` fires → tier flips to free immediately.
6. **Account deletion:** premium user deletes account → Stripe subscription is canceled in the same flow; verify with Stripe dashboard.
7. **Webhook idempotency:** replay the same event twice → second insert is a no-op, no duplicate state changes.
8. **Free user UX:** confirm no "Upgrade" / "Premium" / "Coming Soon" copy is reachable anywhere in the app (settings, program creation, chat error messages, paywall components).

### Open Questions

- Pricing: €7.99/month? Annual option at €79/year (~17% discount)?
- Trial period: 14-day free trial via Stripe? Or no trial since the free tier is already generous?
- Should the marketing site require login before checkout (cleaner email match) or accept any email (lower friction, more support tickets)?
- Refund policy text — needed for Stripe + Impressum.

## Feature 31: Email Capture + Referral Primitive

### Goal
Two related growth primitives:
1. **Email capture** on the marketing site so visitors who aren't ready to install still enter the funnel — used for launch announcements, content drops (per [task-30](task-30.md)), and re-engagement.
2. **Referral system** so existing users can invite friends with a shareable link. On the friend's first premium upgrade, both sides receive a benefit (1 free month of premium each).

Both are foundational marketing infrastructure. Email is the highest-ROI channel in fitness (much higher CTR than social), and referral programs are the single most effective lever for organic growth in subscription apps.

### Why this approach
- The marketing site has zero email capture today — every visitor who doesn't immediately install is a permanent drop-off. A modest "Get the launch email" form likely captures 5–15% of visitors at near-zero engineering cost.
- Resend is already integrated for OTP (per `progress/passwordless-auth-otp.md`), so adding marketing email uses the same infrastructure.
- Referral programs work best when the benefit accrues to both sides — solo benefits (just the referrer gets something) feel exploitative; symmetric benefits ("free month for both") feel like a friend recommendation.
- A premium-month grant is structurally cleaner than a discount because it integrates with [task-27](task-27.md)'s Stripe model (no coupon code juggling; the backend just extends `premium_until`).

### Dependency
- **Task 27 (Stripe)** must ship first for the referral payoff to work — the trigger "friend becomes premium" requires Stripe webhook plumbing. Email capture is fully independent and can ship now.
- It's fine to ship the email capture half (31.1–31.3) immediately and the referral half (31.4–31.8) after 27 lands.

### Out of scope
- Full ESP migration (Mailchimp, Beehiiv, ConvertKit). Resend handles transactional + simple marketing well enough for v1 launch; revisit at ~5k subscribers.
- Reward variants (referral leaderboard, milestone bonuses, etc.). Symmetric "1 free month each" only.
- Multi-tier referrals (referring 5 friends gets X). Simple 1:1 only.
- Anti-abuse heuristics beyond the basics (same-IP duplicate signups, etc.). Note as future work.

---

## Part A — Email Capture (independent of task-27)

### Task 31.1: Backend — marketing subscribers table + endpoint

**Migration `0XX_marketing_subscribers.sql`:**

```sql
CREATE TABLE marketing_subscribers (
    id            BIGSERIAL PRIMARY KEY,
    email         CITEXT NOT NULL UNIQUE,
    source        TEXT NOT NULL,                       -- 'landing', 'learn-footer', 'final-cta', etc.
    locale        TEXT NOT NULL DEFAULT 'en',          -- 'en' | 'de'
    confirmed_at  TIMESTAMPTZ,                          -- nullable; set when double opt-in confirmed
    confirm_token TEXT,                                  -- random token sent in the confirmation email
    unsubscribed_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_at_signup  INET,                                  -- DSGVO Art. 7 evidence; purge after 6 months
    user_agent    TEXT
);

CREATE INDEX idx_marketing_subscribers_confirmed ON marketing_subscribers(confirmed_at) WHERE unsubscribed_at IS NULL;
```

**Why double opt-in (DOI):** under DSGVO, single opt-in is technically permissible if the consent is unambiguous, but DOI is the universal-safe pattern and what every German lawyer will recommend. Same standard already applied to OTP — reuse the pattern.

**Handler `backend/internal/handlers/marketing.go`:**

- `POST /api/marketing/subscribe` — body `{ email, source, locale }`. Validates email format (use the same validator as OTP). Inserts row with a random `confirm_token`. Sends a confirmation email via Resend with a link `https://grittyfitness.app/confirm-subscription?token=...`. Returns 200 with `{ status: 'pending_confirmation' }`. Rate limit: 3/hour per IP.
- `GET /api/marketing/confirm?token=...` — flips `confirmed_at = now()` if token matches and confirmation hasn't lapsed (token valid 7 days). Returns a redirect to `/subscribed?status=ok` (web confirmation page) or `?status=expired`.
- `GET /api/marketing/unsubscribe?token=...` — accepts an unsubscribe token (separate from confirm token; generated at email send time and stored), sets `unsubscribed_at = now()`. Returns plain HTML confirmation.

**Rate limiting:** add to the existing per-IP rate limit pattern (per `progress/security-audit-batch-2-auth.md`) — `/api/marketing/*` gets 5 req/min per IP.

**No PII in logs:** email goes through the same redaction middleware as `/api/auth/*` (per `progress/security-audit-medium-fixes.md`).

---

### Task 31.2: Resend templates

Two transactional email templates in the existing Resend integration:

1. **Confirmation email** (`marketing/subscribe-confirm`). Subject: `Confirm your Gritty subscription`. Body (EN + DE):
   - One-sentence "thanks for subscribing".
   - Big button → confirmation link.
   - Footer: "Didn't sign up? Ignore this email."

2. **Welcome email** (`marketing/subscribe-welcome`), sent after confirmation. Subject: `You're in.`. Body:
   - "Here's what to expect: launch announcement, occasional training-science articles, no spam."
   - Unsubscribe link in footer (required by DSGVO + CAN-SPAM).
   - Link to install the app once it's live.

Put template HTML in `backend/internal/email/templates/marketing/`. Reuse the existing email-sending plumbing.

---

### Task 31.3: Frontend — capture forms on the marketing site

Add an `<EmailCapture />` component (`web/components/EmailCapture.tsx`) that:
- Renders an email input + submit button styled in Aura Kinetic palette.
- Has `source` prop so the same component can be reused across the site with different attribution.
- POSTs to `/api/marketing/subscribe` (via `web/app/api/subscribe/route.ts` server proxy if CORS becomes a problem; otherwise direct to the backend if `NEXT_PUBLIC_API_URL` is set).
- On success: replaces the form with "Check your inbox to confirm." On error: shows inline error.

Drop the component into:
- `web/components/sections/FinalCTA.tsx` — replace or supplement the existing CTA with the form.
- Footer of `/learn` index and each `/learn/[slug]/page.tsx` (cross-promote per task-30 once it ships).
- Optional: a small modal that appears once per visitor on exit-intent (only if data shows the static placement converts poorly).

**Pages:**
- `web/app/subscribed/page.tsx` — confirmation landing ("You're confirmed. Welcome.").
- `web/app/unsubscribed/page.tsx` — unsubscribe confirmation.

---

## Part B — Referral (requires task-27 Stripe to be in place)

### Task 31.4: Backend — referral schema

**Migration `0XX_referrals.sql`:**

```sql
ALTER TABLE users
    ADD COLUMN referral_code TEXT UNIQUE,
    ADD COLUMN referred_by_code TEXT;   -- nullable; the code that referred this user

CREATE TABLE referrals (
    id                 BIGSERIAL PRIMARY KEY,
    referrer_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code      TEXT NOT NULL,                      -- snapshot, in case the code is rotated
    referee_signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    referee_upgraded_at  TIMESTAMPTZ,                       -- set when referee's first premium webhook fires
    reward_granted_at    TIMESTAMPTZ,                       -- set when both sides receive their free month
    UNIQUE (referee_user_id)                                -- a user can only be referred once
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
```

**`referral_code` generation:** 8-char base32-no-ambiguous (`Crockford` alphabet — no `I`, `L`, `O`, `U`, `0`, `1`) → ~10¹² space, vanishingly low collision risk. Generate on user creation; backfill existing users via a one-time SQL migration.

---

### Task 31.5: Backend — capture referral on signup

Modify `POST /api/auth/otp/verify` to accept optional `referred_by_code` in the body:

- If present, look up the user with that `referral_code`; if found AND the verifying user is brand new (not an existing email), insert a `referrals` row with `referrer_user_id` + the new `referee_user_id`.
- If the code doesn't match any user, ignore silently (don't fail signup).
- Self-referral (same email as code owner) is silently ignored.
- Already-referred (existing `referrals` row for this user) is silently ignored.

This requires the frontend to pass the code through from the deep-link / signup screen.

---

### Task 31.6: Backend — grant reward on referee upgrade

In the Stripe webhook handler (`backend/internal/handlers/stripe.go`, per [task-27](task-27.md)), inside the `checkout.session.completed` branch:

1. After flipping the user to premium, check `SELECT * FROM referrals WHERE referee_user_id = $1 AND reward_granted_at IS NULL`.
2. If a row exists:
   - Update `referee_upgraded_at = now()` on the row.
   - Grant 1 free month to the referee: `UPDATE users SET premium_until = premium_until + INTERVAL '1 month' WHERE id = referee_user_id`.
   - Grant 1 free month to the referrer: same UPDATE for `referrer_user_id`. If the referrer is currently free tier, this also flips them to premium for the month.
   - Set `reward_granted_at = now()`.
   - Send a `referral-reward` email to both via Resend ("Your friend joined Gritty Premium. Here's your free month.").

**Stripe note:** since we're extending `premium_until` manually (not via Stripe), the referrer's subscription state in Stripe and the local `premium_until` can diverge temporarily. Document this — the webhook for the referrer's *real* subscription will overwrite `premium_until` based on Stripe's billing cycle, which can shorten the free month if the user is mid-cycle. Acceptable for v1; revisit if it causes confusion.

---

### Task 31.7: Frontend — Invite friends screen

**`frontend/src/screens/InviteFriendsScreen.tsx`** (new):

- Pulls `user.referral_code` from `GET /users/me`.
- Displays the shareable link: `https://grittyfitness.app/r/<CODE>`.
- "Share" button → opens the native share sheet (`expo-sharing`) with pre-filled text: *"I'm using Gritty Fitness. AI coach that builds your training plan across every sport. Use my link to get 1 month of Premium free when you upgrade: https://grittyfitness.app/r/CODE"*.
- "Copy link" button (`expo-clipboard`).
- Below the link, a small "Your referrals" section pulling from `GET /api/v1/referrals/me` → list of (anonymized) referred users with status (joined / upgraded / reward granted) and the total free months earned.

Add a row in `SettingsScreen.tsx` → "Invite friends" → navigates to `InviteFriendsScreen`.

**`GET /api/v1/referrals/me`** — new endpoint returning `{ referral_code, link, referrals: [{ joined_at, upgraded: bool, reward_granted: bool }] }`. Use friend's `id` only internally; don't leak emails or names.

---

### Task 31.8: Marketing site — referral landing

**`web/app/r/[code]/page.tsx`** (new):
- Renders the standard landing page with a banner at the top: *"You've been invited by a friend. Get 1 month of Premium free when you upgrade."*
- Drops the code into a first-party cookie `gritty_ref` (90-day expiry) AND into `localStorage`.
- The mobile app's deep link `grittyfitness://r/CODE` should also be supported: add it to `frontend/app.json` URL schemes and parse in the navigation handler. On signup, read the cookie/localStorage/deep-link param and send it as `referred_by_code` in `POST /otp/verify`.

The cookie is technically a "functional cookie" under DSGVO, so it can be set without explicit consent (the site already runs cookieless; adding one functional cookie is fine). Update `privacy/datenschutz` to mention it.

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| **Part A — Email capture** | |
| `db/migrations/0XX_marketing_subscribers.sql` | Create |
| `backend/internal/handlers/marketing.go` | Create — subscribe / confirm / unsubscribe handlers |
| `backend/internal/email/templates/marketing/subscribe-confirm.{html,txt}` | Create — DOI template (EN + DE) |
| `backend/internal/email/templates/marketing/subscribe-welcome.{html,txt}` | Create — welcome email |
| `backend/main.go` | Modify — register `/api/marketing/*` routes + rate limit |
| `web/components/EmailCapture.tsx` | Create — reusable form component |
| `web/components/sections/FinalCTA.tsx` | Modify — embed `EmailCapture` |
| `web/app/subscribed/page.tsx` | Create — confirmation landing |
| `web/app/unsubscribed/page.tsx` | Create — unsubscribe confirmation |
| `web/app/privacy/page.tsx` + `web/app/datenschutz/page.tsx` | Modify — add marketing-email + cookie disclosures |
| **Part B — Referral (after task-27)** | |
| `db/migrations/0XX_referrals.sql` | Create — `referral_code` + `referrals` table |
| `backend/internal/handlers/auth.go` | Modify — `OTPVerify` accepts `referred_by_code` |
| `backend/internal/handlers/stripe.go` | Modify (after task-27) — grant referral rewards in `checkout.session.completed` |
| `backend/internal/handlers/referrals.go` | Create — `GET /api/v1/referrals/me` |
| `backend/internal/email/templates/referral-reward.{html,txt}` | Create |
| `backend/main.go` | Modify — register referral route |
| `frontend/src/screens/InviteFriendsScreen.tsx` | Create — share UI + referral list |
| `frontend/src/screens/SettingsScreen.tsx` | Modify — add "Invite friends" row |
| `frontend/app.json` | Modify — add `grittyfitness://r/<code>` deep link schema |
| `frontend/src/navigation/...` (deep link handler) | Modify — parse `r/<code>`, persist for signup |
| `frontend/src/contexts/AuthContext.tsx` | Modify — include `referred_by_code` in OTP verify call when present |
| `web/app/r/[code]/page.tsx` | Create — referral landing |

---

### How to Test

**Email capture (Part A):**

1. **DOI happy path:** submit form → backend creates row with `confirmed_at = NULL`, sends confirmation email → click link → row `confirmed_at` set → welcome email sent → user lands on `/subscribed`.
2. **Duplicate email:** submit same email twice → second insert no-ops (UNIQUE constraint), no second email sent, return same "check your inbox" message. Don't leak whether the email exists.
3. **Expired confirm token:** generate row, fast-forward time 8 days, click link → redirect to `/subscribed?status=expired`.
4. **Unsubscribe:** click link in welcome email → `unsubscribed_at` set → subsequent campaigns skip this row.
5. **Rate limit:** submit 6 times in a minute from one IP → 6th returns 429.
6. **No PII in logs:** trigger `/subscribe`, grep server logs for the test email → not present.
7. **Lint + tests:** `golangci-lint run`, new handler unit tests, `npx eslint .` in `web/`.

**Referral (Part B, after task-27):**

8. **Code on every user:** after migration, all existing users have a non-null `referral_code`; format matches the Crockford pattern.
9. **Capture on signup:** user A's code → user B opens `grittyfitness://r/<A.code>` → installs → signs up → `referrals` row created with `referrer = A, referee = B`.
10. **Already-existing user using the link:** user B (existing) opens user A's link → no `referrals` row inserted; signup flow runs as normal.
11. **Self-referral:** user A uses their own code → silently ignored.
12. **Reward on upgrade:** user B subscribes via Stripe → `checkout.session.completed` webhook fires → `referrals.reward_granted_at` set, both A and B have `premium_until` extended by 1 month, both receive `referral-reward` email.
13. **Idempotency:** Stripe retries the webhook → reward is not granted twice (check `reward_granted_at IS NULL` guard).
14. **No reward on downgrade/refund:** if user B's `checkout.session.completed` succeeded but `customer.subscription.deleted` fires within a few days (refund), the reward stays granted — document this as intended; refund-clawback for referral rewards is v2.
15. **Privacy:** `GET /api/v1/referrals/me` returns anonymized referrals (no email, no name).
16. **Deep link parses correctly:** open `grittyfitness://r/ABC123` from a cold app start → code captured → carried into OTP verify body.
17. **Cookie set on web landing:** visit `/r/ABC123` → `gritty_ref=ABC123` cookie present, 90-day expiry.
18. **Lint + tests:** all the above.

---

### Open Questions

- **Single vs double opt-in:** DOI strongly recommended for DE/EU; confirm with the user. Single opt-in lifts conversion ~30% but increases legal risk.
- **Resend template format:** ship plain HTML or use Resend's React Email templating? Already using one or the other for OTP — match that.
- **Reward size:** 1 free month each, or different (e.g., 2 months for referrer, 1 for referee)? Symmetric is the recommendation; asymmetric is more aggressive growth.
- **Reward when referee was already a paying user before being referred:** edge case — they can't be referred twice. Current schema (`UNIQUE (referee_user_id)`) enforces this; existing premium users can never be a referee.
- **Referrer free-tier flip:** if a free-tier user is rewarded (their friend upgraded), they get 1 month of premium. After it expires, do we send a "your free trial ended — keep premium for €7.99?" email? Probably yes; track in `referrals.reward_granted_at` and run a daily cron. Not in scope for v1.
- **Anti-abuse:** same IP, throwaway email signups, etc. Not in scope — flag for future iteration.
- **Code rotation:** can users regenerate their referral code if it leaks? Probably yes via Settings → "Rotate code" → invalidates old code. Not in scope for v1.
- **Display in landing copy:** the `/r/[code]` banner says "1 month free when you upgrade." Confirm this maps to Stripe's pricing decision in task-27.

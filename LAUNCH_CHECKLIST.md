# Gritty Fitness — Launch Checklist (EU-first, Apple + Google)

Living checklist of everything required to ship the app on the App Store and Google Play in the EU. Tick boxes as you go. Most items below are **policy/legal**, not code — the code work is tracked in `PROGRESS.md`.

> **Disclaimer:** I'm not a tax or legal advisor. Verify entity, tax, and trader-status decisions with a German Steuerberater / Rechtsanwalt before acting on this checklist.

## TL;DR table

| Topic | Apple App Store | Google Play |
|---|---|---|
| Account type for health apps | Individual or Organization (either works) | **Organization required** (since Jan 28, 2026) |
| D-U-N-S number | Only if Organization | Required (because forced to Organization) |
| Cost | $99 / year | $25 one-time |
| EU DSA trader status | Required if selling | Required if selling |
| Public address on EU store | **Yes** — trader's address shown publicly | **Yes** — trader's address shown publicly |
| Health-specific declaration | Privacy Manifest + App Privacy labels | Health Apps Declaration form |
| "Not a medical device" disclaimer | In-app + store metadata | **First paragraph of store description** |
| Privacy policy URL | Must match Console + in-app + website | Must match Console + in-app + website (public webpage, no PDF) |
| Review pass time (typical) | 24–48 h | Hours–days (declaration mismatches block release) |

---

## 0 · Legal entity decision

You can't ship a Health Connect–reading app on a Personal Google Play account anymore. Decide entity once and use it everywhere.

- [ ] **Decided entity type** — options:
  - **German UG (haftungsbeschränkt)** — €1 min. capital, ~€300–500 setup, ~€100–300/mo bookkeeping. Stay in Germany. Effective tax ~30% corporate + 25% dividend.
  - **Bulgarian EOOD** — 2 BGN capital, ~€25 setup, ~€80–150/mo bookkeeping, 10% corporate + 5% dividend. **Only captures Bulgarian tax rates if you actually relocate** — § 10 AO ("Ort der Geschäftsleitung") will reclassify it as German-resident otherwise.
  - **Personal developer + virtual Anschrift service (Apple only)** — works on Apple, but you'll still need a company for Google's Health-Apps path.
- [ ] **Talked to a Steuerberater** about the choice (interaction with current employment, Krankenkasse, Sozialversicherung).
- [ ] **Confirmed employer's "Nebentätigkeit" policy** allows operating a side venture.
- [ ] **Entity registered** (Handelsregister number / EOOD ЕИК) — save the number, you'll need it for both stores.
- [ ] **Business bank account** opened in the entity's name.

## 1 · D-U-N-S number

D-U-N-S is the long-pole blocker — apply first. Free, slow.

- [ ] **D-U-N-S application submitted** at dnb.com/duns. Use the **legal entity name** as it appears in the Handelsregister / search registry — must match exactly.
- [ ] **D-U-N-S number received** (typical wait: up to 30 days).
- [ ] Saved the D-U-N-S number alongside the entity's legal name + registered address (must match across Apple, Google, and your privacy policy).

## 2 · EU DSA trader status

Mandatory for any developer selling in the EU since Feb 17, 2024. Address becomes **publicly visible** on EU store listings.

- [ ] **Decided trader address strategy** — registered business address, or virtual office (Clevver, eBuero, Regus, etc.) so home address doesn't go public.
- [ ] **Apple:** trader form submitted in App Store Connect → Agreements, Tax, and Banking → Trader status. Legal name + address + phone + email all entered identically to the entity record.
- [ ] **Google:** trader declaration in Play Console → Payments profile → Public business profile. Same legal data as Apple.
- [ ] Verified the public address shown on a test EU listing isn't your home Anschrift.

## 3 · Apple App Store

### 3.1 Developer Program

- [ ] **Apple Developer Program** enrolled ($99/yr) — Organization tier if you have a legal entity (Apple verifies the D-U-N-S + business identity, ~1–2 weeks).
- [ ] **Team Agent** role assigned (the natural person with binding authority for the company).
- [ ] **Two-factor enforced** on the Apple ID tied to the team.

### 3.2 HealthKit + iOS-specific compliance

These apply to the existing Apple Health import flow.

- [ ] **App Privacy "nutrition labels"** (App Store Connect → App Privacy) updated to list every HealthKit data type read: Workouts, Heart Rate, Active Energy, Distance, Workout Route. Each tagged with "Used to: App Functionality" + "Not Linked to User" or "Linked" honestly per how you store.
- [ ] **Privacy Manifest** (`PrivacyInfo.xcprivacy`) in the iOS app bundle declares: collected data categories, required-reason APIs, and third-party SDK manifests. Mandatory since 2024.
- [ ] **Info.plist usage strings** present: `NSHealthShareUsageDescription` (already set per `app.json:67`).
- [ ] **§5.1.3 Health data rules** verified:
  - HealthKit data never used for advertising.
  - HealthKit data never sold to third parties.
  - Privacy policy explicitly mentions HealthKit usage.
- [ ] **§5.1.1(ix) AI disclosure** — Grit chat clearly labeled as AI, not a medical professional. The existing transparency badges (per `progress/eu-compliance-pass.md`) cover this; confirm they're visible before first chat interaction.
- [ ] **§1.4.1 medical-app review** self-check — no inaccurate health info, no actions that could cause harm. No "treat", "diagnose", "cure" language in Grit's outputs (review system prompt).
- [ ] **App Review Information** filled out with a demo account that has at least one program + a few imported workouts — reviewers can't sign up via OTP without one.

### 3.3 Store listing

- [ ] **App name + subtitle** finalized for EU locales (EN, DE primary).
- [ ] **"Not a medical device" disclaimer** in app description first paragraph (EN + DE).
  - EN: *"Gritty is a fitness coaching app. It is not a medical device and does not diagnose, treat, cure, or prevent any disease."*
  - DE: *"Gritty ist eine Fitness-Coaching-App. Sie ist kein Medizinprodukt und dient nicht zur Diagnose, Behandlung, Heilung oder Vorbeugung von Krankheiten."*
- [ ] **Privacy policy URL** matches the one in-app and on the marketing site.
- [ ] **Screenshots** for all required device sizes, in EN + DE.

## 4 · Google Play

### 4.1 Developer Account

- [ ] **Play Console account** registered as **Verified Organization** (not Personal). Tied to D-U-N-S + legal entity.
- [ ] **Identity + payments verification** complete (organization name, address, contact, banking).
- [ ] **Two-step verification** on the owner Google account.

### 4.2 Health Apps Declaration

Play Console → your app → **Policy and programs → App content → Health apps declaration**.

- [ ] **"Does your app provide health features?"** → **Yes**.
- [ ] **Categories ticked:** Activity and Fitness; AI-powered features. *Do not* tick Mental Health, Reproductive Health, Clinical Records.
- [ ] **Health Connect data types declared:** READ_EXERCISE, READ_HEART_RATE, READ_DISTANCE, READ_TOTAL_CALORIES_BURNED, READ_EXERCISE_ROUTE — matches `frontend/app.json`.
- [ ] **"Essential" justification per permission** written. Examples:
  - `READ_EXERCISE` — *"Imports user's past workout sessions so they can be linked to their AI-generated training plan and reviewed by the in-app coach."*
  - `READ_HEART_RATE` — *"Displays heart-rate trace on imported workouts to inform the AI's post-workout review (effort vs. prescribed intensity)."*
  - `READ_DISTANCE` — *"Aggregates distance for imported workouts since ExerciseSession records don't carry totals natively."*
  - `READ_TOTAL_CALORIES_BURNED` — *"Aggregates energy burn for imported workouts; same reason as distance."*
  - `READ_EXERCISE_ROUTE` — *"Displays the user's route map for imported outdoor workouts; user grants per-record."*
- [ ] **Third-party data sharing** — declare your backend (own infra) as first-party; declare Gemini as a data processor if workout context is sent to it.
- [ ] **Medical claims** — answered "no".
- [ ] **Target audience** — confirmed not directed at children (already enforced by 16+ DOB gate per `progress/birth-year-wheel-picker.md`).

### 4.3 Build + manifest

- [ ] `react-native-health-connect` + `expo-build-properties` actually installed (`npx expo install …`).
- [ ] Five Android health permissions present in `frontend/app.json` (already added).
- [ ] `minSdkVersion: 26` set (already added).
- [ ] Android EAS dev build runs through the Health Connect permission grant flow on a real device.

### 4.4 Store listing

- [ ] **App name + short description** in EN + DE.
- [ ] **"Not a medical device" disclaimer in the first paragraph of the long description** (EN + DE — same copy as Apple). This is a Jan 2026 Google rule — disclaimers at the bottom now fail review.
- [ ] **Privacy policy URL** matches Apple's. Public webpage, **not** a PDF, not geofenced.
- [ ] **Data safety section** completed — lists same data types as the declaration. Inconsistencies between Data Safety and the Declaration trigger review holds.
- [ ] **Screenshots** for phone (required) and tablet (recommended), EN + DE.

## 5 · Privacy policy + legal pages

The privacy policy lives in three places and must be byte-identical content (or a redirected canonical):

1. Marketing site: `/privacy` (EN) and `/datenschutz` (DE).
2. App Store Connect → App Privacy → Privacy Policy URL.
3. Google Play Console → Store presence → Main store listing → Privacy Policy.

- [ ] **Health Connect section added to DE + EN privacy policy** covering:
  - Which Health Connect record types are read.
  - That data originates from the user's wearable vendor (Fitbit, Garmin, Samsung, etc.) before reaching the app.
  - That the app stores imported workouts on Gritty's backend (Art. 6(1)(b) GDPR + Art. 9(2)(a) explicit consent).
  - Retention period.
  - Right to delete (Art. 17 — already wired via `progress/account-deletion.md`).
- [ ] **HealthKit section added/refreshed** in DE + EN privacy policy with parallel coverage.
- [ ] **Impressum / Legal Notice**:
  - If entity = German UG/GmbH → standard Impressum under §5 DDG (you have this).
  - If entity = Bulgarian EOOD → equivalent legal notice under ZET Art. 4.
- [ ] **AI transparency section** present (per `progress/eu-compliance-pass.md`) — confirm it mentions Gemini as the model provider.

## 6 · In-app changes before submission

- [ ] **Health Connect onboarding screen** added before the OS-level permission dialog. Explains in DE + EN:
  - What data you read.
  - Why (AI coaching + plan adjustment).
  - That the OS-level Health Connect dialog is the binding consent.
- [ ] **Apple Health onboarding parallel** — verify the existing flow has equivalent disclosure (it should already, per `progress/task-10-apple-health-import.md`).
- [ ] **First-launch "Not a medical device" disclosure** confirmed visible (per existing `eu-compliance-pass`).
- [ ] **Settings → Connected Devices** copy verified in DE + EN for both Apple Health and Health Connect rows.
- [ ] **Test the OTP flow with a freshly-deleted email** to confirm reviewers can sign in.

## 7 · Pre-submission smoke tests

- [ ] **iOS dev build:** import an Apple Health workout end-to-end on a real iPhone, link it to a scheduled activity, verify Grit's review.
- [ ] **Android dev build:** install Fitbit/Samsung Health/etc, push a workout to Health Connect, import via Gritty, link, review.
- [ ] **Account deletion** verified to wipe everything (Art. 17).
- [ ] **Data export** (Art. 15/20) returns Health Connect–imported workouts.
- [ ] **Offline mode** behaves correctly with imported workouts (per `progress/offline-mode.md`).
- [ ] **Subscription / premium upgrade** purchase test on both stores.

## 8 · Submission

- [ ] **Apple TestFlight build** uploaded, internal testers passing.
- [ ] **Google internal testing track** populated, internal testers passing.
- [ ] **Apple App Review** submitted with reviewer notes mentioning:
  - Demo account credentials (or OTP test email).
  - "App imports workouts from Apple Health and Health Connect for AI coaching."
- [ ] **Google production review** submitted. Watch for Health Declaration mismatch holds in the first 48h.
- [ ] **Apple approved.**
- [ ] **Google approved.**
- [ ] **Soft launch in DE first**, monitor for review removals / privacy complaints.
- [ ] **Roll out to the rest of the EU.**

## 9 · Post-launch ongoing duties

- [ ] **Re-submit Health Apps Declaration on any health-permission change.**
- [ ] **Privacy policy versioning** — `users.privacy_policy_version` consent record bumps when text changes (already wired per `progress/security-audit-batch-2-auth.md`).
- [ ] **GDPR data-deletion SLA** — Art. 17 says "without undue delay" (≤30 days); your delete flow runs immediately.
- [ ] **AI Act transparency** — keep AI labels current as Grit's capabilities grow.
- [ ] **Annual Apple membership renewal** ($99).
- [ ] **D-U-N-S annual refresh** — Dun & Bradstreet may email asking to confirm details.

---

## Realistic timeline from "today" to "approved EU launch"

| Week | Milestone |
|---|---|
| 0 | Decide entity. Talk to Steuerberater. Submit D-U-N-S application. |
| 1–3 | Entity formed at Handelsregister. Bank account open. Virtual Anschrift active. |
| 4 | D-U-N-S issued (typical). |
| 4–5 | Apple Developer Program enrollment + Apple Org verification. Google Play Verified Organization migration. EU DSA trader declarations on both. |
| 5 | Health Apps Declaration filled. Apple App Privacy + Privacy Manifest updated. Privacy policy + Impressum updated for Health Connect. |
| 5 | iOS + Android builds with final flows pushed to TestFlight + internal testing. |
| 6 | App Review submissions. Apple typically clears in 1–3 days; Google in 2–7 days for first health submission. |
| 6–7 | DE soft launch. Monitor crash + review complaints. |
| 7–8 | EU rollout. |

Total: **~6–8 weeks** from "no entity, no D-U-N-S" to "live in EU." The D-U-N-S wait + entity registration are the load-bearing parts; everything else fits in parallel.

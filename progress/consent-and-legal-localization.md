# Consent + Legal Localization (English)

Switch the in-app consent flow and the marketing site's legal pages to English in preparation for a global launch. The full GDPR consent stack is kept for everyone (universal-GDPR posture, not region-gated) — only the language changes. The German `Impressum` page stays German because it is a German legal-jurisdiction artefact.

## What changed

**Consent screen (frontend)**
- All four required-row labels and the optional marketing row in `ConsentScreen` translated from German to English ("I accept the Terms of Service…", "I explicitly consent to the processing of my health data…", "I am at least 16 years old.", "I'd like to occasionally receive emails…").
- Inline legal links relabelled "Read Terms" / "Read Privacy Policy" and pointed at the new routes.

**Marketing site (`web/`)**
- `app/agb/` → renamed to `app/terms/`, content translated to an English Terms of Service skeleton (still placeholder where personal/legal data is required). Section numbering kept (§ 1 … § 11). Right-of-withdrawal section kept and clarified as EU-applicable.
- `app/datenschutz/` → renamed to `app/privacy/`, content translated to an English GDPR-style Privacy Policy. Article references unchanged (Art. 6/13/15-21 GDPR, § 25 TTDSG).
- `app/impressum/` left as-is (German § 5 TMG / § 55 RStV — required for German jurisdiction).
- `Footer.tsx` legal-link section reordered & relabelled: Terms of Service · Privacy Policy · Impressum.
- `README.md` updated (route list, project-layout block, pre-launch checklist).

**Cross-cutting glue**
- `frontend/src/constants/legalUrls.ts` — keys renamed `agb` → `terms`, `datenschutz` → `privacy`, paths updated. `impressum` unchanged.
- `frontend/src/screens/SettingsScreen.tsx` — `LEGAL_LINKS` translated to English ("Terms of Service" / "Privacy Policy" / "Impressum"); reordered so Terms+Privacy come first and Impressum (with explanatory hint "per §5 DDG (Germany)") last.

## What did NOT change

- **Backend** — `consent_type` values (`terms`, `privacy`, `health_data`, `age_16_plus`, `marketing`) and version constants are language-neutral. Existing acceptances stay valid; no migration needed.
- **Consent versions** — not bumped. The underlying agreements aren't changing, only their rendered language. If/when legal-content is materially edited (placeholder values filled in by a lawyer), bump `models.TermsVersion` / `PrivacyVersion` etc. on both backend and frontend.
- **Marketing landing copy** — already English.
- **`<html lang>`** — already `"en"` in `app/layout.tsx`.

## Why universal GDPR rather than region-gating

Decided in chat: showing GDPR consents (health-data, age 16+, marketing) to every user globally is over-compliant for non-EU users but removes the failure mode where a German user on a US VPN slips past geo-detection. The UX cost is minimal — three extra checkboxes — and the legal upside is meaningful.

## Pre-launch follow-ups (unchanged from before)

- Replace `<span class="placeholder">[…]</span>` blocks in `terms/`, `privacy/`, `impressum/` with real legal info.
- Have Terms + Privacy reviewed by a lawyer before enabling Stripe checkout.
- When legal text is materially edited, bump `ConsentVersions.terms` / `.privacy` / etc. on both backend and frontend so the (not-yet-built) version-bump re-prompt picks them up.

## Key files

**Frontend**
- `frontend/src/screens/auth/ConsentScreen.tsx`
- `frontend/src/screens/SettingsScreen.tsx`
- `frontend/src/constants/legalUrls.ts`

**Marketing site**
- `web/app/terms/page.tsx` (new — replaces `web/app/agb/`)
- `web/app/privacy/page.tsx` (new — replaces `web/app/datenschutz/`)
- `web/components/Footer.tsx`
- `web/README.md`

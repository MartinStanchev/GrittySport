# Legal Links in Settings

German legal compliance: §5 DDG (Impressum) and GDPR Art. 13 (Datenschutzerklärung) require these to be reachable from inside the app, not only on the marketing website. Settled practice for German mobile apps is two taps max from the main UI.

## What changed

- New "Legal" section at the bottom of `SettingsScreen` (just above Log Out) with three rows:
  - **Impressum** — "Anbieterinformation gemäß §5 DDG"
  - **Datenschutzerklärung** — "Wie wir deine Daten verarbeiten"
  - **AGB** — "Allgemeine Geschäftsbedingungen"
- Each row opens the corresponding page on the marketing site via `Linking.openURL` (system browser). Rows use `open-outline` icon to signal external link, distinct from `chevron-forward` used for in-app navigation.
- Web URLs come from a tiny constants module that reads `EXPO_PUBLIC_WEB_URL` (defaults to `https://grittyfitness.app`), so QA/staging can point to a different domain without code changes.
- Labels intentionally kept in their German legal forms — the law specifies these terms.

## Key files

- `frontend/src/constants/legalUrls.ts` (new) — `LEGAL_URLS = { impressum, datenschutz, agb }`, base URL from `EXPO_PUBLIC_WEB_URL` with trailing-slash strip and `https://grittyfitness.app` fallback.
- `frontend/src/screens/SettingsScreen.tsx` — added `Linking` import, module-level `LEGAL_LINKS` array (url + label + hint), `openLegalUrl` helper with `Alert` fallback on failure, and a new `KineticPanel` "Legal" section rendered above the Log Out button.
- Web pages already exist at `web/app/{impressum,datenschutz,agb}/page.tsx`.

## Notes

- App Store / Play Store privacy policy URL fields still need to be set to `https://grittyfitness.app/datenschutz` at submission time.
- Datenschutzerklärung should also be linked from the signup flow (GDPR Art. 13 timing — informed before processing); not done here, scope was Settings.

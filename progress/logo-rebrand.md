# Logo Rebrand — new mark + wordmark everywhere

Replaced the old "G" gradient placeholder branding with the new Gritty Fitness logo (teal ring + purple→teal sprinter figure) across the mobile app, marketing website, app icons, and favicons.

## Source files
- `newlogo-v3.png` (1024×1024) — mark only
- `newlogo-withtext-v2.png` (1024×1024) — mark + "GRITTY FITNESS" wordmark

Both arrived with a **solid white background** (alpha 255 everywhere), so the white was keyed out to transparency (min-channel threshold 220–250 to preserve anti-aliased colored edges), then auto-cropped to content.

## Decisions (confirmed with user)
- **One gradient logo for both light & dark themes** — the mid-toned gradient reads well on both; no separate white/mono color variant needed. Verified with a preview grid against real theme backgrounds (`#FFFFFF`, `#F5F3FF`, `#12121d`, `#1f1e2a`).
- **App icon background: white** — mark on a white tile (iOS + Android adaptive).

## Frontend (Expo) — `frontend/`
- `assets/icon.png` — iOS app icon, mark on white, 1024², opaque (RGB)
- `assets/adaptive-icon.png` — Android adaptive foreground, mark @60% (safe zone), transparent, 1024²
- `assets/splash-icon.png` — splash, **wordmark** logo @72%, transparent, 1024²
- `assets/favicon.png` — Expo-web favicon, mark on white, 256²
- `assets/notification-icon.png` — Android notif icon, **white silhouette** (alpha-only) on transparent, 256²
- `app.json`:
  - `android.adaptiveIcon.backgroundColor` `#7C5CFC` → `#FFFFFF`
  - `expo-notifications` plugin `color` `#1a1a2e` → `#7C5CFC` (brand accent)
- `android/` native resources (gitignored prebuild output, regenerated so the local build matches; EAS/`expo prebuild` regenerates from `app.json` anyway):
  - `mipmap-*/ic_launcher.webp`, `ic_launcher_round.webp` (mark @60% on white, 48–192px)
  - `mipmap-*/ic_launcher_foreground.webp` (mark @60%, 108–432px)
  - `drawable-*/notification_icon.png` (white silhouette, 24–96px)
  - `values/colors.xml`: `iconBackground` `#7C5CFC`→`#FFFFFF`, `notification_icon_color` `#1a1a2e`→`#7C5CFC`

## Marketing site — `web/`
- `public/logo-mark.png` — header/footer/JSON-LD wordmark, transparent (new aspect 901/351)
- `public/logo-icon.png` — square mark, transparent (used by OG image)
- `components/Logo.tsx` — `ASPECT` `1280/567` → `901/351`
- `app/icon.png` (new) — static favicon, mark on white 512² — **replaces** the deleted `app/icon.tsx` (was a generated gradient "G")
- `app/apple-icon.png` (new) — apple-touch-icon, mark on white 180²
- `app/favicon.ico`, `app/favicon-G.ico` — regenerated multi-size ICO (16–256) from mark on white, **RGBA** (Next/Turbopack ICO decoder rejects RGB-embedded PNGs)
- `app/opengraph-image.tsx` — swapped the "G" gradient box for the real mark, loaded via `readFile('public/logo-icon.png','base64')` → data URI `<img>` (Next 16 documented pattern for local images in `next/og`)

## Verification
- `npm run build` (web) passes; `/icon.png`, `/apple-icon.png`, `/opengraph-image` generate at build time
- `npm run lint` (web) clean (0 errors)
- Visual previews confirmed for: light/dark logo legibility, iOS/Android/favicon/notification frontend icons, OG card, native Android adaptive/legacy/notification

## Notes / follow-ups
- Native iOS icons: this is a managed/prebuild workflow with no committed `frontend/ios/` — EAS build regenerates iOS icons from `app.json`. A new native build is required for app-icon changes to appear on device.

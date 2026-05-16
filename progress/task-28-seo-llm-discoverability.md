# Task 28 — LLM/SEO Discoverability for the Marketing Site

## Goal
Make `web/` discoverable to traditional search engines (Google/Bing) and to LLM-powered answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews) by adding the four signals that drive citation: a machine-readable site index (`llms.txt`), explicit crawler allowlists, structured data (JSON-LD), and per-page metadata.

## Decisions made up front
- **Entity placeholders kept as-is.** Organization JSON-LD on `/` and Person JSON-LD on `/about` ship with `[Provider]`, `[Address]`, `[Founder Name]` placeholders — to be filled when the legal entity decision (`LAUNCH_CHECKLIST.md §0`) lands. Trade-off: structure is in place, content needs a follow-up pass before the site goes public.
- **CCBot (Common Crawl) allowed.** Marketing-site default; helps long-term LLM training-time citations.
- **OG image + icon generated programmatically** via `next/og` `ImageResponse` (`app/opengraph-image.tsx`, `app/icon.tsx`) instead of static PNGs — avoids needing image tooling and stays sharp on retina.
- **Specific schema subtypes** for legal pages: `PrivacyPolicy`, `TermsOfService`, `WebPage` (Impressum, German), `AboutPage` (with embedded `Person`).

## What shipped
- `web/public/llms.txt` — llmstxt.org-format index with product/legal sections and `#how`/`#features`/`#premium`/`#faq` anchors.
- `web/app/robots.ts` — explicit allow for `*`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`. Includes `Sitemap` and `Host` directives.
- `web/app/sitemap.ts` — `/`, `/about`, `/privacy`, `/terms`, `/impressum`.
- `web/app/opengraph-image.tsx` — 1200×630 PNG generated at build time, brand gradient, sport list, alt text.
- `web/app/icon.tsx` — 32×32 PNG generated at build time, brand gradient with `G` mark.
- `web/components/JsonLd.tsx` — tiny shared helper for `<script type="application/ld+json">` with the XSS-mitigation `<` → `<` replace from the Next 16 docs.
- `web/components/sections/faq-data.ts` — extracted `faqEntries` so `FAQ.tsx` UI and the home-page `FAQPage` JSON-LD read from a single source.
- `web/app/page.tsx` — emits `SoftwareApplication` (with Free/Monthly/Yearly offers), `Organization`, and `FAQPage` JSON-LD.
- `web/app/privacy/page.tsx` — `PrivacyPolicy` JSON-LD + tightened SEO description + canonical + OG.
- `web/app/terms/page.tsx` — `TermsOfService` JSON-LD + tightened description + canonical + OG.
- `web/app/impressum/page.tsx` — `WebPage` JSON-LD + `openGraph.locale: 'de_DE'` + `inLanguage: 'de'`.
- `web/app/about/page.tsx` — new page with founder bio scaffold, `AboutPage` + `Person` JSON-LD, contact email.
- `web/components/Footer.tsx` — `About` link added to the Product column.

## Static-export gotcha encountered
Next 16 with `output: "export"` requires `export const dynamic = "force-static"` on `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, and `icon.tsx` — otherwise build fails with `export const dynamic = "force-static"/export const revalidate not configured on route ... with "output: export"`. Added to all four.

## Verification
- `npx eslint .` — clean.
- `npm run build` — green; all 10 routes prerender as `○ (Static)`.
- Spot-checks on `out/`:
  - `out/robots.txt` lists all bots.
  - `out/sitemap.xml` lists 5 URLs.
  - `out/llms.txt` matches spec.
  - `out/opengraph-image` — `PNG image data, 1200 x 630`.
  - `out/icon` — `PNG image data, 32 x 32`.
  - `out/index.html` contains `<script type="application/ld+json">` with `SoftwareApplication` + `Organization` + `FAQPage` array.
  - `out/privacy.html`, `out/terms.html`, `out/about.html` each contain the right schema.

## Known caveats (for post-deploy)
- **Generated OG/icon filenames are extensionless on disk** (`out/opengraph-image`, `out/icon`). Modern static hosts (Vercel, Netlify, Cloudflare Pages, DigitalOcean App Platform) serve these fine since they sniff content type. If serving via raw Nginx, configure `default_type image/png` or add a rewrite. Worth confirming once the deploy target is set.
- **Placeholders** in Organization (`legalName`, address fields) and Person (`name`, bio) JSON-LD must be filled before public launch — Google may flag incomplete entity data. Tracked against `LAUNCH_CHECKLIST.md §0`.
- **JSON-LD validation** via Google's Rich Results Test and validator.schema.org still requires a deployed URL; runnable once the site is up at `grittyfitness.app`.
- **Domain assumption.** Every URL hardcodes `https://grittyfitness.app`. A single find-replace handles a domain change.

## Out of scope
- `/learn/*` long-form content + `Article` JSON-LD (task-30).
- Analytics / Plausible (separate launch-checklist decision).
- Filling Organization / Person placeholders (blocked on legal entity decision).

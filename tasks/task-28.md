## Feature 28: LLM/SEO Discoverability for the Marketing Site

### Goal
Make `web/` discoverable both by traditional search engines (Google/Bing) and by LLM-powered answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews). The site currently renders as static HTML with a single `<title>`/`<description>` and zero structured data. We're adding the four signals that determine whether a page gets cited in an LLM answer: a machine-readable site index (`llms.txt`), explicit crawler allowlists, structured data (JSON-LD), and per-page metadata.

### Why this approach
- LLMs cite pages with high info density, clear authorship/expertise (E-E-A-T), and machine-readable structure. Adding JSON-LD is the single highest-leverage change.
- `llms.txt` is the emerging standard for letting LLMs ingest a site efficiently — Anthropic, Mintlify, Cloudflare, and others ship one. Cost to add: ~30 lines of markdown.
- The marketing site already has clean static prerendering (per `progress/marketing-website.md`) — these additions don't introduce JS or runtime cost.
- Google's FAQ schema unlocks FAQ-rich snippets in SERPs; our FAQ section already exists in `web/components/sections/FAQ.tsx` — we just need to declare it as schema.

### Constraint reminder
`web/AGENTS.md` says: *"This is NOT the Next.js you know."* Before writing any new route, sitemap, or metadata API, read the relevant guide in `web/node_modules/next/dist/docs/`. Specifically check the current shape of `app/sitemap.ts`, `app/robots.ts`, `app/[route]/page.tsx` metadata exports, and the JSON-LD pattern.

### Out of scope for v1
- Long-form content pages (`/learn/*`) — those land in [task-30](task-30.md) (content pipeline). Once posts exist, they need their own `Article` JSON-LD added, but the page template work happens there.
- Real OpenGraph images — `app/opengraph-image.png` is already a known gap in the launch checklist; not duplicating here, but verify it exists before shipping this task.
- Analytics / Plausible — separate decision per the launch checklist.

---

### Task 28.1: `llms.txt` — machine-readable site index

**`web/app/llms.txt/route.ts`** (or `web/public/llms.txt` — confirm which approach Next 16 prefers for static text routes from the docs).

Format follows the [llmstxt.org](https://llmstxt.org) spec:

```
# Gritty Fitness

> Gritty is an AI-powered fitness coaching app that builds and adapts a holistic, multi-sport training plan around each user — running, cycling, swimming, strength, mobility, and recovery. Workouts are imported from Apple Health, Health Connect, and file formats (GPX, TCX, FIT, CSV) or recorded in-app via GPS. After every session the AI coach, "Grit", reviews performance and adjusts upcoming workouts.

## Product
- [Landing page](https://grittyfitness.app/): What Gritty does and how it works
- [Pricing & Premium](https://grittyfitness.app/#premium): Free and Premium feature comparison
- [FAQ](https://grittyfitness.app/#faq): Common questions

## Legal
- [Privacy Policy](https://grittyfitness.app/privacy)
- [Terms of Service](https://grittyfitness.app/terms)
- [Impressum (DE)](https://grittyfitness.app/impressum)

## Optional
- [Learn — training science articles](https://grittyfitness.app/learn): Long-form articles on programming, recovery, periodization (populated by task-30)
```

Update the URLs once the production domain is finalized. The `Optional` block can be omitted until task-30 ships content.

---

### Task 28.2: Crawler allowlist — `robots.txt`

**`web/app/robots.ts`** (Next 16 App Router convention — read `node_modules/next/dist/docs/` to confirm signature).

```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      // Explicitly allow LLM crawlers — some sites block them by default.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
    ],
    sitemap: 'https://grittyfitness.app/sitemap.xml',
  };
}
```

**Decision flag:** confirm with the user whether `CCBot` (Common Crawl) should be allowed — some businesses block it to prevent dataset inclusion. For a marketing site, allow is the default.

---

### Task 28.3: Sitemap — `sitemap.xml`

**`web/app/sitemap.ts`**:

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://grittyfitness.app';
  return [
    { url: base, lastModified: new Date(), priority: 1.0, changeFrequency: 'monthly' },
    { url: `${base}/privacy`, lastModified: new Date(), priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/terms`,   lastModified: new Date(), priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/impressum`, lastModified: new Date(), priority: 0.3, changeFrequency: 'yearly' },
    // Add /learn/* entries once task-30 ships
  ];
}
```

---

### Task 28.4: JSON-LD structured data

JSON-LD is added inline in the page's `<head>` via a `<script type="application/ld+json">` tag. In Next 16 App Router, the idiomatic pattern is to render it directly in the page component — read `node_modules/next/dist/docs/` for the current best practice.

**`web/app/page.tsx`** (landing) — emit three schema objects:

1. **`SoftwareApplication`** — describes the app itself:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "SoftwareApplication",
     "name": "Gritty Fitness",
     "operatingSystem": "iOS, Android",
     "applicationCategory": "HealthApplication",
     "offers": [
       { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "name": "Free" },
       { "@type": "Offer", "price": "7.99", "priceCurrency": "EUR", "name": "Premium (monthly)" }
     ],
     "description": "AI-powered, multi-sport training plans that adapt to every workout you log."
   }
   ```

2. **`Organization`** — entity behind the app. Fields depend on the legal entity decision (per `LAUNCH_CHECKLIST.md §0`); reuse the same address that goes in the Impressum.

3. **`FAQPage`** — generated from the entries already in `web/components/sections/FAQ.tsx`. Refactor the FAQ data into a shared module (e.g. `web/components/sections/faq-data.ts`) so the component renders the UI *and* the JSON-LD reads from the same source:

   ```ts
   export const faqEntries = [
     { question: '...', answer: '...' },
     ...
   ];
   ```

   Then on the landing page, generate the schema from `faqEntries.map(...)`.

**`web/app/privacy/page.tsx`**, **`web/app/terms/page.tsx`**, **`web/app/impressum/page.tsx`** — emit a minimal `WebPage` schema with `name`, `description`, `inLanguage` (`en` or `de`), `isPartOf` pointing at the site.

---

### Task 28.5: Per-page metadata

Currently only `web/app/layout.tsx` exports `metadata`. Add page-level `export const metadata: Metadata = {...}` to:

- `web/app/privacy/page.tsx` — title `"Privacy Policy — Gritty Fitness"`, description `"How Gritty collects, stores, and protects your workout and health data."`, `openGraph.type: 'website'`.
- `web/app/terms/page.tsx` — title `"Terms of Service — Gritty Fitness"`, equivalent description.
- `web/app/impressum/page.tsx` — title `"Impressum — Gritty Fitness"`, `openGraph.locale: 'de_DE'`.

Each should override the title, not append to it, unless `layout.tsx` already sets `title.template`. Read the Next 16 metadata docs to confirm current behavior.

---

### Task 28.6: Author / About page for E-E-A-T

LLMs and Google weight pages that have clear authorship and expertise signals. Add:

**`web/app/about/page.tsx`** — short founder bio page. Include:
- Founder name + photo (or initials placeholder).
- One-paragraph bio focused on relevant expertise (training background, why building this).
- Contact email (same as Impressum).
- `Person` JSON-LD with `name`, `jobTitle`, `worksFor` linking to the Organization.

This page becomes the canonical author reference linked from every `/learn/*` post in task-30.

Add an "About" link to `web/components/Footer.tsx` under the Product column.

---

### Task 28.7: Verify OG image + favicon

The launch checklist already flags `app/opengraph-image.png` and `app/icon.png` as todo. Confirm both exist before shipping this task — without an OG image, social shares (and LLM citation cards) render with no preview. If missing, create placeholders using the Gritty logo on the Aura Kinetic gradient background.

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `web/app/llms.txt/route.ts` (or `web/public/llms.txt`) | Create — machine-readable site index |
| `web/app/robots.ts` | Create — explicit crawler allowlist |
| `web/app/sitemap.ts` | Create — sitemap generator |
| `web/app/page.tsx` | Modify — emit `SoftwareApplication`, `Organization`, `FAQPage` JSON-LD |
| `web/app/privacy/page.tsx` | Modify — add `metadata` export + `WebPage` JSON-LD |
| `web/app/terms/page.tsx` | Modify — add `metadata` export + `WebPage` JSON-LD |
| `web/app/impressum/page.tsx` | Modify — add `metadata` export + `WebPage` JSON-LD |
| `web/app/about/page.tsx` | Create — founder bio + `Person` JSON-LD |
| `web/components/sections/FAQ.tsx` | Modify — extract `faqEntries` to a shared data module |
| `web/components/sections/faq-data.ts` | Create — single source of truth for FAQ Q&A |
| `web/components/Footer.tsx` | Modify — add "About" link |
| `web/app/opengraph-image.png` | Create if missing |
| `web/app/icon.png` | Create if missing |

---

### How to Test

1. **`llms.txt` reachable:** `curl https://grittyfitness.app/llms.txt` returns the markdown index, content-type `text/markdown` (or `text/plain` — both are acceptable per the spec).
2. **`robots.txt` valid:** `curl /robots.txt` returns plaintext with all listed agents allowed; verify in [Google's robots.txt tester](https://support.google.com/webmasters/answer/6062598).
3. **Sitemap valid:** `curl /sitemap.xml` returns valid XML; paste into [XML Sitemaps Validator](https://www.xml-sitemaps.com/validate-xml-sitemap.html).
4. **JSON-LD valid:** Use Google's [Rich Results Test](https://search.google.com/test/rich-results) on `/`, `/privacy`, `/about`. Confirm `SoftwareApplication`, `Organization`, `FAQPage`, `WebPage`, `Person` are all detected with zero errors.
5. **FAQ schema renders rich snippets:** after deploy, request Search Console → URL Inspection → Live Test; confirm FAQ-eligible snippet.
6. **Metadata per page:** view-source on each page; confirm `<title>` and `<meta description>` are page-specific, not the layout default.
7. **LLM ingestion smoke test:** ask Claude/ChatGPT "What is Gritty Fitness?" after the site has been crawled (allow ~1 week post-deploy). Refine the `llms.txt` summary if the answer is vague.
8. **Build still green:** `npm run build` from `web/`; all routes still prerender as static.
9. **Lint:** `npx eslint .` from `web/` — clean.

---

### Open Questions

- **Domain:** confirm `grittyfitness.app` is the final domain. Every URL in this task references it; if it changes, do a single find-replace pass.
- **CCBot (Common Crawl):** allow or disallow? Allowing means dataset inclusion (helps LLM training-time citations); disallowing limits exposure.
- **About page founder photo:** real photo, illustrated avatar, or initials? Affects E-E-A-T weight slightly (real photo > illustration > initials), but not blocking.
- **Schema for legal pages — `WebPage` or `PrivacyPolicy`?** Schema.org has `PrivacyPolicy` and `TermsOfService` as `WebPage` subtypes; using the specific subtype is mildly stronger signal.

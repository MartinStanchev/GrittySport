# SEO / LLM-SEO Content Expansion (Tier 2 + Tier 3)

## Goal
Follow-on to [task-28-seo-llm-discoverability](task-28-seo-llm-discoverability.md). The technical SEO plumbing (robots, sitemap, llms.txt, JSON-LD, OG) was already solid; the gap was **content**. The site ranked on brand, not intent: titles/H1s were taglines, `/learn` was an empty placeholder, and nothing targeted non-branded "basic feature" queries ("AI running coach app", "AI personal trainer", "import Garmin into one app"). This pass adds intent-targeted content depth (Tier 2) and richer answer-engine signals (Tier 3). The user is handling Tier 1 on-page title/H1 rewrites manually.

## What shipped

### Tier 3 — LLM SEO / GEO
- `web/public/llms-full.txt` — new, fact-rich reference (what it is, who for, coaching loop, Grit's tools, supported sports, devices/imports, platforms, full pricing + free-tier limits, data/privacy, common Qs, key pages). Declarative facts answer engines can cite.
- `web/public/llms.txt` — enriched intro, pointer to `llms-full.txt`, plus links to the new landing pages and learn articles.

### Tier 2a — Use-case landing pages (commercial intent)
- `web/components/UseCaseLanding.tsx` — new shared presentational component: gradient hero + CTA, intro prose, "How Grit coaches X" grid, optional `AppShot` row, highlights grid, FAQ, closing CTA. Data-driven via `UseCaseData`.
- `web/lib/seo.ts` — new. Exports canonical `SITE_URL` + `buildUseCaseJsonLd()` (SoftwareApplication w/ Free/Monthly/Yearly offers + BreadcrumbList + FAQPage).
- `web/app/ai-running-coach/page.tsx` — "AI running coach app", benchmark paces, strength/mobility built in, race periodization.
- `web/app/ai-strength-coach/page.tsx` — "AI personal trainer" angle, loads from 1RM, RPE-driven progression, deloads.
- `web/app/ai-triathlon-coach/page.tsx` — one plan across swim/bike/run + strength, FTP/CSS/threshold pace, whole-week balance.
- Each page has unique title/H1/lede/coaching points/highlights/FAQ (not templated doorway content) + its own JSON-LD. Screenshots reuse `public/app_screenshots/*-light.png`.

### Tier 2b — `/learn` articles (informational intent)
- `web/content/learn/how-ai-fitness-coaching-works.md` — definitional, the intake→plan→log→review→adapt loop; FAQ frontmatter for schema.
- `web/content/learn/training-for-two-sports.md` — concurrent training / multi-sport USP.
- `web/content/learn/combine-garmin-apple-health-strava.md` — consolidating workout data (Apple Health / Health Connect hubs + file imports + de-dup).
- Deleted `web/content/learn/welcome.md` — thin "this is the seed post" placeholder; leaving it published worked against the SEO goal now that real posts exist.

### Tier 2c — `/examples`
- `web/app/examples/page.tsx` — replaced all TODO placeholders with real intros + "what Grit did" bullets for 6 examples; attached real screenshots (program-review / edit-proposal / post-workout-review light) to the first three; removed the `.placeholder` highlight spans and dead `TODO`-stripping `.replace()` in the JSON-LD.

### Wiring
- `web/app/sitemap.ts` — added the 3 landing pages (priority 0.8). Learn articles auto-included via `getPublishedPosts`.
- `web/components/Footer.tsx` — new "Coaching" column (3 landing pages); grid widened `md:grid-cols-5` → `md:grid-cols-6`.
- Internal cross-links: articles link to each other + landing pages + `/how-it-works`; landing pages link to `/how-it-works`.

### Positioning — "you stay in control" (follow-on)
Elevated a core selling point the site under-played: the user directs their own program (sick / vacation / change load → just ask, Grit does the rework and the user approves), guidance is on-demand, and everything is tracked in one place.
- All 3 landing pages: a "You stay in control" coaching point (sport-tailored) + a guidance/tracking sentence in the intro prose.
- `web/components/sections/HowItWorks.tsx` — reframed the "And when life happens" block to "Your plan, your call" with user-initiated scenarios (vacation, cold, push harder, busy week) + a closing line on control/approval/tracking.
- `web/components/sections/Features.tsx` — sharpened the "Chat with Grit" card to lead with on-demand control + guidance.
- `web/components/sections/faq-data.ts` — new FAQ "Can I change my plan whenever I want?" (also feeds the homepage FAQPage JSON-LD).
- `web/public/llms-full.txt` — new "You stay in control" section (user-directed changes, proposal-only, guidance on demand, full tracking).

## Content architecture decision
- **Landing pages = commercial intent** ("[sport] coach"), **articles = informational intent** ("how to…"). The import use case is an article, not a landing page, because the query is a how-to. Kept the set small (3 + 3) and hand-written to avoid thin/doorway-page penalties.

## Validation
- `npx eslint .` — clean (exit 0).
- `npm run build` — green; 21 static pages. New routes prerender `○ (Static)`: `/ai-running-coach`, `/ai-strength-coach`, `/ai-triathlon-coach`; `/learn/[slug]` SSG'd all 3 articles; `welcome` gone.
- Spot-checks on `out/`: `sitemap.xml` lists all 14 URLs incl. landing pages + articles; `llms-full.txt` present; `ai-running-coach/index.html` carries SoftwareApplication + Organization + BreadcrumbList + FAQPage JSON-LD and the correct H1.

## Deliberately not done (scope)
- Tier 1 on-page title/H1 rewrites + hero typo fix (`Hero.tsx:25` "wthat") — user is doing these manually.
- Did **not** refactor the 5 pre-existing pages' inline `const SITE_URL` to import from `lib/seo` — those files have unrelated uncommitted edits; avoided tangling. New code uses the shared export.
- Org/Person JSON-LD placeholders (`[Provider]`, founder) still blocked on legal-entity decision (carried over from task-28).
- Off-site GEO (Reddit/Product Hunt/reviews) — off-platform, biggest citation lever, not a code change.

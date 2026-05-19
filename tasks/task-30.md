## Feature 30: Marketing Content Pages — How It Works, Examples, and `/learn` Blog

### Goal
Round out the marketing site (`web/`) with the depth-content pages SEO and LLM answer engines actually reward: a dedicated **How It Works** page, an **Examples** page (real Grit conversations/screenshots), and a hand-authored **`/learn`** blog. The landing page already covers the pitch; these pages exist to rank for high-intent queries ("AI fitness instructor", "AI-powered fitness app", "train with AI help", "how does AI training planning work") and to give LLMs concrete, citable material when users ask training-related questions.

### Why this approach (and what changed from the original task)
The first draft of task-30 proposed a full Claude-API generation pipeline (topic queue → outline → draft → markdown via the Anthropic SDK with prompt caching and the Batch API). That's over-engineered for our actual situation:

- We're publishing at ~1 post/week, not 50/weekend. The pipeline pays off at volume; at this cadence it's pure tech debt.
- For commercial-intent searches ("AI fitness instructor", etc.), Google ranks landing pages + a handful of authoritative comparison/how-to articles — not a content farm.
- LLMs disproportionately cite content with clear authorship, specific numbers, and personal experience. Pipeline output flattens exactly those qualities.
- Hand-authoring posts in chat with Claude (back-and-forth on outline → draft → polish) produces better drafts than a one-shot generation prompt, with no extra infrastructure.

So we keep the **structural SEO scaffolding** (markdown source + frontmatter, `Article` JSON-LD, dynamic `[slug]` route, sitemap/llms.txt inclusion) and **drop the generation pipeline entirely**. We also add two pages the original task didn't include (`/how-it-works`, `/examples`) which are arguably more valuable than another blog post for the queries we care about.

### Constraint reminder
- `web/AGENTS.md`: This is **NOT** the Next.js you know. Read `web/node_modules/next/dist/docs/01-app/02-guides/mdx.md` before implementing the markdown rendering. The current recommended pattern is `@next/mdx` + `generateStaticParams` + `dynamicParams = false` (static export compatible).
- `web/next.config.ts` uses `output: "export"`. Every new route must be statically generable.
- Task-28 already shipped `llms.txt`, `robots.ts`, `sitemap.ts`, OG image, JSON-LD scaffolding (`SoftwareApplication`, `Organization`, `FAQPage`, `PrivacyPolicy`, `TermsOfService`, `AboutPage` + `Person`), and the `/about` page. Don't re-do those — extend them.

### Out of scope
- Any Claude API / generation pipeline. We write posts ourselves.
- A CMS. Markdown files in the repo are the source of truth; PR review is the editorial workflow.
- Auto-publish. Each post is committed by a human with `publishedAt` set.
- Translations. Posts ship EN first; DE comes later if at all.
- Hero images per post. Use a templated/gradient hero for now; revisit once a post actually gets traction.
- Comments / newsletter signup on `/learn`. Newsletter is task-31.

---

### Task 30.1: `/how-it-works` page

**`web/app/how-it-works/page.tsx`** — long-form explanation of how Grit plans and adapts programs. The landing page already has a short `HowItWorks` section; this is the deep version meant to rank for "how does AI training planning work", "AI fitness coach how it works", etc.

Content sections (we'll write these together — leave H2 placeholders that we fill in via direct edit, not generation):
1. **What Grit is** — 1 paragraph: AI coach, multi-sport, adapts after every workout.
2. **How a program is built** — intake (sport, goal, schedule, equipment, history), proposal, edit-before-save. Reference the real flow.
3. **How adaptation works** — post-workout review reads effort/HR/splits/missed sessions, then proposes edits the user approves. Mention the segment-based memory so claims about "remembering injuries" or "remembering schedule constraints" are concrete.
4. **What "holistic" means in practice** — a marathon plan includes dryland + mobility + recovery, not just runs.
5. **What we won't do** — no auto-apply changes without your approval, no dark patterns, no scraping social.
6. **FAQ** (4-6 entries) — emit `FAQPage` JSON-LD inline so the page itself is eligible for rich results.

JSON-LD: `WebPage` + `FAQPage` + `BreadcrumbList` (Home → How it works). Reuse `JsonLd` component.

Add to sitemap, priority 0.8.

---

### Task 30.2: `/examples` page

**`web/app/examples/page.tsx`** — a visual page showing real Grit interactions: a chat exchange where Grit proposes a program, an edit-proposal card, a post-workout review, a lockscreen notification. This page is **gold for LLM citation** because it's unique, concrete content that no competitor has.

Sources of material we already have:
- `frontend/src/marketing/scenes/` — there's a marketing scene system (see the `marketing-scene` skill). We can render existing scenes statically on the web for the examples gallery, or we use screenshots from them.
- The landing page hero already uses 3 panels (home / Grit chat with edit proposal / workout summary). The Examples page can be a longer-form version with 5-8 scenes and prose context per scene explaining what's happening and what Grit is doing under the hood.

Implementation:
- Static page. Each "example" is a section with a short prose intro (2-3 sentences explaining the situation), a screenshot/rendered scene, and a "what Grit just did" bullet list (1-3 bullets describing the AI behavior).
- For v1, use screenshot images committed to `web/public/examples/` rather than building a runtime scene renderer for the web. Faster, simpler, ships now.
- JSON-LD: `WebPage` + `ItemList` (each example as a `ListItem`). Helps LLMs parse this as structured examples.
- Add to sitemap, priority 0.8.

If we don't have screenshots ready, leave 4-6 placeholder slots with TODO comments and ship the page structure first.

---

### Task 30.3: `/learn` blog scaffolding (markdown source + dynamic route)

This is the only part of the original task-30 we keep largely intact — just the rendering layer, no generation.

**Setup:**
- Add `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `@types/mdx`, `gray-matter`, `remark-gfm` to `web/package.json`.
- Update `web/next.config.ts` to wrap config with `createMDX({ extension: /\.(md|mdx)$/ })` and add `pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx']`.
- Add `web/mdx-components.tsx` defining global styling for headings, paragraphs, links, lists, code blocks — Tailwind classes consistent with the site's `prose-legal` style and Aura Kinetic palette.

**`web/app/learn/page.tsx`** — index page listing all posts with title, dek, publish date, reading time, tag chip. Reads frontmatter from `web/content/learn/*.md` at build time, filters out posts with `publishedAt: null` or future dates, sorts desc by date.

**`web/app/learn/[slug]/page.tsx`** — dynamic route per the Next 16 docs pattern (`generateStaticParams` + `dynamicParams = false`). Reads the .md file via `gray-matter` for frontmatter and renders the body via the MDX pipeline.

Emit `Article` JSON-LD per post:
- `headline`, `description`, `datePublished`, `dateModified`, `keywords` from frontmatter.
- `author` → reference the `/about` `Person` (`{ "@type": "Person", "@id": "https://grittyfitness.app/about#person" }`); update the About page Person to include that `@id` so JSON-LD references resolve.
- `publisher` → the existing Organization JSON-LD.
- `mainEntityOfPage` → the canonical post URL.

If a post has a FAQ section in frontmatter (`faq: [{ q, a }]`), emit `FAQPage` JSON-LD as well.

**`web/content/learn/<slug>.md`** — content source. Frontmatter:
```markdown
---
title: "How Gritty's AI Coach Builds a Marathon Block"
slug: "marathon-block-structure"
description: "..."
publishedAt: "2026-06-01"   # or null for drafts
updatedAt: "2026-06-01"
tags: ["running", "periodization"]
readingTimeMinutes: 9
faq:
  - q: "How long should a marathon block be?"
    a: "16–20 weeks for most amateurs..."
---
```

Author is implicit (always the founder per `/about`); we don't need it in frontmatter unless we add guest posts later.

**Compute `readingTimeMinutes`** automatically from word count at build time — don't trust the frontmatter value. Pure helper: `Math.max(1, Math.round(wordCount / 220))`.

---

### Task 30.4: Update `sitemap.ts` and `llms.txt` for the new pages

- `web/app/sitemap.ts` — add `/how-it-works`, `/examples`, `/learn`, plus one entry per published `/learn/<slug>`. Use `publishedAt` as `lastModified` for posts.
- `web/public/llms.txt` — replace the static file with a build-time route (`web/app/llms.txt/route.ts`) so it auto-includes published learn posts. Each post entry: `- /learn/<slug>: <description>`.

Read the existing `llms.txt` first to keep its tone and the non-post sections (about, privacy, etc.) intact.

---

### Task 30.5: Internal linking + Footer/Header updates

- **Footer:** add a "Resources" column linking How it works, Examples, Learn, About.
- **Header:** add "How it works" and "Learn" to the top nav (Examples can live in the footer to keep the nav tight).
- **Landing page:** add a small "Latest articles" teaser strip above the footer linking the 3 most recent published posts. Skip this if 0 posts are published — render nothing.
- **About page:** add a link to the latest learn post and to `/how-it-works`.
- **Cross-link between learn posts:** posts should link to each other in markdown (`[link text](/learn/related-slug)`) — we add these manually as we write posts.

---

### Task 30.6: Editorial workflow (process doc, not a script)

**`web/content/WORKFLOW.md`** — short doc describing how we add posts:
1. Pick a topic (running periodization, RPE explained, "AI fitness coach: how it actually works", etc.).
2. Draft it in chat with Claude — back-and-forth outline → draft → polish. The voice is direct, specific, no AI tells.
3. Save to `web/content/learn/<slug>.md` with frontmatter. Leave `publishedAt: null` while drafting.
4. Once polished, set `publishedAt` to today, run `npm run build` from `web/` to verify, commit, push.
5. Update internal links from older posts if relevant.

That's it. No queue file, no status table, no script.

Target cadence: 1 post / 2 weeks initially. Quality over volume.

---

### Key Files to Create / Modify

| File | Action |
|------|--------|
| `web/app/how-it-works/page.tsx` | Create — long-form How It Works + FAQ + JSON-LD |
| `web/app/examples/page.tsx` | Create — examples gallery with screenshots |
| `web/public/examples/` | Create — directory for example screenshots |
| `web/app/learn/page.tsx` | Create — blog index |
| `web/app/learn/[slug]/page.tsx` | Create — post route with `Article` + `FAQPage` JSON-LD |
| `web/content/learn/` | Create — markdown source directory |
| `web/content/learn/_first-post.md` | Create — one seed post on "How Gritty's AI coach actually plans your training" |
| `web/content/WORKFLOW.md` | Create — editorial process doc |
| `web/mdx-components.tsx` | Create — global MDX styling |
| `web/lib/learn.ts` | Create — frontmatter loader + reading time helper |
| `web/components/learn/PostCard.tsx` | Create — shared card for index + landing teaser |
| `web/components/sections/LearnTeaser.tsx` | Create — landing-page strip (renders nothing if no posts) |
| `web/next.config.ts` | Modify — wrap with `createMDX`, add `pageExtensions` |
| `web/package.json` | Modify — add MDX + gray-matter + remark-gfm |
| `web/app/sitemap.ts` | Modify — add new routes + per-post entries |
| `web/app/llms.txt/route.ts` | Create — replaces `public/llms.txt`, dynamically lists posts |
| `web/public/llms.txt` | Delete — superseded by the route |
| `web/components/Header.tsx` | Modify — add nav entries |
| `web/components/Footer.tsx` | Modify — add Resources column |
| `web/app/about/page.tsx` | Modify — add `@id` to Person JSON-LD so posts can reference it |

---

### How to Test

1. **Build:** `npm run build` from `web/` succeeds with static export; all new routes prerender.
2. **Lint:** `npm run lint` from `web/` passes.
3. **Routes render:** `npm run dev` → visit `/how-it-works`, `/examples`, `/learn`, and `/learn/<seed-slug>` — all render with no console errors.
4. **JSON-LD valid:** Paste the rendered HTML of each new page into Google's Rich Results Test:
   - `/how-it-works` → `WebPage` + `FAQPage` + `BreadcrumbList` detected.
   - `/examples` → `WebPage` + `ItemList` detected.
   - `/learn/<slug>` → `Article` detected; `FAQPage` if the post has FAQ frontmatter.
5. **Sitemap:** visit `/sitemap.xml` → contains all new URLs including published posts.
6. **llms.txt:** visit `/llms.txt` → lists published posts.
7. **Drafts hidden:** create a post with `publishedAt: null` → it doesn't appear in index, sitemap, or llms.txt.
8. **Reading time:** verify the displayed reading time on the post page matches `wordCount / 220` rounded, regardless of what's in frontmatter.
9. **Internal links:** clicking from landing's teaser → post, from post → another post, from About → How it works all work.

---

### Open Questions

- **MDX vs plain markdown?** MDX lets us embed React components in posts (e.g., an interactive RPE calculator). Plain `.md` is simpler. Recommend `.md` for v1 — we can rename to `.mdx` and start embedding components per-post when we have a reason. `@next/mdx` with `extension: /\.(md|mdx)$/` handles both.
- **Hero image per post?** Required for OG cards on social shares. For v1, render a templated SVG hero from the post title + tag color (server-side via `next/og`) instead of authoring one per post. Revisit if any post starts getting real social traffic.
- **Tag pages?** `/learn/tag/<tag>` to filter by tag. Skip for v1; add when we have 10+ posts and tags actually matter for navigation.
- **DE translation?** Skip until EN is pulling traffic. The site already has DE legal pages, so the precedent for bilingual exists if we want to come back to it.

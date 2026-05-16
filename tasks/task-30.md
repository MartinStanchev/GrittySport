## Feature 30: Content Generation Pipeline — `/learn` Blog with Claude API

### Goal
Build a `/learn` content hub on the marketing site populated by a Claude-API-driven generation pipeline. Long-form articles on training science (periodization, recovery, RPE vs HR zones, marathon programming, etc.) serve two purposes: rank in Google for high-intent fitness queries, and get cited by LLM answer engines when users ask training questions. The pipeline takes a topic queue → outline → draft → reviewable markdown, all costed and cached via the Anthropic SDK.

### Why this approach
- Training/fitness queries are the highest-intent traffic for an app like Gritty. Ranking a post on "how to structure a marathon training block" puts us in front of users at the exact moment they're thinking about programming.
- LLMs (ChatGPT, Perplexity, Claude) increasingly cite source pages in their answers. Dense, well-structured articles with clear authorship are disproportionately cited. This is what task-28's `Article` schema + author bio plug into.
- A pipeline (vs. ad-hoc generation in chat) gives us a reproducible voice, consistent SEO structure (H1/H2/H3, FAQ schema, intro/conclusion), and Batch API pricing (~50% cheaper) for non-interactive bulk runs.
- Markdown source means the content is human-reviewable and editable before publishing — Claude generates a draft, a human (you) edits and approves, then publishes.

### Constraint reminder
- `web/AGENTS.md`: This is NOT the Next.js you know. Read `web/node_modules/next/dist/docs/` for the current MDX / markdown rendering pattern and `generateStaticParams` shape before implementing `[slug]` routes.
- Per the `claude-api` skill rules: code must use the Anthropic SDK with prompt caching, and the latest Claude model (Sonnet 4.6 / `claude-sonnet-4-6` for cost-effective bulk content; Opus 4.7 for editorial polishing if needed).

### Out of scope
- A CMS (Sanity, Contentful, etc.). Markdown files in the repo are the source of truth; PR review is the editorial workflow.
- Auto-publish. Every draft is reviewed and committed by a human.
- Translations. Posts ship in EN first; DE translation pipeline is a future extension.
- Image generation. Hero images for posts can be added later via Midjourney / SDXL.

---

### Task 30.1: `/learn` route + post rendering

**`web/app/learn/page.tsx`** — index page listing all posts with title, dek, publish date, reading time, and a tag chip.

**`web/app/learn/[slug]/page.tsx`** — dynamic route rendering a single markdown post. Use Next 16's recommended markdown rendering approach (verify in `node_modules/next/dist/docs/`); likely either `@next/mdx` or a server-side markdown library like `react-markdown` / `remark`.

**`web/content/learn/<slug>.md`** — content source. Each file uses frontmatter:

```markdown
---
title: "How to Structure a Marathon Training Block"
slug: "marathon-training-block-structure"
description: "A 16–20 week marathon block has 4 distinct phases. Here's how each phase serves the next, what to do in each, and how to know when to move on."
publishedAt: "2026-06-01"
updatedAt: "2026-06-01"
tags: ["running", "periodization", "marathon"]
author: "Martin Stanchev"
readingTimeMinutes: 9
---

(post body here in markdown)
```

The dynamic route reads all files from `web/content/learn/`, generates static params for each, and renders the post. Emit `Article` JSON-LD per post (`headline`, `author` linking to the `/about` Person, `datePublished`, `dateModified`, `description`, `keywords`).

The index page reads all frontmatter and renders the list.

**`web/components/sections/LearnTeaser.tsx`** — small "Latest articles" component to drop into the landing page footer area linking to the 3 most recent posts. Optional; useful for crawl-depth and internal linking once 5+ posts exist.

---

### Task 30.2: Topic queue

**`marketing/content/topics.md`** — flat markdown file with a status table. Status values: `queued`, `drafted`, `reviewed`, `published`, `archived`.

| Status | Slug | Working title | Target keywords | Notes |
|--------|------|--------------|-----------------|-------|
| queued | `marathon-training-block-structure` | How to structure a marathon training block | marathon training, marathon training plan | 16-20wk block, 4 phases |
| queued | `rpe-vs-hr-zones` | RPE vs heart-rate zones: when to use which | rpe scale, heart rate zones, training zones | |
| queued | `swim-csss-explained` | Critical swim speed (CSS): how to test and use it | critical swim speed, css test, swim training | |
| queued | `recovery-week-deload` | What a real deload week looks like | deload week, recovery week, training fatigue | |
| ... (seed with ~15 topics across running, cycling, swimming, strength, recovery) | | | | |

Seed the queue with ~15 topics. The pipeline reads from the top of the `queued` rows.

---

### Task 30.3: Generation pipeline (TypeScript script)

**`web/scripts/generate-post.ts`** — Node script (run via `tsx` or `bun`), invoked as:

```bash
npx tsx web/scripts/generate-post.ts <slug>
# or to generate the next queued topic:
npx tsx web/scripts/generate-post.ts --next
```

Steps:

1. **Load topic** from `marketing/content/topics.md` by slug.
2. **Outline pass** — call `claude-sonnet-4-6` with:
   - System prompt: voice/style guide + structure rules (H2 sections, intro hook, conclusion with CTA to download Gritty, internal links to related posts, FAQ section at the bottom). Marked as a cache breakpoint.
   - User prompt: topic, target keywords, working title.
   - Output: structured outline (H2 + H3 + key points per section).
3. **Draft pass** — second call to `claude-sonnet-4-6` with the cached system prompt + the outline + an instruction to write the full draft (~1500–2500 words, conversational-expert tone, no hedging, no AI tells like "Let's dive in" or "In this article we'll explore"). Output: full markdown body.
4. **Frontmatter** — script generates frontmatter from the topic row + computes `readingTimeMinutes` from word count.
5. **Write** to `web/content/learn/<slug>.md`. **Do not publish** — the file lands with frontmatter `publishedAt: null` so the route filters it out of the index until a human edits/sets the date.
6. **Update topic status** to `drafted` in `topics.md`.

**Style guide (in the system prompt, cached):**
- Author voice: experienced coach, direct, no jargon without definition.
- No AI tells, no "as an AI", no "in this article".
- Use specific numbers (paces, %HRmax, watt ranges) where they exist; don't invent values.
- Every claim that isn't common knowledge cites a source (link out or note "(per Coggan 2020)" style).
- Include a 3–5 question FAQ at the bottom (so the `[slug]/page.tsx` can render `FAQPage` schema for these too).
- End with one sentence on how Grit handles this in the app — soft mention, not sales copy.

**Prompt caching:** put the style guide in a cached system block. With ~10 posts per batch, this saves >80% on input tokens for the style guide.

**Batch API:** for runs of 5+ posts, the script can switch to the Batch API endpoint (`/v1/messages/batches`) — 50% cheaper, results within 24h, fine since publishing is async.

---

### Task 30.4: Anthropic SDK setup

The script needs `@anthropic-ai/sdk`. Add to `web/package.json` `devDependencies`:

```json
"@anthropic-ai/sdk": "^0.30.0",  // confirm latest at install time
"tsx": "^4.19.0",
"gray-matter": "^4.0.3"            // for frontmatter parsing
```

Add `web/.env.local` entry:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` is gitignored; document in `web/README.md` how to set it.

---

### Task 30.5: Editorial workflow (process, not code)

Document in `marketing/content/WORKFLOW.md`:

1. Pick a topic with status `queued` from `topics.md`.
2. Run `npx tsx web/scripts/generate-post.ts <slug>`.
3. Open the generated `web/content/learn/<slug>.md`. Edit ruthlessly:
   - Trim padding sentences.
   - Replace generic advice with specific numbers or examples from your training experience.
   - Add personal anecdotes if relevant (these are what LLMs and humans actually quote).
   - Add internal links (`[link text](/learn/related-slug)`) to other published posts where they fit naturally.
4. Set `publishedAt` to today's date in frontmatter.
5. Update topic status to `published` in `topics.md`.
6. Commit + push.
7. Update `web/app/llms.txt` to list the new post (or extend `llms.txt` to dynamically include published posts — small enhancement).

Target cadence: 1 post / week initially; 2–3 / week once the queue and pipeline are warm.

---

### Task 30.6: Internal linking + cross-promotion

Once 5+ posts are published, add:

- A `Related articles` section at the bottom of each `[slug]/page.tsx` showing 3 posts with matching tags.
- The `LearnTeaser` component (from 30.1) added to the landing page above the Footer.
- A link to a relevant `/learn` post from the relevant FAQ entries on `/` (e.g., FAQ "How do training zones work?" → "Learn more in our [RPE vs HR zones guide](/learn/rpe-vs-hr-zones)").

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `web/app/learn/page.tsx` | Create — index page with post cards |
| `web/app/learn/[slug]/page.tsx` | Create — dynamic post route with `Article` JSON-LD |
| `web/content/learn/` | Create — markdown source directory |
| `web/components/sections/LearnTeaser.tsx` | Create — "Latest articles" component for landing page |
| `web/components/learn/PostCard.tsx` | Create — shared card UI for index + teaser |
| `web/scripts/generate-post.ts` | Create — pipeline entry point |
| `web/scripts/prompts/voice-guide.md` | Create — system prompt, loaded by the script and sent as a cache breakpoint |
| `web/package.json` | Modify — add `@anthropic-ai/sdk`, `tsx`, `gray-matter` |
| `web/README.md` | Modify — document `ANTHROPIC_API_KEY` + how to run the pipeline |
| `web/.env.local.example` | Create — placeholder for the API key |
| `marketing/content/topics.md` | Create — topic queue with seeded 15 topics |
| `marketing/content/WORKFLOW.md` | Create — editorial process doc |
| `web/app/llms.txt/route.ts` | Modify (after task-28) — dynamically include published posts |
| `web/app/sitemap.ts` | Modify (after task-28) — include published `/learn/*` URLs |

---

### How to Test

1. **Pipeline runs:** `npx tsx web/scripts/generate-post.ts marathon-training-block-structure` produces a valid markdown file with frontmatter; topic status flips to `drafted`.
2. **Cache hits:** second invocation in the same hour shows `cache_read_input_tokens` > 0 in the API response (confirms prompt caching is working). Log this from the script.
3. **Route renders:** `npm run dev` → visit `/learn` → see the index, click a post → renders with intro, sections, FAQ.
4. **JSON-LD valid:** Rich Results Test on a published post — `Article` + `FAQPage` both detected.
5. **`publishedAt: null` posts hidden:** create a draft with no date; confirm it doesn't appear in the index or sitemap.
6. **Cost sanity check:** Sonnet 4.6 input/output pricing × ~3k tokens per post × 15 posts should land around $0.50–$1 for the initial batch. Confirm with actual API usage after generating 2–3 posts.
7. **No AI tells:** spot-check the generated drafts for "Let's explore", "In this article", "As an AI" — if any slip through, harden the style guide.
8. **Build still green:** `npm run build` from `web/`; the dynamic `[slug]` route prerenders all published posts as static.
9. **Lint:** `npx eslint .` from `web/`.

---

### Open Questions

- **Markdown vs MDX?** MDX lets you embed React components in posts (great for interactive examples like an "RPE calculator" widget). Markdown is simpler. Recommend markdown for v1; revisit if interactive examples become a priority.
- **Model choice:** Sonnet 4.6 for cost, Opus 4.7 for quality polish? Recommend Sonnet 4.6 for drafts (fast + cheap) and ad-hoc Opus 4.7 invocations only for tricky topics. Confirm pricing tradeoff after a few generations.
- **Hero image per post:** required for OpenGraph (otherwise social shares look bare). Manual Midjourney/SDXL prompt per post, or a templated SVG hero?
- **DE translations:** add a `--locale de` flag to the script that translates a published EN post? Or keep DE as manual-only?
- **Comments / engagement:** none for v1. Could add Disqus or Giscus later, but adds complexity and a privacy-policy update.
- **Newsletter cross-pollination:** every post should end with "Subscribe for the next one" once task-31 ships email capture. Note for after 31 lands.

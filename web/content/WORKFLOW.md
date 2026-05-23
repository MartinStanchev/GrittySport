# `/learn` editorial workflow

Hand-authored markdown. PR review is the editorial review.

## Add a post

1. Pick a topic. Aim for queries with commercial intent ("AI fitness coach app", "AI training plan generator", "how does AI training planning work") or how-tos that demonstrate Grit doing something concrete.
2. Draft in chat with Claude — back-and-forth outline → draft → polish. Voice: direct, specific, no AI tells.
3. Save to `web/content/learn/<slug>.md` with frontmatter.
4. While drafting, set `publishedAt: null`. Files starting with `_` are also skipped, useful for in-progress drafts.
5. Once polished, set `publishedAt` to today's date (`YYYY-MM-DD`). Run `npm run build` from `web/` to verify the post compiles and shows up in sitemap + index.
6. Update internal links from older posts where it makes sense.

## Frontmatter

```markdown
---
title: "Your post title"
slug: "url-slug-here"            # appears at /learn/<slug>
description: "One-line description, ~150 chars, used for meta + index card."
publishedAt: "2026-06-15"        # YYYY-MM-DD or null while drafting
updatedAt: "2026-06-15"          # optional
tags: ["ai-coaching", "running"]
faq:                              # optional; emits FAQPage JSON-LD
  - q: "Question?"
    a: "Answer."
---
```

## What gets rendered automatically

- The body markdown via the global MDX components in `web/mdx-components.tsx`.
- Reading time is computed from word count (`Math.round(words / 220)`). The frontmatter doesn't carry it.
- `Article` JSON-LD with `headline`, `description`, `datePublished`, `dateModified`, `keywords`, `author` (the `/about` Person), `publisher` (Organization).
- `FAQPage` JSON-LD if `faq` is present in frontmatter.
- Sitemap entry with `lastModified = updatedAt ?? publishedAt`.

## What we don't do

- Auto-publish. Every commit is reviewed.
- A queue file or status table.
- Tag pages (skip until 10+ posts).
- Translations (skip until EN pulls traffic).
- Per-post hero images (templated for now).

Target cadence: 1 post every 1–2 weeks. Quality over volume.

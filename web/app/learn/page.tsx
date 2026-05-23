import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";
import { getPublishedPosts } from "@/lib/learn";

const SITE_URL = "https://grittyfitness.app";
const PAGE_URL = `${SITE_URL}/learn`;

export const metadata: Metadata = {
  title: "Learn — AI fitness coaching, training science, multi-sport playbooks",
  description:
    "How AI fitness coaching actually works, what Grit does under the hood, and training playbooks across running, cycling, swimming, strength, and recovery.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Learn — Gritty Fitness",
    description:
      "Training how-tos, AI coaching deep-dives, and multi-sport playbooks from the team building Gritty.",
    type: "website",
    url: PAGE_URL,
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LearnIndexPage() {
  const posts = getPublishedPosts();

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Gritty Fitness — Learn",
    url: PAGE_URL,
    description: metadata.description,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: "Gritty Fitness", url: SITE_URL },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.frontmatter.title,
      url: `${PAGE_URL}/${p.frontmatter.slug}`,
      datePublished: p.frontmatter.publishedAt,
      description: p.frontmatter.description,
    })),
  };

  return (
    <article className="bg-white">
      <JsonLd data={blogJsonLd} />

      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Eyebrow>Learn</Eyebrow>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            {/* TODO — index hero copy. */}
            How modern AI fitness coaching actually works.
          </h1>
          <p className="mt-4 text-ink-soft text-lg">
            {/* TODO — replace dek. */}
            Training science, multi-sport playbooks, and the mechanics behind
            an AI coach that adapts after every session.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-paper p-10 text-center">
            <p className="text-ink-soft">
              No posts yet — we&apos;re writing the first one. Want a heads-up?{" "}
              <Link href="/#download" className="text-brand hover:underline">
                Join the waitlist
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-10">
            {posts.map((p) => (
              <li key={p.frontmatter.slug} className="group">
                <Link
                  href={`/learn/${p.frontmatter.slug}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 text-xs text-ink-soft">
                    <time dateTime={p.frontmatter.publishedAt ?? undefined}>
                      {formatDate(p.frontmatter.publishedAt)}
                    </time>
                    <span aria-hidden>·</span>
                    <span>{p.readingTimeMinutes} min read</span>
                    {p.frontmatter.tags?.length ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-brand font-medium">
                          {p.frontmatter.tags.join(" · ")}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-display text-2xl md:text-3xl font-semibold text-ink tracking-tight group-hover:text-brand transition">
                    {p.frontmatter.title}
                  </h2>
                  <p className="mt-2 text-ink-soft leading-relaxed">
                    {p.frontmatter.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

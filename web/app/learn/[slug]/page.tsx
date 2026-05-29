import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";
import {
  getAllPublishedSlugs,
  getPostBySlug,
} from "@/lib/learn";

const SITE_URL = "https://grittyfitness.app";

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getAllPublishedSlugs().map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `${SITE_URL}/learn/${post.frontmatter.slug}/`;
  return {
    title: `${post.frontmatter.title} — Gritty Fitness`,
    description: post.frontmatter.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: "article",
      url,
      publishedTime: post.frontmatter.publishedAt ?? undefined,
      modifiedTime:
        post.frontmatter.updatedAt ?? post.frontmatter.publishedAt ?? undefined,
      tags: post.frontmatter.tags,
    },
  };
}

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

export default async function LearnPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || !post.frontmatter.publishedAt) notFound();

  // Dynamic MDX/MD import per Next.js 16 docs. The bundler will include all
  // matching files at build time; combined with `dynamicParams = false` and a
  // statically generated slug list above, unknown slugs 404.
  const { default: PostBody } = await import(
    `@/content/learn/${slug}.md`
  );

  const url = `${SITE_URL}/learn/${post.frontmatter.slug}/`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.frontmatter.title,
    description: post.frontmatter.description,
    datePublished: post.frontmatter.publishedAt,
    dateModified: post.frontmatter.updatedAt ?? post.frontmatter.publishedAt,
    keywords: (post.frontmatter.tags ?? []).join(", "),
    inLanguage: "en",
    mainEntityOfPage: url,
    author: {
      "@type": "Person",
      "@id": `${SITE_URL}/about#person`,
    },
    publisher: {
      "@type": "Organization",
      name: "Gritty Fitness",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo-mark.png`,
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE_URL}/learn/` },
      { "@type": "ListItem", position: 3, name: post.frontmatter.title, item: url },
    ],
  };

  const jsonLd: Record<string, unknown>[] = [articleJsonLd, breadcrumbJsonLd];
  if (post.frontmatter.faq && post.frontmatter.faq.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.frontmatter.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <article className="bg-white">
      <JsonLd data={jsonLd} />

      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Eyebrow>Learn</Eyebrow>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            {post.frontmatter.title}
          </h1>
          <div className="mt-4 flex items-center gap-3 text-sm text-ink-soft">
            <time dateTime={post.frontmatter.publishedAt ?? undefined}>
              {formatDate(post.frontmatter.publishedAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{post.readingTimeMinutes} min read</span>
            {post.frontmatter.tags?.length ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-brand font-medium">
                  {post.frontmatter.tags.join(" · ")}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <PostBody />

        <hr className="my-12 border-black/5" />

        <p className="text-ink-soft">
          Back to{" "}
          <Link href="/learn" className="text-brand hover:underline">
            all posts
          </Link>{" "}
          · See{" "}
          <Link href="/how-it-works" className="text-brand hover:underline">
            how Grit works
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

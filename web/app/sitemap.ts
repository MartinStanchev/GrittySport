import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/learn";

// Required when next.config.ts has `output: "export"` — emits at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://grittyfitness.app";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, priority: 1.0, changeFrequency: "monthly" },
    { url: `${base}/how-it-works/`, lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/examples/`, lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/learn/`, lastModified: now, priority: 0.7, changeFrequency: "weekly" },
    { url: `${base}/about/`, lastModified: now, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/privacy/`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/terms/`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/impressum/`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
  ];

  const posts = getPublishedPosts(now).map((p) => {
    const last =
      p.frontmatter.updatedAt ?? p.frontmatter.publishedAt ?? null;
    const lastModified = last ? new Date(last) : now;
    return {
      url: `${base}/learn/${p.frontmatter.slug}/`,
      lastModified,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    };
  });

  return [...staticRoutes, ...posts];
}

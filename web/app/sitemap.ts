import type { MetadataRoute } from "next";

// Required when next.config.ts has `output: "export"` — emits at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://grittyfitness.app";
  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1.0, changeFrequency: "monthly" },
    { url: `${base}/about`, lastModified: now, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/privacy`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/terms`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/impressum`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
  ];
}

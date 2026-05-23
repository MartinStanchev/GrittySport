import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const LEARN_DIR = path.join(process.cwd(), "content", "learn");

export type LearnFrontmatter = {
  title: string;
  slug: string;
  description: string;
  publishedAt: string | null;
  updatedAt?: string | null;
  tags?: string[];
  faq?: { q: string; a: string }[];
};

export type LearnPost = {
  frontmatter: LearnFrontmatter;
  content: string;
  readingTimeMinutes: number;
};

function readPost(filename: string): LearnPost | null {
  if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) return null;
  const raw = readFileSync(path.join(LEARN_DIR, filename), "utf-8");
  const { data, content } = matter(raw);
  const slug = (data.slug as string | undefined) ?? filename.replace(/\.(md|mdx)$/, "");
  const frontmatter: LearnFrontmatter = {
    title: (data.title as string) ?? "Untitled",
    slug,
    description: (data.description as string) ?? "",
    publishedAt: (data.publishedAt as string | null | undefined) ?? null,
    updatedAt: (data.updatedAt as string | null | undefined) ?? null,
    tags: (data.tags as string[] | undefined) ?? [],
    faq: (data.faq as { q: string; a: string }[] | undefined) ?? undefined,
  };
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.round(words / 220));
  return { frontmatter, content, readingTimeMinutes };
}

function listFilenames(): string[] {
  try {
    return readdirSync(LEARN_DIR).filter(
      (f) => (f.endsWith(".md") || f.endsWith(".mdx")) && !f.startsWith("_"),
    );
  } catch {
    return [];
  }
}

function isPublished(fm: LearnFrontmatter, now: Date): boolean {
  if (!fm.publishedAt) return false;
  const t = Date.parse(fm.publishedAt);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

export function getPublishedPosts(now: Date = new Date()): LearnPost[] {
  const posts = listFilenames()
    .map(readPost)
    .filter((p): p is LearnPost => p !== null)
    .filter((p) => isPublished(p.frontmatter, now));
  posts.sort((a, b) => {
    const at = Date.parse(a.frontmatter.publishedAt ?? "");
    const bt = Date.parse(b.frontmatter.publishedAt ?? "");
    return bt - at;
  });
  return posts;
}

export function getPostBySlug(slug: string): LearnPost | null {
  const filenames = listFilenames();
  for (const filename of filenames) {
    const post = readPost(filename);
    if (post && post.frontmatter.slug === slug) return post;
  }
  return null;
}

export function getAllPublishedSlugs(now: Date = new Date()): string[] {
  return getPublishedPosts(now).map((p) => p.frontmatter.slug);
}

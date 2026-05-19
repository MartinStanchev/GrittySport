import type { MDXComponents } from "mdx/types";
import Link from "next/link";

const components: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="font-display text-4xl md:text-5xl font-bold text-ink leading-tight mt-12 mb-6">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink mt-12 mb-4 tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-xl font-semibold text-ink mt-8 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-ink-soft leading-relaxed mb-5">{children}</p>
  ),
  a: ({ href, children }) => {
    const url = href ?? "#";
    const isInternal = url.startsWith("/");
    if (isInternal) {
      return (
        <Link href={url} className="text-brand underline underline-offset-2 hover:text-brand-dark">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={url}
        className="text-brand underline underline-offset-2 hover:text-brand-dark"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc pl-6 text-ink-soft leading-relaxed mb-5 space-y-1.5">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 text-ink-soft leading-relaxed mb-5 space-y-1.5">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-brand pl-5 py-1 my-6 text-ink italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="font-mono text-sm bg-paper text-ink px-1.5 py-0.5 rounded">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="font-mono text-sm bg-ink text-cream p-4 rounded-lg overflow-x-auto my-6">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="text-ink font-semibold">{children}</strong>
  ),
  hr: () => <hr className="my-10 border-black/10" />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}

import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  output: "export",
  // Emit `how-it-works/index.html` instead of `how-it-works.html` so static
  // hosts (DO App Platform) resolve `/how-it-works` on refresh/direct-load.
  trailingSlash: true,
  images: { unoptimized: true }, // required because Logo.tsx uses next/image
  turbopack: { root: __dirname },
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    // String names so Turbopack can serialize them.
    remarkPlugins: ["remark-gfm", "remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);

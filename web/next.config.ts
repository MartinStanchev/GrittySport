import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  output: "export",
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true }, // required because Logo.tsx uses next/image
  turbopack: { root: __dirname },
};
export default nextConfig;

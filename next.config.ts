import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true }, // hackathon: skip lint at build time
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

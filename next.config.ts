import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST || ".next", // lets a second preview instance use its own cache
  eslint: { ignoreDuringBuilds: true }, // hackathon: skip lint at build time
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

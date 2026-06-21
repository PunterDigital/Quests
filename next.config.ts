import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server build (.next/standalone) for small Docker images.
  output: "standalone",
};

export default nextConfig;

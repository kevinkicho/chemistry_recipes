import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Load workspace-root .env (OLLAMA_CLOUD_API_KEY) in addition to web/.env*
// Note: serverEnv.ts also reads root .env at runtime — Next only auto-loads web/.env*
const monorepoRoot = path.join(__dirname, "..");
loadEnvConfig(monorepoRoot);
loadEnvConfig(__dirname);

// Ensure key is on process.env for any code that reads it at boot
if (!process.env.OLLAMA_CLOUD_API_KEY && process.env.OLLAMA_API_KEY) {
  process.env.OLLAMA_CLOUD_API_KEY = process.env.OLLAMA_API_KEY;
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pubchem.ncbi.nlm.nih.gov",
        pathname: "/rest/pug/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/catalog", destination: "/search", permanent: true },
      { source: "/molecules/:slug*", destination: "/search", permanent: false },
      { source: "/molecule/cid/:cid", destination: "/compounds/pubchem/:cid", permanent: true },
      { source: "/molecule/:id", destination: "/search", permanent: false },
    ];
  },
};

export default nextConfig;

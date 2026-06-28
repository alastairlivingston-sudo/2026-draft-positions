import type { NextConfig } from "next";

// Baked into the client bundle and into /api/version at build time, so a
// tab can detect it's running stale JS from before the latest deploy - see
// useLivePolling's staleBuild check. VERCEL_GIT_COMMIT_SHA is set by Vercel
// for every build; the Date.now() fallback just keeps local dev unique.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;

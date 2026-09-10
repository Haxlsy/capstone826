import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.34"],
  serverExternalPackages: ["@google/genai", "fluent-ffmpeg", "ffmpeg-static"],
  experimental: {
    // Default is 0 — every dynamic route (anything using cookies(), i.e.
    // every page in this app) is treated as instantly stale, so the Client
    // Router Cache never reuses a recent visit and always re-runs the
    // Server Component on navigation. 30s matches the app's existing
    // react-query default (providers/query-provider.tsx) and doesn't affect
    // already-mounted client components' realtime subscriptions at all.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;

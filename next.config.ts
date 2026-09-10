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
  async headers() {
    return [
      {
        // The service worker file must be re-checked on every load so a new
        // deploy's SW is picked up promptly (see public/sw.js).
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;

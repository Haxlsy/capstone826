import type { NextConfig } from "next";

// ── Security headers ─────────────────────────────────────────────────────────
// Defense in depth: they don't fix a bug by themselves, they limit what another
// bug (an XSS, a malicious upload, a framed page) could do.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = (() => {
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
})();
// Supabase realtime runs over a websocket on the same host.
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");
const isDev = process.env.NODE_ENV !== "production";
// Cloudflare Turnstile (bot check on the login page, components/LoginPage.tsx).
const TURNSTILE = "https://challenges.cloudflare.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline': Next.js starts each page with small inline scripts. A
  // per-request nonce (set in proxy.ts) would remove it but makes every page
  // render dynamically; kept as a later hardening step. Scripts from any other
  // site are still blocked. 'unsafe-eval' is only for `next dev`.
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}${isDev ? " 'unsafe-eval'" : ""}`,
  // React style={} props and the print-export HTML use inline styles.
  "style-src 'self' 'unsafe-inline'",
  // data: for inline SVG icons, blob: for upload previews, Supabase for stored media.
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Nobody may put this app in a frame (clickjacking).
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Never guess a file's type: an uploaded "image" can't be run as HTML/JS.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our origin, never a full path or query string.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers' version of frame-ancestors 'none'.
  { key: "X-Frame-Options", value: "DENY" },
  // Camera/microphone stay allowed for the head technician's video recorder
  // (components/head-technician/VideoRecorderModal.tsx); the rest is off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.34"],
  serverExternalPackages: ["@google/genai", "fluent-ffmpeg", "ffmpeg-static"],
  // ffmpeg-static's binary is found at runtime by path, so the bundler's file
  // tracing doesn't see it. Without this the deployed routes have no ffmpeg:
  // video checks can't read frames and muting silently falls back.
  outputFileTracingIncludes: {
    "/api/head-technician/jobs/[id]/stages/[stageId]/media": ["./node_modules/ffmpeg-static/ffmpeg*"],
    "/api/ai/image-handler": ["./node_modules/ffmpeg-static/ffmpeg*"],
  },
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
        source: "/(.*)",
        headers: securityHeaders,
      },
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

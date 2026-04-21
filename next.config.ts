import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.34"],
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;

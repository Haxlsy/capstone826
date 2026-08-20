import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // The chatbot module instantiates GoogleGenAI and the supabase admin client
    // at import time; provide dummy values so pure-logic tests can import them
    // without a live backend.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      GEMINI_API_KEY_CHATBOT: "test-gemini-key",
    },
  },
})
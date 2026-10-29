import { defineConfig } from "vitest/config";

/**
 * Template conformance tests (`pnpm test:templates`). They start real containers with
 * Testcontainers, so they need Docker and are kept out of `pnpm check`.
 */
export default defineConfig({
  test: {
    include: ["templates/*/conformance/**/*.conformance.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});

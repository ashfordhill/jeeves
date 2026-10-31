import { defineConfig } from "vitest/config";

/**
 * Template conformance tests and the generator's baseline test (`pnpm test:templates`). They
 * start real containers, so they need Docker and are kept out of `pnpm check`.
 */
export default defineConfig({
  test: {
    include: [
      "templates/*/conformance/**/*.conformance.ts",
      "packages/generator/conformance/**/*.conformance.ts",
      "packages/qr-artwork/conformance/**/*.conformance.ts",
      "packages/durable-events/conformance/**/*.conformance.ts",
    ],
    environment: "node",
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "generator",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite-backed tests start a database per file; a shared CI runner needs more than
    // Vitest's 5 s default.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

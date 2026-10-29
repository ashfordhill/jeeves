import { defineConfig } from "vitest/config";

/** One Vitest run for the whole repo; each workspace with tests is a project. */
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    passWithNoTests: true,
  },
});

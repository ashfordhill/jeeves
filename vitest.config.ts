import { defineConfig } from "vitest/config";

/** One Vitest run for the whole repo; each workspace is a project with its own config. */
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*", "jeeves-generator"],
  },
});

import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

/** One Vitest run for the whole repo; each workspace is a project with its own config. */
export default defineConfig({
  root: new URL("../", import.meta.url).pathname,
  test: {
    // Parallel PGlite startup can exhaust the hook budget on a busy development machine.
    maxWorkers: Math.min(4, availableParallelism()),
    projects: ["jeeves/apps/*", "jeeves/packages/*", "jeeves-generator"],
  },
});

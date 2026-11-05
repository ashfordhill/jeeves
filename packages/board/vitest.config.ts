import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "board",
    // The React test opts into jsdom with a `@vitest-environment` comment.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

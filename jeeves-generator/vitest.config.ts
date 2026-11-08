import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "generator", environment: "node", include: ["src/**/*.test.ts"] },
});

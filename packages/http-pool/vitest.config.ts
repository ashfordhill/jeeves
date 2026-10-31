import { defineProject } from "vitest/config";
export default defineProject({
  test: { name: "http-pool", environment: "node", include: ["src/**/*.test.ts"] },
});

import { defineProject } from "vitest/config";
export default defineProject({
  test: { name: "durable-events", environment: "node", include: ["src/**/*.test.ts"] },
});

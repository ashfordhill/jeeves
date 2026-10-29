import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "orchestrator",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

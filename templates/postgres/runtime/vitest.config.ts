import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "postgres-runtime",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

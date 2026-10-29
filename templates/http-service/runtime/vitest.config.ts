import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "service-runtime",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

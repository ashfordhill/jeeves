import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "board",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "rest-server",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

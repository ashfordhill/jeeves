import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "template-kit",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

import { defineProject } from "vitest/config";
export default defineProject({
  test: {
    name: "resource-workspace",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

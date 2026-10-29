import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "web-runtime",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

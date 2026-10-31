import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "product-ui", environment: "jsdom", include: ["src/**/*.test.tsx"] },
});

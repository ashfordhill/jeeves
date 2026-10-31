import { defineProject } from "vitest/config";
export default defineProject({
  test: { name: "qr-artwork", environment: "node", include: ["src/**/*.test.ts"] },
});

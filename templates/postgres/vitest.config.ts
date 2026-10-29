import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "template-postgres",
    environment: "node",
    // Conformance tests (`conformance/*.conformance.ts`) need Docker: `pnpm test:templates`.
    include: ["*.test.ts", "test-pack/**/*.test.ts"],
  },
});

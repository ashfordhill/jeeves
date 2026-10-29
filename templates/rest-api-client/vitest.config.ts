import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "template-rest-api-client",
    environment: "node",
    // Conformance tests (`conformance/*.conformance.ts`) need Docker: `pnpm test:templates`.
    include: ["*.test.ts", "test-pack/**/*.test.ts"],
  },
});

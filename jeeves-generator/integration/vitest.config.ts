import { defineConfig } from "vitest/config";

const artifacts = process.env.JEEVES_SYSTEM_ARTIFACTS;
const suites = (process.env.JEEVES_SYSTEM_SUITES ?? "").split(",");
if (!artifacts || !process.env.JEEVES_SYSTEM_RECORD) throw new Error("Use pnpm test:generated");
export default defineConfig({
  root: new URL("../../", import.meta.url).pathname,
  test: {
    name: "generated-system",
    environment: "node",
    include: suites.map(
      (suite) => `jeeves-generator/integration/scenarios/${suite}*.system.test.ts`,
    ),
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    testTimeout: 900_000,
    hookTimeout: 120_000,
    passWithNoTests: false,
    reporters: ["default", "json", "junit"],
    outputFile: { json: `${artifacts}/vitest.json`, junit: `${artifacts}/junit.xml` },
  },
});

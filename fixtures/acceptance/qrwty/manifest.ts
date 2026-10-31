import { readFileSync } from "node:fs";
import type { FixedAcceptance } from "../../../packages/generator/src/acceptance.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const support = [
  "_support/api.ts",
  "_support/qr.ts",
  "_support/destinations.ts",
  "_support/fixture.ts",
  "_support/db.ts",
].map((path) => ({ path, contents: read(path) }));
support.push({
  path: "_support/page-problems.ts",
  contents: read("../../../packages/template-kit/src/page-problems.ts"),
});
const testDependencies = [
  { name: "jsqr", version: "1.4.0" },
  { name: "pngjs", version: "7.0.0" },
];

const suite = (
  input: Omit<FixedAcceptance, "service" | "files"> & { service?: string },
): FixedAcceptance => ({
  service: "qrwty",
  files: support,
  ...input,
});

/** The reviewed QR-01–QR-09 suites; register them with generateProject before coding. */
export const qrwtyAcceptance: FixedAcceptance[] = [
  suite({
    id: "core",
    operationIds: ["downloadQr", "followQr", "qrActivity"],
    acceptanceIds: ["QR-01"],
    requires: "extensions",
    runner: "node",
    dependencies: [],
    source: read("core.test.ts"),
  }),
  suite({
    id: "qr-image",
    operationIds: ["downloadQr"],
    acceptanceIds: ["QR-02", "QR-06"],
    requires: "extensions",
    runner: "node",
    dependencies: testDependencies,
    source: read("qr-image.test.ts"),
  }),
  suite({
    id: "redirect",
    operationIds: ["followQr"],
    acceptanceIds: ["QR-03", "QR-04", "QR-07"],
    requires: "extensions",
    runner: "node",
    dependencies: testDependencies,
    source: read("redirect.test.ts"),
  }),
  suite({
    id: "activity",
    operationIds: ["qrActivity"],
    acceptanceIds: ["QR-05", "QR-06"],
    requires: "extensions",
    runner: "node",
    dependencies: [],
    source: read("activity.test.ts"),
  }),
  suite({
    id: "restart",
    operationIds: ["downloadQr", "followQr", "qrActivity"],
    acceptanceIds: ["QR-08"],
    requires: "extensions",
    runner: "node",
    dependencies: testDependencies,
    source: read("restart.test.ts"),
  }),
  suite({
    id: "browser",
    operationIds: ["downloadQr", "followQr", "qrActivity"],
    acceptanceIds: ["QR-09"],
    requires: "frontend",
    runner: "playwright",
    dependencies: [{ name: "@playwright/test", version: "1.63.0" }, ...testDependencies],
    source: read("browser.test.ts"),
  }),
];

import { readFileSync } from "node:fs";
import type { FixedAcceptance } from "../../../packages/generator/src/acceptance.ts";
import { qrwtyStudioAcceptance } from "../qrwty-studio/manifest.ts";
export const qrwtyAnalyticsAcceptance: FixedAcceptance[] = [
  ...qrwtyStudioAcceptance,
  {
    id: "owner-analytics",
    service: "qrwty",
    operationIds: ["ownerAnalytics"],
    acceptanceIds: ["QR-15"],
    requires: "extensions",
    runner: "node",
    files: qrwtyStudioAcceptance[0]?.files ?? [],
    source: readFileSync(new URL("analytics.test.ts", import.meta.url), "utf8"),
  },
  {
    id: "analytics-browser",
    service: "qrwty",
    operationIds: ["ownerAnalytics"],
    acceptanceIds: ["QR-16"],
    requires: "frontend",
    runner: "playwright",
    dependencies: [{ name: "@playwright/test", version: "1.63.0" }],
    files: qrwtyStudioAcceptance[0]?.files ?? [],
    source: readFileSync(new URL("browser.test.ts", import.meta.url), "utf8"),
  },
];

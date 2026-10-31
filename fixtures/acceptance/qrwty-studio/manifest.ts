import { readFileSync } from "node:fs";
import type { FixedAcceptance } from "../../../packages/generator/src/acceptance.ts";
import { qrwtyAcceptance } from "../qrwty/manifest.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
/** Additive Studio proof; existing QR-01–QR-09 behavior and current strict helper are retained. */
export const qrwtyStudioAcceptance: FixedAcceptance[] = [
  ...qrwtyAcceptance,
  {
    id: "artwork",
    service: "qrwty",
    operationIds: ["readQrStudio", "previewQrArtwork", "saveQrArtwork", "exportQrArtwork"],
    acceptanceIds: ["QR-10", "QR-11", "QR-12", "QR-13"],
    requires: "extensions",
    runner: "node",
    dependencies: [
      { name: "jsqr", version: "1.4.0" },
      { name: "pngjs", version: "7.0.0" },
    ],
    files: qrwtyAcceptance[0]?.files ?? [],
    source: read("artwork.test.ts"),
  },
  {
    id: "studio-browser",
    service: "qrwty",
    operationIds: ["readQrStudio", "previewQrArtwork", "saveQrArtwork", "exportQrArtwork"],
    acceptanceIds: ["QR-14"],
    requires: "frontend",
    runner: "playwright",
    dependencies: [
      { name: "@playwright/test", version: "1.63.0" },
      { name: "jsqr", version: "1.4.0" },
      { name: "pngjs", version: "7.0.0" },
    ],
    files: qrwtyAcceptance[0]?.files ?? [],
    source: read("browser.test.ts"),
  },
];

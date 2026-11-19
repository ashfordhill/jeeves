import { basename } from "node:path";

/** Implemented suites; Vitest selects `scenarios/<suite>*.system.test.ts` for each one. */
export const implementedSuites = [
  "core",
  "wiring",
  "identity",
  "media",
  "regeneration",
  "faults",
  "pubsub",
  "rg-foundations",
  "rg-mechanisms",
  "qr-auth0",
  "qr-stripe",
  "qr-retention",
];

/** Selected suites that contributed no scenario file to a run (a missing file is not a pass). */
export function missingSuites(selected: string[], testFiles: string[]) {
  const names = testFiles.map((file) => basename(file));
  return selected.filter(
    (suite) => !names.some((name) => name.startsWith(suite) && name.endsWith(".system.test.ts")),
  );
}

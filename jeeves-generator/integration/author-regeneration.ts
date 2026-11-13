/** Design authoring only; never attached to or imported by the application. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { emptyDesign, type StudioCommand } from "@jeeves/spec";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

// The catalog-only subgraph of author-wiring, through the same supported studio commands.
const commands: StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Read catalog", system: { name: "Regeneration" } },
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "catalog-api", name: "Catalog API", kind: "service" },
    linkId: "entry-catalog-api",
  },
  {
    type: "addTile",
    from: { tile: "catalog-api" },
    side: "after",
    tile: { id: "catalog", name: "Catalog", kind: "database" },
    linkId: "catalog-api-catalog",
  },
  {
    type: "addTile",
    from: { tile: "catalog-api" },
    side: "after",
    tile: { id: "catalog-cache", name: "Catalog cache", kind: "cache" },
    linkId: "catalog-api-catalog-cache",
  },
  {
    type: "edit",
    element: "catalog-cache",
    settings: { kind: "cache", engine: "redis-compatible", provider: "unspecified", ttlSeconds: 4 },
  },
  {
    type: "addModule",
    host: "catalog-api",
    id: "catalog-read",
    name: "Catalog read",
    kind: "cache-reader",
  },
  {
    type: "addModule",
    host: "catalog-api",
    id: "catalog-source",
    name: "Catalog source",
    kind: "data-access",
  },
  {
    type: "addModule",
    host: "catalog-api",
    id: "catalog-writer",
    name: "Catalog writer",
    kind: "data-access",
  },
  {
    type: "connectModule",
    module: "catalog-read",
    slot: "cache",
    target: { tile: "catalog-cache" },
  },
  {
    type: "connectModule",
    module: "catalog-source",
    slot: "database",
    target: { tile: "catalog" },
  },
  {
    type: "connectModule",
    module: "catalog-read",
    slot: "loader",
    target: { module: "catalog-source" },
  },
  {
    type: "connectModule",
    module: "catalog-writer",
    slot: "database",
    target: { tile: "catalog" },
  },
  { type: "setRunnableProcesses", on: true },
];
const change: StudioCommand[] = [
  {
    type: "edit",
    element: "catalog-cache",
    settings: {
      kind: "cache",
      engine: "redis-compatible",
      provider: "self-hosted",
      ttlSeconds: 16,
    },
  },
];
const a = runStudioCommands(emptyDesign(), commands);
const b = runStudioCommands(a, change);
const root = new URL(
  "../../field-projects/generator-system/fixtures/regeneration/",
  import.meta.url,
);
await mkdir(new URL("owned/", root), { recursive: true });
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const provenance = [];
const wiring = JSON.parse(await readFile(new URL("../wiring/attachments.json", root), "utf8")) as {
  source: string;
  destination: string;
  module: string;
}[];
const attachments = [];
for (const name of ["catalog-read.hooks.ts", "catalog-writer.ts", "catalog.sql"]) {
  const source = `owned/${name}`;
  const bytes = await readFile(new URL(`../wiring/${source}`, root));
  await writeFile(new URL(source, root), bytes);
  const attachment = wiring.find((row) => row.source === source);
  if (!attachment) throw new Error(`Missing Wiring attachment ${source}`);
  attachments.push(attachment);
  provenance.push({
    source: `field-projects/generator-system/fixtures/wiring/${source}`,
    sha256: sha256(bytes),
    destination: source,
    module: attachment.module,
  });
}
for (const [name, value] of Object.entries({
  "design.json": a,
  "design-b.json": b,
  "attachments.json": attachments,
  "provenance.json": { commands, change, owned: provenance },
}))
  await writeFile(new URL(name, root), `${JSON.stringify(value, null, 2)}\n`);

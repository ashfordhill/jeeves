/** Fixture authoring only; never copied into or imported by the application. */
import { writeFile } from "node:fs/promises";
import { emptyDesign, type StudioCommand } from "@jeeves/spec";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

// A public publisher stub and a Worker's consumer stub on one queue only stubs use, saved with
// provider Google Cloud: a Pub/Sub topic and the Worker's subscription (QG07, QG08).
const commands: StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Record a click", system: { name: "Clicks" } },
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "clicks-api", name: "Clicks API", kind: "service" },
    linkId: "entry-clicks-api",
  },
  {
    type: "addTile",
    from: { tile: "clicks-api" },
    side: "after",
    tile: { id: "clicks", name: "Clicks", kind: "queue" },
    linkId: "clicks-api-clicks",
  },
  {
    type: "edit",
    element: "clicks",
    settings: { kind: "queue", mode: "topic", provider: "unspecified" },
  },
  {
    type: "addTile",
    from: { tile: "clicks" },
    side: "after",
    tile: { id: "tally", name: "Tally", kind: "worker" },
    linkId: "clicks-tally",
  },
  {
    type: "addTile",
    from: { tile: "tally" },
    side: "after",
    tile: { id: "tally-db", name: "Tally database", kind: "database" },
    linkId: "tally-tally-db",
  },
  { type: "addModule", host: "clicks-api", id: "record", name: "Record", kind: "custom" },
  { type: "connectModule", module: "record", slot: "uses", target: { tile: "clicks" } },
  // `uses` follows the incoming consume link, so Count receives the topic's messages and the
  // generated database dependency together.
  { type: "addModule", host: "tally", id: "count", name: "Count", kind: "custom" },
  { type: "connectModule", module: "count", slot: "uses", target: { tile: "clicks" } },
  { type: "connectModule", module: "count", slot: "uses", target: { tile: "tally-db" } },
  { type: "setRunnableProcesses", on: true },
  // Provider is offered once Runnable processes are on and only stubs use the queue.
  {
    type: "edit",
    element: "clicks",
    settings: { kind: "queue", mode: "topic", provider: "google-cloud" },
  },
];
const design = runStudioCommands(emptyDesign(), commands);
await writeFile(
  new URL("../../field-projects/generator-system/fixtures/pubsub/design.json", import.meta.url),
  `${JSON.stringify(design, null, 2)}\n`,
);

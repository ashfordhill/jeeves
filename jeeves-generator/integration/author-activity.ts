/** Fixture authoring only; never copied into or imported by the application. */
import { writeFile } from "node:fs/promises";
import { emptyDesign, type StudioCommand } from "@jeeves/spec";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

const commands: StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Record activity", system: { name: "Activity" } },
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "activity-api", name: "Activity API", kind: "service" },
    linkId: "entry-activity",
  },
  {
    type: "addTile",
    from: { tile: "activity-api" },
    side: "after",
    tile: { id: "events", name: "Events", kind: "queue" },
    linkId: "activity-events",
  },
  {
    type: "edit",
    element: "events",
    settings: { kind: "queue", mode: "work-queue", provider: "unspecified" },
  },
  {
    type: "addTile",
    from: { tile: "events" },
    side: "after",
    tile: { id: "counter", name: "Counter", kind: "worker" },
    linkId: "events-counter",
  },
  {
    type: "addTile",
    from: { tile: "counter" },
    side: "after",
    tile: { id: "totals", name: "Totals", kind: "database" },
    linkId: "counter-totals",
  },
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "totals-api", name: "Totals API", kind: "service" },
    linkId: "entry-totals",
  },
  { type: "linkTiles", from: { tile: "totals-api" }, to: "totals", linkId: "read-totals" },
  {
    type: "addModule",
    host: "activity-api",
    id: "submit",
    name: "Submit",
    kind: "event-publisher",
  },
  { type: "connectModule", module: "submit", slot: "channel", target: { tile: "events" } },
  { type: "addModule", host: "counter", id: "consume", name: "Consume", kind: "event-consumer" },
  { type: "addModule", host: "counter", id: "increment", name: "Increment", kind: "event-counter" },
  {
    type: "addModule",
    host: "counter",
    id: "write-total",
    name: "Write total",
    kind: "data-access",
  },
  { type: "connectModule", module: "consume", slot: "channel", target: { tile: "events" } },
  { type: "connectModule", module: "write-total", slot: "database", target: { tile: "totals" } },
  {
    type: "addModule",
    host: "totals-api",
    id: "read-total",
    name: "Read total",
    kind: "data-access",
  },
  { type: "connectModule", module: "read-total", slot: "database", target: { tile: "totals" } },
  { type: "setRunnableProcesses", on: true },
];
const design = runStudioCommands(emptyDesign(), commands);
await writeFile(
  new URL("../../field-projects/generator-system/fixtures/activity/design.json", import.meta.url),
  `${JSON.stringify(design, null, 2)}\n`,
);

import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

export function retentionDesign(
  options: {
    replayDays?: number;
    receiptDays?: number;
    keepDailyTotalsMonths?: number;
    intervalSeconds?: number;
    pubsub?: boolean;
  } = {},
) {
  const {
    replayDays = 31,
    receiptDays = 35,
    keepDailyTotalsMonths = 13,
    intervalSeconds = 60,
  } = options;
  const design = runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "redirect", name: "Redirect", kind: "service" },
      linkId: "open-link",
      system: { name: "Click retention fixture" },
    },
    {
      type: "addTile",
      from: { tile: "redirect" },
      side: "after",
      tile: { id: "click-events", name: "Click events", kind: "queue" },
      linkId: "publish-clicks",
    },
    {
      type: "addTile",
      from: { tile: "click-events" },
      side: "after",
      tile: { id: "click-processor", name: "Click processor", kind: "worker" },
      linkId: "process-clicks",
    },
    {
      type: "addTile",
      from: { tile: "click-processor" },
      side: "after",
      tile: { id: "analytics", name: "Analytics", kind: "database" },
      linkId: "click-processor-analytics",
    },
    { type: "addModule", host: "click-processor", kind: "event-consumer", id: "aggregate-click" },
    {
      type: "connectModule",
      module: "aggregate-click",
      slot: "channel",
      target: { tile: "click-events" },
    },
    {
      type: "connectModule",
      module: "aggregate-click",
      slot: "state",
      target: { tile: "analytics" },
    },
    { type: "addModule", host: "click-processor", kind: "scheduled-task", id: "retention-sweep" },
    {
      type: "connectModule",
      module: "retention-sweep",
      slot: "state",
      target: { tile: "analytics" },
    },
    {
      type: "setDatabaseAccess",
      role: "click-processor",
      database: "analytics",
      product: {
        tables: [
          { name: "daily", operations: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
          { name: "breakdowns", operations: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
          { name: "sweeps", operations: ["SELECT", "INSERT"] },
        ],
        views: [],
      },
    },
    { type: "setRunnableProcesses", on: true },
  ]);
  const channel = design.architecture?.studio?.elements.find(
    (row) => row.element === "click-events",
  );
  if (channel?.settings.kind !== "queue") throw Error("Missing click channel");
  if (options.pubsub) channel.settings.provider = "google-cloud";
  return runStudioCommands(design, [
    {
      type: "editComponent",
      component: "aggregate-click",
      settings: { kind: "event-consumer", replayDays, receiptDays },
    },
    {
      type: "editComponent",
      component: "retention-sweep",
      settings: { kind: "scheduled-task", intervalSeconds, keepDailyTotalsMonths },
    },
  ]);
}

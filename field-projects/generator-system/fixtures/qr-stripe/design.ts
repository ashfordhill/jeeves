import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

export function paymentInboxDesign(format: "stripe" | "jeeves" = "stripe") {
  const design = runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "payment-inbox", name: "Payment inbox", kind: "service" },
      linkId: "provider-entry",
      system: { name: "Subscription notice intake" },
    },
    {
      type: "addTile",
      from: { tile: "payment-inbox" },
      side: "after",
      tile: { id: "billing", name: "Billing", kind: "database" },
      linkId: "payment-inbox-billing",
    },
    {
      type: "addModule",
      host: "payment-inbox",
      kind: "webhook-receiver",
      id: "verified-payment-event",
    },
    {
      type: "connectModule",
      module: "verified-payment-event",
      slot: "state",
      target: { tile: "billing" },
    },
    {
      type: "setDatabaseAccess",
      role: "payment-inbox",
      database: "billing",
      product: {
        tables: [
          { name: "subscription_events", operations: ["SELECT", "INSERT"] },
          { name: "subscriptions", operations: ["SELECT", "INSERT", "UPDATE"] },
        ],
        views: [],
      },
    },
    { type: "setRunnableProcesses", on: true },
  ]);
  const tile = design.architecture?.studio?.elements.find((row) => row.element === "payment-inbox");
  if (tile?.settings.kind !== "service") throw Error("Missing payment fixture");
  tile.settings.frontDoor = "required";
  if (format === "jeeves") return design;
  return runStudioCommands(design, [
    {
      type: "editComponent",
      component: "verified-payment-event",
      settings: {
        kind: "webhook-receiver",
        signatureFormat: "stripe",
        bodyLimitBytes: "262144",
        replayWindowSeconds: 60,
      },
    },
  ]);
}

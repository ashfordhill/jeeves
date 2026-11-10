/** Synthetic cases fixed before the paired live run. Names are role hints, never behavior proof. */
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  emptyDesign,
  type StudioCommand,
  studioArchitectureExample,
  studioPatterns,
} from "@jeeves/spec";
import { Workspace } from "../chat/tools.ts";

export const EVAL_VERSION = "1.0.0";
export const MODEL = "gpt-5.4-mini-2026-03-17";
export const LIMITS = { rounds: 16, maxOutputTokens: 4096, caseTimeoutMs: 180_000 };
export type EvalCase = {
  id: string;
  domain: "video" | "checkout" | "tinyurl";
  task: "build" | "repair" | "edit";
  heldOut: boolean;
  prompt: string;
  seed: () => DesignDocument;
  protectedIds: string[];
  obligations: { id: string; terms: string[] }[];
  alternatives: string;
};

export function commands(seed: DesignDocument, batch: readonly StudioCommand[]) {
  const workspace = new Workspace(seed);
  const result = JSON.parse(
    workspace.run(
      "applyStudioCommands",
      JSON.stringify({ baseRevision: seed.revision, commands: batch }),
    ),
  );
  if (!result.ok) throw new Error(`Invalid eval seed: ${JSON.stringify(result)}`);
  return workspace.working;
}
const first = (id: string, name: string): StudioCommand => ({
  type: "addTile",
  side: "after",
  tile: { id, name, kind: "service" },
  from: { lane: "upload" },
  linkId: `upload-${id}`,
  system: { name: "Synthetic checkout" },
});
const after = (
  from: string,
  id: string,
  name: string,
  kind: "service" | "database" | "billing" | "queue" | "worker" | "search",
): StudioCommand => ({
  type: "addTile",
  side: "after",
  tile: { id, name, kind },
  from: { tile: from },
  linkId: `${from}-${id}`,
});
function videoSeed() {
  const example = studioPatterns["durable-background-job"].example;
  if (example.kind !== "commands") throw new Error("Expected job example");
  return commands(emptyDesign(), [
    ...example.commands,
    after("processor", "completed", "Processing results", "queue"),
    after("completed", "indexer", "Search indexer", "worker"),
    after("indexer", "search", "Search index", "search"),
    {
      type: "edit",
      element: "outputs",
      name: "Owner export bucket",
      description: "Keep this unrelated export configuration.",
    },
  ]);
}
function checkoutSeed() {
  return commands(emptyDesign(), [
    first("orders", "Orders"),
    after("orders", "order-state", "Order state", "database"),
    after("orders", "catalog", "Catalog", "service"),
    after("catalog", "inventory", "Inventory", "database"),
    after("orders", "payments", "Payments", "billing"),
    after("payments", "payment-state", "Payment state", "database"),
    {
      type: "edit",
      element: "inventory",
      name: "Owner stock ledger",
      description: "Existing owner customization; preserve settings and identity.",
    },
  ]);
}
function tinySeed(edge: boolean) {
  let seed = studioArchitectureExample("studio-tinyurl").design;
  seed = commands(seed, [
    {
      type: "edit",
      element: "shorten",
      name: "Owner create API",
      description: "Keep the owner custom creation service.",
    },
  ]);
  if (edge) {
    // Historical custom source is an explicit seed, never a normal chat configuration.
    const legacyCommands: StudioCommand[] = [
      {
        type: "addTile",
        side: "after",
        tile: { id: "edge", name: "Response cache", kind: "cdn" },
        from: { lane: "download" },
        linkId: "download-edge",
      },
      { type: "linkTiles", from: { tile: "edge" }, to: "redirect", linkId: "edge-redirect" },
      {
        type: "edit",
        element: "edge",
        settings: {
          kind: "cdn",
          provider: "cloudflare",
          origin: "redirect",
          cacheRedirects: "enabled",
        },
      },
    ];
    for (const command of legacyCommands) {
      const result = applyOperations(seed, buildStudioCommand(seed, command).ops);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      seed = result.design;
    }
  }
  return seed;
}
const lifecycle = { id: "durable-attempt", terms: ["pending", "failed", "attempt"] };
const duplicate = { id: "duplicate-delivery", terms: ["duplicate", "retries"] };
const finite = { id: "finite-stock", terms: ["stock", "expiry", "reservation"] };
const notification = {
  id: "checkout-contract",
  terms: ["duplicate", "notification", "reconciliation"],
};
const context =
  " Work within Jeeves' current model, state unsupported behavior as explicit unresolved implementation obligations, and never claim a tile/module implements a business invariant. Make reasonable narrow assumptions; do not ask a question for this evaluation.";

export const cases: EvalCase[] = [
  {
    id: "video-build",
    domain: "video",
    task: "build",
    heldOut: false,
    prompt:
      "Build a small public video upload/processing design from empty. Retain durable original bytes; queued jobs reference them and the processing worker reads them and writes separate outputs. The video owner must have durable pending/failed status before processing and safe duplicate job handling. Show the supported dependencies and identify lifecycle/idempotency gaps." +
      context,
    seed: emptyDesign,
    protectedIds: [],
    obligations: [lifecycle, duplicate],
    alternatives:
      "A service or Uploads owner and different names are acceptable. Same-owner completion remains an obligation; no fake independent lifecycle owner is required.",
  },
  {
    id: "video-publication-repair",
    domain: "video",
    task: "repair",
    heldOut: false,
    prompt:
      "Repair this video topology: Search indexer currently consumes Processing results directly, before the video owner commits publication. Search must consume a distinct owner-publication feed. Keep durable originals and their worker read, the search projection and Owner export bucket's exact identity/settings/purpose. Keep pending/failed status, duplicate jobs, same-owner completion and publication/read visibility as unresolved obligations wherever the current model cannot encode them." +
      context,
    seed: videoSeed,
    protectedIds: ["originals", "owner-export-bucket"],
    obligations: [
      lifecycle,
      duplicate,
      { id: "publication-contract", terms: ["publication", "visibility"] },
    ],
    alternatives:
      "An owner publication topic feeding the existing indexer is sufficient represented intent. Renaming processing results is insufficient; names cannot establish committed publication.",
  },
  {
    id: "checkout-build",
    domain: "checkout",
    task: "build",
    heldOut: false,
    prompt:
      "Build a narrow fixed-price finite-stock checkout. Orders owns a durable pending checkout attempt before requesting Payments; Catalog owns stock/price authority. Payments owns its provider integration and payment records. Include stock reservation with expiry/concurrency, payment timeout reconciliation, duplicate or delayed payment notification handling, and compensation as explicit unimplemented obligations. No shipping/tax/marketplace settlement." +
      context,
    seed: emptyDesign,
    protectedIds: [],
    obligations: [
      { id: "pending-before-payment", terms: ["pending", "payment"] },
      finite,
      notification,
    ],
    alternatives:
      "Inventory inside Catalog or Orders/Payments inside one service boundary can be reasonable. No separate Stripe External tile or fake callback owner is needed.",
  },
  {
    id: "checkout-late-notification-edit",
    domain: "checkout",
    task: "edit",
    heldOut: true,
    prompt:
      "Held-out change: this finite-stock checkout must handle the same payment success delivered twice and then delivered after reservation expiry/cancellation. Preserve Owner stock ledger's exact identity/settings/purpose and all unrelated topology. Record duplicate/unordered notifications, a late-payment recovery decision, reservation expiry and durable reconciliation as unresolved requirements; change topology only if needed." +
      context,
    seed: checkoutSeed,
    protectedIds: ["owner-stock-ledger", "catalog", "payment-state"],
    obligations: [finite, notification],
    alternatives:
      "A review-only turn is appropriate. Do not create extra independent order owners to evade same-owner return constraints. Late success must not be claimed automatically safe.",
  },
  {
    id: "tinyurl-response-cache-repair",
    domain: "tinyurl",
    task: "repair",
    heldOut: false,
    prompt:
      "Repair TinyURL analytics: every redirect must reach its click publisher, but Response cache may cache the redirect response and bypass it. Disable redirect-response caching or remove that cache path; keep lookup caching, Stats API and the click-worker/store path. Preserve Owner create API's exact identity/settings/purpose. Describe remaining analytics loss/duplication and cache freshness as unresolved obligations." +
      context,
    seed: () => tinySeed(true),
    protectedIds: ["shorten", "url-cache", "stats-api"],
    obligations: [
      { id: "redirect-analytics", terms: ["analytics", "redirect"] },
      { id: "freshness-and-access", terms: ["freshness", "cache"] },
    ],
    alternatives:
      "Removing the CDN is a supported topology repair; custom cacheRedirects settings have no installed editable consumer. Edge analytics would require an unsupported explicit contract and does not meet this fixture's every-redirect-at-publisher requirement.",
  },
  {
    id: "tinyurl-unsupported-edit",
    domain: "tinyurl",
    task: "edit",
    heldOut: true,
    prompt:
      "Held-out change: add a custom route/schema editor and deploy verified exactly-once global click accounting across browser/edge caches. If unavailable, explicitly record that requested capability as unsupported and leave the design intact. Preserve Owner create API and every unrelated existing edit; a module called Exactly once is not an implementation." +
      context,
    seed: () => tinySeed(false),
    protectedIds: ["shorten", "url-cache", "stats-api"],
    obligations: [{ id: "unsupported-accounting", terms: ["exactly", "unsupported"] }],
    alternatives:
      "A refusal/review-only response with an explicit unresolved capability is the correct outcome. No deployment or runtime support exists.",
  },
];

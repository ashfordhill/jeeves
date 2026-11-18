import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** WD09: new input, independent of historical field apps. No completed product hooks implied. */
export function deploymentDesign() {
  return runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Find", system: { name: "Deployment inventory" } },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "front", name: "Front door", kind: "service" },
      linkId: "entry-front",
    },
    {
      type: "addTile",
      from: { tile: "front" },
      side: "after",
      tile: { id: "catalog", name: "Catalog API", kind: "service" },
      linkId: "front-catalog",
    },
    {
      type: "addTile",
      from: { tile: "catalog" },
      side: "after",
      tile: { id: "issuer", name: "Workload issuer", kind: "identity" },
      linkId: "catalog-issuer",
    },
    { type: "linkTiles", from: { tile: "front" }, to: "issuer", linkId: "front-issuer" },
    { type: "addModule", host: "front", id: "lookup", name: "Lookup", kind: "custom" },
    { type: "addModule", host: "catalog", id: "product", name: "Product", kind: "custom" },
    { type: "connectModule", module: "lookup", slot: "uses", target: { tile: "catalog" } },
    { type: "connectModule", module: "lookup", slot: "workload", target: { tile: "issuer" } },
    { type: "connectModule", module: "product", slot: "workload", target: { tile: "issuer" } },
    {
      type: "addTile",
      from: { tile: "catalog" },
      side: "after",
      tile: { id: "records", name: "Original records", kind: "database" },
      linkId: "catalog-records",
    },
    { type: "connectModule", module: "product", slot: "uses", target: { tile: "records" } },
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "timer", name: "Reconciler", kind: "worker" },
      linkId: "timer-entry",
    },
    { type: "shareOwner", worker: "timer", api: "catalog" },
    {
      type: "connectModule",
      module: "timer-scheduled-task",
      slot: "state",
      target: { tile: "records" },
    },
    {
      type: "addTile",
      from: { tile: "catalog" },
      side: "after",
      tile: { id: "copies", name: "Cached copies", kind: "cache" },
      linkId: "catalog-copies",
    },
    {
      type: "addModule",
      host: "catalog",
      id: "cached",
      name: "Cached product",
      kind: "cache-reader",
    },
    { type: "addModule", host: "catalog", id: "read", name: "Read original", kind: "data-access" },
    { type: "connectModule", module: "read", slot: "database", target: { tile: "records" } },
    { type: "connectModule", module: "cached", slot: "cache", target: { tile: "copies" } },
    { type: "connectModule", module: "cached", slot: "loader", target: { module: "read" } },
    {
      type: "editComponent",
      component: "cached",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        transport: "in-process",
      },
    },
    {
      type: "addTile",
      from: { tile: "catalog" },
      side: "after",
      tile: { id: "events", name: "Change events", kind: "queue" },
      linkId: "catalog-events",
    },
    {
      type: "edit",
      element: "events",
      settings: { kind: "queue", mode: "topic", provider: "unspecified" },
    },
    {
      type: "addTile",
      from: { tile: "events" },
      side: "after",
      tile: { id: "indexer", name: "Index worker", kind: "worker" },
      linkId: "events-indexer",
    },
    {
      type: "addTile",
      from: { tile: "indexer" },
      side: "after",
      tile: { id: "index", name: "Searchable products", kind: "search" },
      linkId: "indexer-index",
    },
    {
      type: "addModule",
      host: "indexer",
      id: "receive",
      name: "Receive change",
      kind: "event-consumer",
    },
    { type: "connectModule", module: "receive", slot: "channel", target: { tile: "events" } },
    {
      type: "addModule",
      host: "indexer",
      id: "project",
      name: "Project products",
      kind: "index-writer",
    },
    { type: "connectModule", module: "project", slot: "index", target: { tile: "index" } },
  ]);
}

/** Admission uses shared state that cannot be discarded like cached copies. */
export function deploymentAdmissionDesign() {
  return runStudioCommands(deploymentDesign(), [
    {
      type: "addTile",
      from: { tile: "catalog" },
      side: "after",
      tile: { id: "admission", name: "Shared admission", kind: "cache" },
      linkId: "catalog-admission",
    },
    { type: "addModule", host: "catalog", id: "auth", name: "Account guard", kind: "auth-guard" },
    { type: "connectModule", module: "auth", slot: "identity", target: { tile: "issuer" } },
    {
      type: "addModule",
      host: "catalog",
      id: "limit",
      name: "Admission limit",
      kind: "rate-limiter",
    },
    { type: "connectModule", module: "limit", slot: "store", target: { tile: "admission" } },
  ]);
}

/** Browser-only SQL mounts a product credential without reading it; maintenance still runs. */
export function deploymentBrowserDesign() {
  return runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "browser", name: "Browser API", kind: "service" },
      linkId: "browser-entry",
      system: { name: "Browser deployment facts" },
    },
    { type: "addModule", host: "browser", id: "login", kind: "browser-session" },
    {
      type: "addTile",
      from: { tile: "browser" },
      side: "after",
      tile: { id: "sessions", name: "Sessions", kind: "database" },
      linkId: "browser-state",
    },
    { type: "connectModule", module: "login", slot: "state", target: { tile: "sessions" } },
    {
      type: "addTile",
      from: { tile: "browser" },
      side: "after",
      tile: { id: "issuer", name: "Issuer", kind: "identity" },
      linkId: "browser-issuer",
    },
    { type: "connectModule", module: "login", slot: "identity", target: { tile: "issuer" } },
    { type: "setRunnableProcesses", on: true },
  ]);
}

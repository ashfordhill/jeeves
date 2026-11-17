import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import type { StudioCommand } from "../../../../jeeves/packages/spec/src/studio-operations.ts";

/** Application inputs for the independent native foundation checkpoint. */
export function foundationsDesign() {
  const commands: StudioCommand[] = [
    {
      type: "addAction",
      lane: "upload",
      name: "Exercise foundations",
      system: { name: "RG foundations" },
    },
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "gateway", name: "Gateway", kind: "uploads" },
      linkId: "entry-gateway",
    },
    {
      type: "addTile",
      from: { tile: "gateway" },
      side: "after",
      tile: { id: "items-api", name: "Items API", kind: "service" },
      linkId: "gateway-items",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "items-db", name: "Items database", kind: "database" },
      linkId: "api-database",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "admission", name: "Admission", kind: "cache" },
      linkId: "items-admission",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "records", name: "Records", kind: "cache" },
      linkId: "items-records",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "sign-in", name: "Sign in", kind: "identity" },
      linkId: "items-identity",
    },
    {
      type: "addTile",
      from: { tile: "gateway" },
      side: "after",
      tile: { id: "jobs", name: "Jobs", kind: "queue" },
      linkId: "gateway-jobs",
    },
    {
      type: "addTile",
      from: { tile: "jobs" },
      side: "after",
      tile: { id: "items-worker", name: "Items worker", kind: "worker" },
      linkId: "jobs-worker",
    },
    {
      type: "edit",
      element: "gateway",
      settings: {
        kind: "uploads",
        execution: "docker",
        language: "typescript",
        exposure: "public",
        transfer: "signed-url",
        requestTimeoutMs: 5000,
      },
    },
    {
      type: "edit",
      element: "items-api",
      settings: {
        kind: "service",
        execution: "docker",
        language: "typescript",
        exposure: "internal",
        requestTimeoutMs: 5000,
      },
    },
    {
      type: "edit",
      element: "records",
      settings: {
        kind: "cache",
        engine: "redis-compatible",
        provider: "unspecified",
        ttlSeconds: 10,
      },
    },
  ];
  for (const host of ["gateway", "items-api"]) {
    commands.push(
      { type: "addModule", host, id: `${host}-guard`, name: `${host} guard`, kind: "auth-guard" },
      {
        type: "connectModule",
        module: `${host}-guard`,
        slot: "identity",
        target: { tile: "sign-in" },
      },
    );
  }
  for (const [host, id, kind] of [
    ["gateway", "forward", "custom"],
    ["gateway", "published", "data-access"],
    ["items-api", "create", "data-access"],
    ["items-api", "slow", "custom"],
    ["items-api", "forbidden", "custom"],
    ["items-api", "read-record", "custom"],
    ["items-api", "record-reader", "cache-reader"],
    ["items-api", "record-source", "data-access"],
    ["items-api", "create-limit", "rate-limiter"],
    ["items-worker", "worker-access", "custom"],
  ] as const)
    commands.push({ type: "addModule", host, id, name: id, kind });
  for (const module of ["forward"]) {
    commands.push(
      { type: "connectModule", module, slot: "uses", target: { tile: "items-api" } },
      { type: "connectModule", module, slot: "workload", target: { tile: "sign-in" } },
    );
  }
  for (const module of ["create", "slow", "forbidden", "read-record"])
    commands.push({ type: "connectModule", module, slot: "workload", target: { tile: "sign-in" } });
  for (const module of ["create", "record-source", "published"])
    commands.push({
      type: "connectModule",
      module,
      slot: "database",
      target: { tile: "items-db" },
    });
  commands.push({
    type: "connectModule",
    module: "slow",
    slot: "uses",
    target: { tile: "items-db" },
  });
  commands.push(
    { type: "shareOwner", worker: "items-worker", api: "items-api" },
    { type: "connectModule", module: "worker-access", slot: "uses", target: { tile: "items-db" } },
    {
      type: "connectModule",
      module: "record-reader",
      slot: "loader",
      target: { module: "record-source" },
    },
    { type: "connectModule", module: "record-reader", slot: "cache", target: { tile: "records" } },
    {
      type: "editComponent",
      component: "record-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness: "versioned",
        transport: "in-process",
      },
    },
    {
      type: "connectModule",
      module: "read-record",
      slot: "read",
      target: { module: "record-reader" },
    },
    { type: "connectModule", module: "create-limit", slot: "store", target: { tile: "admission" } },
    {
      type: "editComponent",
      component: "create-limit",
      settings: {
        kind: "rate-limiter",
        algorithm: "sliding-window",
        key: "policy",
        store: "redis",
        limit: 2,
        windowSeconds: 60,
      },
    },
    {
      type: "connectModule",
      module: "create",
      slot: "admission",
      target: { module: "create-limit" },
    },
    {
      type: "setDatabaseAccess",
      role: "items-api",
      database: "items-db",
      product: {
        tables: [
          { name: "items", operations: ["SELECT", "INSERT"] },
          { name: "records", operations: ["SELECT"] },
        ],
        views: [],
      },
    },
    {
      type: "setDatabaseAccess",
      role: "items-worker",
      database: "items-db",
      product: { tables: [{ name: "items", operations: ["SELECT", "UPDATE"] }], views: [] },
    },
    {
      type: "setDatabaseAccess",
      role: "gateway",
      database: "items-db",
      product: { tables: [], views: ["visible_items"] },
    },
    { type: "setRunnableProcesses", on: true },
  );
  return runStudioCommands(emptyDesign(), commands);
}

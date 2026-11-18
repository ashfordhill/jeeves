/** Hand-reviewed from design.ts and the runtime contract, independent of the emitter.
 * Optional TLS/file/replay reads are included; timer has no local-operation/replay API. */
const database = [
  "JEEVES_DB_POOL_MAX",
  "JEEVES_DATABASE_RECORDS_CA_FILE",
  "JEEVES_DATABASE_RECORDS_HOST",
  "JEEVES_DATABASE_RECORDS_PORT",
  "JEEVES_DATABASE_RECORDS_TLS",
  "JEEVES_DATABASE_RECORDS_TLS_SERVERNAME",
];
const workload = [
  "JEEVES_WORKLOAD_ISSUER",
  "JEEVES_WORKLOAD_JWKS_URL",
  "JEEVES_WORKLOAD_SECRET_FILE",
  "JEEVES_WORKLOAD_TOKEN_URL",
];
const transport = ["JEEVES_REQUIRE_TLS", "NODE_TLS_REJECT_UNAUTHORIZED"];
const sorted = (names: string[]) => names.sort();
const http = { port: 3000, health: { live: "/livez", ready: "/readyz" } };
export const expectedDeployment = {
  version: 1,
  processes: [
    {
      id: "catalog",
      name: "Catalog API",
      kind: "service",
      exposure: "internal",
      ...http,
      alwaysOn: true,
      env: sorted([
        ...database,
        ...workload,
        ...transport,
        "SECRET_DIR",
        "JEEVES_CACHE_COPIES_CA_FILE",
        "JEEVES_CACHE_COPIES_HOST",
        "JEEVES_CACHE_COPIES_PORT",
        "JEEVES_CACHE_COPIES_TLS",
        "JEEVES_CACHE_COPIES_TLS_SERVERNAME",
        "JEEVES_SECRET_CACHE_COPIES_FILE",
        "JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE",
        "JEEVES_SECRET_PRODUCT_RECORDS__CATALOG_FILE",
        "JEEVES_SECRET_SQL_RECORDS__CATALOG_FILE",
        "JEEVES_SECRET_WORKLOAD_JEEVES_WORKLOAD_CATALOG_FILE",
      ]),
      uses: [
        { store: "copies", access: "read-write" },
        { store: "records", access: "read-write" },
      ],
      calls: [],
    },
    {
      id: "front",
      name: "Front door",
      kind: "service",
      exposure: "public",
      ...http,
      alwaysOn: false,
      env: sorted([
        "JEEVES_DB_POOL_MAX",
        ...workload,
        ...transport,
        "SECRET_DIR",
        "JEEVES_TILE_CATALOG_URL",
        "JEEVES_SECRET_WORKLOAD_JEEVES_WORKLOAD_FRONT_FILE",
      ]),
      uses: [],
      calls: ["catalog"],
    },
    {
      id: "indexer",
      name: "Index worker",
      kind: "worker",
      exposure: "internal",
      alwaysOn: true,
      env: [
        "JEEVES_BROKER_HOST",
        "JEEVES_BROKER_PORT",
        "JEEVES_DB_POOL_MAX",
        "JEEVES_SECRET_BROKER_PASSWORD_FILE",
        "SECRET_DIR",
      ],
      uses: [
        { store: "events", access: "consume" },
        { store: "index", access: "write" },
      ],
      calls: [],
    },
    {
      id: "timer",
      name: "Reconciler",
      kind: "worker",
      exposure: "internal",
      alwaysOn: true,
      env: sorted([
        ...database,
        ...transport,
        "SECRET_DIR",
        "JEEVES_SECRET_PRODUCT_RECORDS__TIMER_FILE",
        "JEEVES_SECRET_SQL_RECORDS__TIMER_FILE",
      ]),
      uses: [{ store: "records", access: "read-write" }],
      calls: [],
    },
  ],
  stores: [
    {
      id: "copies",
      name: "Cached copies",
      kind: "cache",
      role: "rebuildable",
      whenLost:
        "Losing this store discards cached copies; the installed reader can refill them from its original source.",
    },
    {
      id: "events",
      name: "Change events",
      kind: "queue",
      role: "original",
      whenLost:
        "Losing this channel can lose accepted deliveries and failed work; restore its durable state before claiming recovery.",
    },
    {
      id: "index",
      name: "Searchable products",
      kind: "search",
      role: "original",
      whenLost:
        "Losing this index loses its searchable state; event delivery alone does not guarantee a complete rebuild from an original source.",
    },
    {
      id: "records",
      name: "Original records",
      kind: "database",
      role: "original",
      whenLost:
        "Losing this store loses original product or protected runtime state and requires recovery before normal operation can resume.",
    },
  ],
  identity: {
    env: sorted([
      ...workload,
      ...transport,
      "SECRET_DIR",
      "JEEVES_SECRET_WORKLOAD_JEEVES_WORKLOAD_CATALOG_FILE",
      "JEEVES_SECRET_WORKLOAD_JEEVES_WORKLOAD_FRONT_FILE",
    ]),
  },
};

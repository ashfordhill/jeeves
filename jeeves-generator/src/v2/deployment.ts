import type { NormalizedGeneration } from "@jeeves/spec";
import { jsonFile, refuse } from "../json.ts";
import { stubClients } from "./client-wiring.ts";
import { httpMounts } from "./http-wiring.ts";
import { endpointId, localEndpoints, type V2LocalContribution } from "./local-contract.ts";
import { loopMounts } from "./loop-wiring.ts";
import { v2Compare } from "./registry.ts";

type Service = NonNullable<V2LocalContribution["services"]>[number];
/** The foundation's actual selected resources and runtime credentials, never hook declarations. */
export type DeploymentResource = {
  id: string;
  kind: string;
  users: readonly { host: string; access?: string; channel?: string }[];
};
type Runtime = { service: Service; secrets: readonly string[] };
const unique = (values: readonly string[]) => [...new Set(values)].sort(v2Compare);
const secretVariable = (name: string) =>
  `JEEVES_SECRET_${name.toUpperCase().replace(/[-.]/g, "_")}_FILE`;
const tls = ["JEEVES_REQUIRE_TLS", "NODE_TLS_REJECT_UNAUTHORIZED"];
const workloadEnv = [
  "JEEVES_WORKLOAD_ISSUER",
  "JEEVES_WORKLOAD_JWKS_URL",
  "JEEVES_WORKLOAD_SECRET_FILE",
  "JEEVES_WORKLOAD_TOKEN_URL",
];

/** Names the installed runtime can read, including optional transport and credential locations.
 * Application settings/conditional work are deliberately not evaluated during export. */
function environment(model: NormalizedGeneration, runtime: Runtime) {
  const { service, secrets } = runtime;
  const process = model.processes?.find((p) => p.tile === service.host);
  const selections = model.selections.filter((s) => s.host === service.host);
  // Compose mounts a product credential for template-owned writers too. Only product clients
  // and cache loaders read it; a mounted secret alone is not an environment reader.
  const readSecrets = secrets.filter((secret) => {
    if (!process || !secret.startsWith("product-")) return true;
    const resource = secret.slice("product-".length, -`--${service.host}`.length);
    return (
      process.stubs.some((s) =>
        s.stores?.some((r) => r.kind === "database" && r.element === resource),
      ) ||
      selections.some(
        (s) =>
          s.binding.kind === "positive-cache-read" &&
          s.resources.some((r) => r.field === "source" && r.identity.local === resource),
      )
    );
  });
  const names = Object.keys(localEndpoints(service)).filter(
    (name) => name !== "METADATA_SERVER_DETECTION",
  );
  names.push(...Object.keys(service.environment ?? {}));
  for (const [kind, ids] of [
    ["DATABASE", service.sql ?? []],
    ["CACHE", service.cache ?? []],
  ] as const)
    for (const id of ids)
      names.push(
        `JEEVES_${kind}_${endpointId(id)}_CA_FILE`,
        `JEEVES_${kind}_${endpointId(id)}_TLS_SERVERNAME`,
      );
  if (
    service.sql?.length ||
    service.cache?.length ||
    service.calls?.length ||
    service.external?.length ||
    service.issuer ||
    service.identity ||
    service.pubsub ||
    process?.workload
  )
    names.push(...tls);
  // Match the actual shared import surfaces. Merely having a database in another process
  // does not load Postgres in a process that imports no clients or template constructors.
  const processes = model.processes ?? [];
  const sharedSqlClients = processes.some((p) =>
    stubClients(p, model.selections, processes).sections.has("database"),
  );
  const importsClients =
    !!process &&
    !!stubClients(process, model.selections, processes).mount?.imports.some(
      (item) => item.from === "../runtime/module-clients.ts",
    );
  const sharedSqlConstructors = model.selections.some(
    (s) =>
      s.binding.kind !== "module-stub" &&
      s.resources.some((r) => ["state", "source", "items", "counts"].includes(r.field)),
  );
  const importsConstructors =
    !process ||
    [
      ...(process.shape === "http" ? httpMounts(process, model.selections, processes) : []),
      ...loopMounts(process, model.selections),
    ].some((mount) => !!mount.template);
  if (
    service.sql?.length ||
    (sharedSqlClients && importsClients) ||
    (sharedSqlConstructors && importsConstructors)
  )
    names.push("JEEVES_DB_POOL_MAX");
  if (service.identity) names.push("OIDC_AUDIENCE", "OIDC_ISSUER", "OIDC_JWKS_URL");
  if (process?.workload) names.push(...workloadEnv);
  if (process?.frontDoor) names.push("JEEVES_EDGE_STAMP_KEY", "JEEVES_EDGE_STAMP_KEY_PREVIOUS");
  names.push(...(service.external ?? []).map((id) => `JEEVES_EXTERNAL_${endpointId(id)}_URL`));
  if (readSecrets.length) names.push("SECRET_DIR", ...readSecrets.map(secretVariable));
  for (const selection of selections) {
    const module =
      selection.target.kind === "component" ? selection.target.component : selection.id;
    if (selection.binding.kind === "browser-session") {
      const prefix = `JEEVES_BROWSER_${endpointId(module)}`;
      names.push(
        `${prefix}_CALLBACK`,
        `${prefix}_AUDIENCE`,
        `JEEVES_BROWSER_IDENTITY_${endpointId(selection.identity?.element ?? "")}_ISSUER`,
        secretVariable(`${prefix}_KEYS`),
        secretVariable(`${prefix}_CLIENT_SECRET`),
        "SECRET_DIR",
        "NODE_TLS_REJECT_UNAUTHORIZED",
      );
    }
    if (selection.binding.kind === "webhook-receiver")
      names.push(secretVariable(`JEEVES_WEBHOOK_${endpointId(module)}_KEYS`), "SECRET_DIR");
  }
  // A write-capable stub may opt into secret-bearing replay. The ring is read only then.
  if (
    process?.stubs.some(
      (stub) =>
        stub.role === "route" &&
        stub.stores?.some((s) => s.kind === "database" && s.access !== "read"),
    )
  )
    names.push(secretVariable("JEEVES_REPLAY_KEYS"), "SECRET_DIR");
  return unique(names);
}

const loss: Record<string, { original: string; rebuildable: string }> = {
  database: {
    original:
      "Losing this store loses original product or protected runtime state and requires recovery before normal operation can resume.",
    rebuildable:
      "Rebuild this store from its declared original source before normal operation resumes.",
  },
  cache: {
    original:
      "Losing this store loses coordination or application state; do not resume admission or assume that resetting it preserves guarantees.",
    rebuildable:
      "Losing this store discards cached copies; the installed reader can refill them from its original source.",
  },
  search: {
    original:
      "Losing this index loses its searchable state; event delivery alone does not guarantee a complete rebuild from an original source.",
    rebuildable:
      "Rebuild this index from its declared original source before serving complete search results.",
  },
  queue: {
    original:
      "Losing this channel can lose accepted deliveries and failed work; restore its durable state before claiming recovery.",
    rebuildable: "Rebuild this channel from its declared original source before delivery resumes.",
  },
  pubsub: {
    original:
      "Losing this channel can lose accepted deliveries; the local emulator does not preserve messages across restart.",
    rebuildable: "Rebuild this channel from its declared original source before delivery resumes.",
  },
  "object-store": {
    original:
      "Losing this store loses object contents; recover them before operations that depend on those objects resume.",
    rebuildable: "Rebuild these objects from their declared original source before serving them.",
  },
};

export function deploymentFiles(
  model: NormalizedGeneration,
  resources: readonly DeploymentResource[],
  runtimes: readonly Runtime[],
) {
  const stores = resources
    .map((resource) => {
      const bindings = model.selections.flatMap((s) =>
        s.resources
          .filter((r) => r.identity.local === resource.id)
          .map((r) => ({ selection: s, resource: r })),
      );
      // Cache is a physical kind, not a durability promise. Admission and unknown custom state
      // must survive loss; only the installed source-backed positive reader promises refill.
      const rebuildable =
        resource.kind === "cache" &&
        bindings.length > 0 &&
        bindings.every(({ selection }) => selection.binding.kind === "positive-cache-read") &&
        !(model.processes ?? []).some((p) =>
          p.stubs.some((s) => s.stores?.some((r) => r.element === resource.id)),
        );
      const role = rebuildable ? ("rebuildable" as const) : ("original" as const);
      const impact = loss[resource.kind];
      if (!impact)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          resource.id,
          "Deployment store needs a known loss policy.",
        );
      const name =
        bindings[0]?.resource.name ??
        model.processes
          ?.flatMap((p) => p.stubs.flatMap((s) => [...(s.stores ?? []), ...(s.consumes ?? [])]))
          .find((r) => r.element === resource.id)?.name ??
        resource.id;
      return {
        id: resource.id,
        name,
        kind: resource.kind,
        role,
        whenLost: impact[role],
      };
    })
    .sort((a, b) => v2Compare(a.id, b.id));
  const processes = runtimes
    .map((runtime) => {
      const { service } = runtime;
      const process = model.processes?.find((p) => p.tile === service.host);
      const selections = model.selections.filter((s) => s.host === service.host);
      const http = process ? process.shape === "http" : !!service.http;
      const uses = resources
        .flatMap((r) =>
          r.users
            .filter((u) => u.host === service.host)
            .map((u) => ({ store: r.id, access: u.channel ?? u.access ?? "read" })),
        )
        .filter(
          (u, i, all) => all.findIndex((v) => v.store === u.store && v.access === u.access) === i,
        )
        .sort((a, b) => v2Compare(`${a.store}/${a.access}`, `${b.store}/${b.access}`));
      return {
        id: service.host,
        name: process?.name ?? service.host,
        kind: http ? ("service" as const) : ("worker" as const),
        exposure:
          process?.exposure ??
          (http && selections.some((s) => s.inputs["host.exposure"] === "public")
            ? ("public" as const)
            : ("internal" as const)),
        ...(http && { port: 3000, health: { live: "/livez", ready: "/readyz" } }),
        alwaysOn:
          !!process?.stubs.some((s) => s.role === "scheduled-task" || s.role === "loop") ||
          !!process?.stubs.some((s) =>
            s.stores?.some((r) => r.kind === "database" && r.access !== "read"),
          ) ||
          selections.some((s) =>
            [
              "owned-multipart",
              "browser-session",
              "asset-lifecycle",
              "video-hls",
              "event-counter",
              "search-projection",
              "scheduled-task",
              "webhook-receiver",
            ].includes(s.binding.kind),
          ),
        ...(process?.frontDoor && {
          frontDoor: {
            header: "x-edge-stamp",
            keyEnv: "JEEVES_EDGE_STAMP_KEY",
            previousKeyEnv: "JEEVES_EDGE_STAMP_KEY_PREVIOUS",
            maxAgeSeconds: 60,
          },
        }),
        env: environment(model, runtime),
        uses,
        calls: unique(service.calls ?? []),
      };
    })
    .sort((a, b) => v2Compare(a.id, b.id));
  const identity = (model.processes ?? []).some((p) => p.serviceCalls?.length)
    ? {
        identity: {
          env: unique([
            ...workloadEnv,
            ...tls,
            "SECRET_DIR",
            ...(model.processes ?? []).flatMap((p) =>
              p.workload ? [secretVariable(`workload-${p.workload.client}`)] : [],
            ),
          ]),
        },
      }
    : {};
  const contract = { version: 1 as const, processes, stores, ...identity };
  const code = (text: string) =>
    `\`${text.replaceAll("`", "&#96;").replace(/[\p{Cc}\u2028\u2029]/gu, " ")}\``;
  const label = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replace(/[\p{Cc}\u2028\u2029]/gu, " ");
  const nodes = [
    ...processes.map((p, i) => ({
      id: p.id,
      node: `p${i}`,
      anchor: `process-${p.id}`,
      name: p.name,
    })),
    ...stores.map((s, i) => ({ id: s.id, node: `s${i}`, anchor: `store-${s.id}`, name: s.name })),
  ];
  const node = (anchor: string) => {
    const found = nodes.find((n) => n.anchor === anchor);
    if (!found)
      refuse("INVALID_LOCAL_CONTRIBUTION", anchor, "Deployment arrows require an emitted node.");
    return found.node;
  };
  const processNode = (id: string) => node(`process-${id}`);
  const storeNode = (id: string) => node(`store-${id}`);
  const list = (values: readonly string[]) =>
    values.length ? values.map(code).join(", ") : "none";
  const readme = [
    "# Deployment contract",
    "",
    "Generated from installed templates and the normalized design. Regenerate these scaffolds; application hooks cannot extend this inventory.",
    "",
    "This describes application processes and their selected stores, not provisioning. Environment lists contain names only, including optional reads; they are not a list of values to set. Setup tools, third-party SDK environment conventions and application-owned settings are outside this inventory. Inspect each module's settings declaration and product code before deployment; export does not execute them.",
    "",
    "alwaysOn conservatively includes generated consumers, background work and write-capable modules whose compiled runtime can start application-declared durable work, receipt maintenance or replay cleanup. Export does not inspect whether a hook enables those capabilities. A false value does not certify arbitrary handwritten behavior. Search events do not establish an original-source rebuild mechanism. Unknown application state is conservatively original.",
    "",
    ...processes.flatMap((p) => [
      `## Process ${p.id}`,
      "",
      `- Name: ${code(p.name)}`,
      `- Kind: ${code(p.kind)}`,
      `- Exposure: ${code(p.exposure)}`,
      ...(p.health
        ? [
            `- HTTP port: ${p.port}`,
            `- Health: live ${code(p.health.live)}, ready ${code(p.health.ready)}`,
          ]
        : []),
      ...(p.frontDoor
        ? [
            "- Front door: require x-edge-stamp v1 HMAC-SHA256 over seconds.METHOD.path (without query), within ±60 seconds; configure JEEVES_EDGE_STAMP_KEY and optionally JEEVES_EDGE_STAMP_KEY_PREVIOUS. Exact health paths and compiled workload-authenticated internal routes retain their own authentication. The stamp grants no user or workload authority.",
          ]
        : []),
      `- alwaysOn: ${p.alwaysOn}`,
      `- Environment names: ${list(p.env)}`,
      `- Uses: ${p.uses.length ? p.uses.map((u) => `${code(u.store)} (${code(u.access)})`).join(", ") : "none"}`,
      `- Calls: ${list(p.calls)}`,
      "- Source folder: [processes](../src/processes/)",
      "",
    ]),
    ...stores.flatMap((s) => [
      `## Store ${s.id}`,
      "",
      `- Name: ${code(s.name)}`,
      `- Kind: ${code(s.kind)}`,
      `- Role: ${code(s.role)}`,
      `- When lost: ${s.whenLost}`,
      `- Source folder: [infrastructure](../infra/${s.kind === "database" ? `postgres/${s.id}/` : ""})`,
      "",
    ]),
    ...(contract.identity
      ? [
          "## Workload identity",
          "",
          "The issuer is the identity service answering the configured token and key endpoints. Tokens must still match JEEVES_WORKLOAD_ISSUER, the compiled audience, RS256 and the allowed caller claims.",
          "JEEVES_WORKLOAD_SECRET_FILE optionally names an absolute credential path, validated before clients open and read again for each new token request. Replace its contents to rotate at the next refresh. Without it, the existing per-client secret file is read once at startup. A later unreadable or invalid file fails like an issuer request; a still-valid cached token survives only until its existing expiry bound.",
          `Workload identity environment names: ${list(contract.identity.env)}`,
          "",
        ]
      : []),
    "```mermaid",
    "flowchart LR",
    ...nodes.map((n) => `  ${n.node}["${label(n.name)}"]`),
    ...processes.flatMap((p) => [
      ...p.uses.map(
        (u) =>
          `  ${processNode(p.id)} ${["publish", "consume"].includes(u.access) ? "-.->" : "-->"}|${u.access}| ${storeNode(u.store)}`,
      ),
      ...p.calls.map((target) => `  ${processNode(p.id)} --> ${processNode(target)}`),
    ]),
    ...nodes.map((n) => `  click ${n.node} "#${n.anchor}"`),
    "```",
    "",
  ].join("\n");
  return { contract: jsonFile(contract), readme };
}

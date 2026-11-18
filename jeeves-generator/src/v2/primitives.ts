import { generationCapabilities, generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import { type ClientSection, stubClients } from "./client-wiring.ts";
import { durableKinds } from "./durability.ts";
import { type V2Emitter, v2Compare } from "./registry.ts";

const assets = "jeeves-generator/templates/local-v2/assets/src/runtime/";
const clientLibraries: Record<ClientSection, string[]> = {
  // A stub's database client runs its transactions through transaction.ts (QL03) and its
  // idempotent calls on the records in idempotency.ts (QL04).
  database: [
    "postgres",
    "transaction",
    "idempotency",
    "local-operation",
    "product-mutation",
    "durable-work",
    "work-integration",
    "receipt-consumer",
    "receipts",
    "durable-sql",
    "delivery",
  ],
  // The broker's endpoint alone needs no library: its publisher and loops bring theirs.
  broker: [],
  queue: ["delivery", "amqp"],
  // The Pub/Sub publisher and a loop's subscriber use the official client in module-clients.ts
  // itself; the subscriber's loop brings the delivery runner's library.
  pubsub: [],
  "pubsub-loop": [],
  cache: ["valkey"],
  objects: ["objects"],
  search: ["search"],
  http: [],
};

/** Dependency libraries install no user-facing feature or application hook. */
export function createLocalRuntimePrimitives(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.primitives",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Reusable HTTP, verified identity, confirmed messaging and resource clients only.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const modules = new Map<string, Set<string>>([["operation", new Set(["/generation"])]]);
      const add = (names: string[], path: readonly (string | number)[]) => {
        for (const name of names) {
          const paths = modules.get(name) ?? new Set<string>();
          paths.add(`/${path.map((part) => pointerPart(String(part))).join("/")}`);
          modules.set(name, paths);
        }
      };
      // An HTTP process serves through the shared HTTP service, with or without a template, and a
      // loop stub consumes through the shared consumer.
      // A stub's clients use the libraries of the stores it is provisioned (tile process contract,
      // section 6); its cache client uses the cache read's bounded client, valkey.ts.
      for (const process of model.processes ?? []) {
        if (process.workload)
          add(["admission", "http", "work-integration"], ["generation", "processes"]);
        if (process.shape === "http") add(["admission", "http"], ["generation", "processes"]);
        if (process.stubs.some((stub) => stub.consumes?.length))
          add(["delivery", "amqp"], ["generation", "processes"]);
        for (const section of stubClients(process, model.selections, model.processes ?? [])
          .sections)
          add(clientLibraries[section], ["generation", "processes"]);
      }
      // A cache read's emitter (local.positive-cache) writes valkey.ts beside its reader, and a
      // stub's cache client then uses that same file.
      if (model.selections.some((selection) => selection.binding.kind === "positive-cache-read"))
        modules.delete("valkey");
      // Likewise local.durability writes transaction.ts for its templates, and a stub's database
      // client then uses that same file.
      if (
        model.processes?.length &&
        model.selections.some((s) => s.binding.kind === "positive-cache-read")
      )
        add(["transaction"], ["generation", "processes"]);
      if (model.selections.some((selection) => durableKinds.includes(selection.binding.kind)))
        modules.delete("transaction");
      if (model.selections.some((selection) => durableKinds.includes(selection.binding.kind)))
        modules.delete("durable-sql");
      if (
        model.selections.some(
          (selection) =>
            durableKinds.includes(selection.binding.kind) && selection.binding.kind !== "favorites",
        )
      ) {
        modules.delete("receipts");
      }
      if (model.selections.some((s) => s.binding.kind === "webhook-receiver"))
        add(["webhook"], ["generation", "processes"]);
      if (model.selections.some((s) => s.binding.kind === "browser-session"))
        add(
          ["browser-session", "browser-settings", "browser-oidc", "transaction"],
          ["generation", "processes"],
        );
      for (const selection of model.selections) {
        if ("host.requestTimeoutMs" in selection.inputs)
          add(["admission", "http"], selection.sourcePath);
        if (selection.identity) add(["identity"], selection.sourcePath);
        for (const resource of selection.resources) {
          const kind = generationCapabilities[selection.binding.kind].resources.find(
            (requirement) => requirement.field === resource.field,
          )?.kind;
          const names =
            kind === "cache" && selection.binding.kind === "rate-limiter"
              ? ["valkey"]
              : kind === "database"
                ? ["postgres"]
                : kind === "queue"
                  ? ["delivery", "amqp"]
                  : kind === "object-store"
                    ? ["objects"]
                    : kind === "search"
                      ? ["search"]
                      : [];
          add(names, resource.sourcePath);
        }
      }
      if (model.selections.some((selection) => selection.binding.kind === "positive-cache-read"))
        modules.delete("valkey");
      return {
        gaps: model.selections
          .filter((s) => s.binding.kind === "browser-session")
          .map((s) => ({
            id: `browser-issuer-${s.id}`,
            status: "custom" as const,
            required: true,
            sourcePaths: [`/${s.sourcePath.join("/")}`],
            description: `Configure selected Keycloak Identity ${s.identity?.element} through a trusted HTTPS issuer at /realms/${s.identity?.element}, register confidential code+S256 client jeeves-browser-${s.host}-${s.target.kind === "component" ? s.target.component : s.id} with the exact HTTPS callback, and mount its private client secret/RG08 ring. Plain-HTTP local Keycloak/edge defaults cannot provide secure browser sessions. No production TLS bypass, automatic issuer provisioning or refresh/forwarding is claimed; see .jeeves/extensions.md.`,
          })),
        files: [...modules]
          .sort(([a], [b]) => v2Compare(a, b))
          .map(([name, paths]) => ({
            path: `src/runtime/${name}.ts`,
            content: asset(`${assets}${name}.ts${name === "durable-sql" ? "" : ".template"}`),
            ownership: "generated-scaffold" as const,
            sourcePaths: [...paths].sort(),
          })),
      };
    },
  };
}

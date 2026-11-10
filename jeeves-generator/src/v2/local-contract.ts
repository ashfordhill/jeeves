import {
  generationLocalIdentity,
  type NormalizedProcess,
  type NormalizedStubStore,
} from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import { type V2Gap, type V2RenderContext, v2Compare } from "./registry.ts";

/** Trusted template contributions, never accepted from saved design JSON. Each shared file
 * has one foundation writer; the contributor's captured source closure supplies provenance. */
export type V2LocalContribution = {
  /** Every contribution must identify actual selected declarations, not descriptor defaults. */
  sourcePaths: readonly string[];
  migrations?: readonly { resource: string; id: string; sql: string }[];
  /** Runtime users get CONNECT/USAGE only until explicit relation grants are contributed. */
  logins?: readonly { resource: string; host: string }[];
  views?: readonly { resource: string; schema?: string; name: string; selectSql: string }[];
  grants?: readonly {
    resource: string;
    host: string;
    schema?: string;
    relation: string;
    kind: "table" | "view";
    privileges: readonly ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[];
  }[];
  /** Default durable topology comes from normalized channels. Topic subscribers must name a
   * selected consuming host; no arbitrary exchange/router language. */
  broker?: readonly { resource: string; host: string }[];
  storage?: readonly { resource: string; host: string; corsPut?: boolean }[];
  search?: readonly {
    resource: string;
    version: number;
    properties: Readonly<
      Record<
        string,
        { type: "keyword" | "text" | "integer" | "long" | "double" | "date"; index?: boolean }
      >
    >;
  }[];
  /** Application authorization vocabulary belongs to its compiled adapter, not the vendor. */
  identityRoles?: readonly { element: string; roles: readonly string[] }[];
  /** The public edge (tile process contract, section 2): `app-edge` routes `/api/<host>/` to
   * `app-<host>:3000/` for each public HTTP process host, and owns the single HTTP port. */
  edge?: readonly { host: string }[];
  services?: readonly {
    host: string;
    command: readonly string[];
    /** A real later HTTP emitter can expose this host through the reserved HTTP slot. */
    http?: boolean;
    identity?: string;
    dependsOn: readonly string[];
    sql?: readonly string[];
    storage?: readonly string[];
    broker?: boolean;
    cache?: readonly string[];
    target?: "app" | "media";
    environment?: Readonly<Record<string, string>>;
    readiness?: boolean;
  }[];
};
export type V2LocalContributor = (context: V2RenderContext) => V2LocalContribution | undefined;

type Path = readonly (string | number)[];
const pointer = (path: Path) => `/${path.map((part) => pointerPart(String(part))).join("/")}`;
/** The local value a stub's store runs as: the derivation's fixed one (module authoring contract,
 * section 5). A queue and object storage have no engine. */
const localEngines: Partial<Record<NormalizedStubStore["kind"], [string, string]>> = {
  database: ["postgresql", "PostgreSQL"],
  cache: ["redis-compatible", "Valkey"],
  search: ["opensearch", "OpenSearch"],
};
const nouns: Record<NormalizedStubStore["kind"], string> = {
  database: "database",
  cache: "cache",
  queue: "queue",
  "object-store": "object storage",
  search: "search index",
};
/**
 * Why a stub's store isn't provisioned locally, or undefined when it is (tile process contract,
 * section 6): its saved provider must be unspecified or self-hosted, and its engine unspecified or
 * the local one (PostgreSQL, Valkey, OpenSearch; Garage and RabbitMQ have none). Any other saved
 * value is a required `unsupported` gap.
 */
export function stubUnsupported(store: {
  kind: NormalizedStubStore["kind"];
  name: string;
  provider: string;
  engine?: string;
}): string | undefined {
  const noun = nouns[store.kind];
  if (store.provider !== "unspecified" && store.provider !== "self-hosted")
    return `${store.name} uses the ${store.provider} provider; a stub's ${noun} is provisioned locally only when its provider is unspecified or self-hosted.`;
  const local = localEngines[store.kind];
  if (local && store.engine && store.engine !== "unspecified" && store.engine !== local[0])
    return `${store.name} uses the ${store.engine} engine; a stub's ${noun} is provisioned locally only as ${local[1]}, with its engine unspecified or ${local[0]}.`;
  return undefined;
}
/** The local runtime login of a stub's (or template's) tile on a database, and that database. */
export const localDatabase = (resource: string) => `d_${generationLocalIdentity(resource).sql}`;
export const localLogin = (resource: string, host: string) =>
  `r_${generationLocalIdentity(resource).sql}__${generationLocalIdentity(host).sql}`;

/**
 * One store or channel a tile's stubs use (tile process contract, section 6): its provider
 * resource, the widest access among the stubs' links (MA05's grant rule, without its writes), the
 * stubs that use it and their links. A queue is one row per channel: published or consumed.
 */
export type StubStore = {
  resource: string;
  element: string;
  name: string;
  kind: NormalizedStubStore["kind"];
  access: "read" | "write" | "read-write" | "publish" | "consume";
  boundary?: "published-read";
  mode?: "work-queue" | "topic";
  /** Object storage saved as public: its bucket serves a local website. */
  public?: true;
  modules: string[];
  sourcePaths: string[];
  /** Why it isn't provisioned: its saved provider or engine isn't the local one. */
  unsupported?: string;
};
const widest = (a: StubStore["access"], b: StubStore["access"]) => (a === b ? a : "read-write");
/**
 * Every store and channel a process's stubs link to, sorted by resource and channel, and a
 * required `unsupported` gap (`provider-<module>-<tile>`) for each link to one that isn't
 * provisioned. Worked out from the resolver's facts; nothing is written to ownership.
 */
export function stubStores(process: NormalizedProcess): { stores: StubStore[]; gaps: V2Gap[] } {
  const rows = new Map<string, StubStore>();
  const gaps = new Map<string, V2Gap>();
  for (const stub of process.stubs) {
    const links = [
      ...(stub.consumes ?? []).map((queue) => ({
        ...queue,
        kind: "queue" as const,
        access: "consume" as const,
        boundary: undefined,
        engine: undefined,
        objects: undefined,
      })),
      ...(stub.stores ?? []),
    ];
    for (const link of links) {
      const unsupported = stubUnsupported(link);
      const gap = `provider-${stub.selection}-${link.element}`;
      if (unsupported && !gaps.has(gap))
        gaps.set(gap, {
          id: gap,
          required: true,
          status: "unsupported",
          description: unsupported,
          sourcePaths: [pointer(link.sourcePath)],
        });
      const queue = link.kind === "queue";
      const key = queue ? `${link.element}\u0000${link.access}` : link.element;
      const prior = rows.get(key);
      if (prior) {
        if (!queue) prior.access = widest(prior.access, link.access);
        if (!prior.modules.includes(stub.module)) prior.modules.push(stub.module);
        prior.sourcePaths.push(pointer(link.sourcePath));
        continue;
      }
      rows.set(key, {
        resource: generationLocalIdentity(link.element).local,
        element: link.element,
        name: link.name,
        kind: link.kind,
        access: link.access,
        ...(link.boundary && { boundary: link.boundary }),
        ...(link.mode && { mode: link.mode }),
        ...(link.objects === "public" && { public: true as const }),
        modules: [stub.module],
        sourcePaths: [pointer(link.sourcePath)],
        ...(unsupported && { unsupported }),
      });
    }
  }
  const stores = [...rows.values()].sort((a, b) =>
    v2Compare(`${a.resource}\u0000${a.access}`, `${b.resource}\u0000${b.access}`),
  );
  return { stores, gaps: [...gaps.values()] };
}

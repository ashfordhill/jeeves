/**
 * Which kinds may link, in which mode, and the connection a new link gets. One table serves the
 * canvas, chat and validation. `sync` is a request (a solid `+` line); `async` is a call that does
 * not wait (a dashed `---` line). Resources are end tiles. Browser apps take no links: the actor is
 * the client.
 */
import { type StudioKind, studioResourceKinds } from "./studio-model.ts";
import type { StudioConnectionCreation } from "./studio-operations.ts";
import { studioTileDefinitions } from "./studio-tiles.ts";

export type StudioLinkMode = "sync" | "async";
export type StudioLinkDefaults = Omit<StudioConnectionCreation, "id" | "from" | "to">;
/** A refusal names the rule in plain words, ready for a notice or a chat reply. */
export type StudioLinkResult =
  | { ok: true; value: StudioLinkDefaults }
  | { ok: false; message: string };

/** The caps on branching. Raise them here, and only here, if a realistic design needs more. */
export const laneLimits = { entriesPerLane: 3, outgoingLinks: 4 } as const;

/** Kinds the actor may link to directly (lane entries): any Service except a worker, any API. */
export const studioEntryKinds = [
  "service",
  "redirect",
  "identity",
  "notification",
  "billing",
  "gateway",
  "cdn",
  "object-store",
  "external-api",
] as const satisfies readonly StudioKind[];

/** "Application" in the link rules: the Service and API kinds except the CDN. */
const applications: ReadonlySet<StudioKind> = new Set(
  [...studioTileDefinitions.service.kinds, ...studioTileDefinitions.api.kinds].filter(
    (kind) => kind !== "cdn",
  ),
);
const endTiles: ReadonlySet<StudioKind> = new Set(
  studioResourceKinds.filter((kind) => kind !== "queue"),
);

const nouns: Record<StudioKind, string> = {
  service: "a service",
  browser: "a browser app",
  worker: "a worker",
  billing: "a billing service",
  redirect: "a redirect service",
  notification: "a notification service",
  identity: "an identity service",
  gateway: "a gateway",
  database: "a database",
  cache: "a cache",
  queue: "a queue",
  "object-store": "object storage",
  search: "a search index",
  cdn: "a CDN",
  "external-api": "an external API",
};
/** A kind in plain words, with its article: "a cache", "object storage". */
export const studioKindNoun = (kind: StudioKind): string => nouns[kind];
const noun = studioKindNoun;
const Noun = (kind: StudioKind) => noun(kind).charAt(0).toUpperCase() + noun(kind).slice(1);

const refuse = (message: string): StudioLinkResult => ({ ok: false, message });
const accept = (value: StudioLinkDefaults): StudioLinkResult => ({ ok: true, value });
const security = "Service identity" as const;
const channel = (use: "publish" | "consume") =>
  accept({
    kind: "depends-on",
    planned: {
      label: use === "publish" ? "Publishes" : "Consumes",
      protocol: "Messaging",
      interaction: "Asynchronous",
      security,
    },
    settings: { channelUse: use },
  });
const calls = (mode: StudioLinkMode) =>
  accept({
    kind: "calls",
    planned: {
      label: "Calls",
      protocol: "HTTPS",
      interaction: mode === "async" ? "Asynchronous" : "Request / response",
      security,
    },
    settings: {},
  });
const uses = () =>
  accept({
    kind: "depends-on",
    planned: { label: "Uses", protocol: "HTTPS", interaction: "Request / response", security },
    settings: {},
  });
const data = (target: "database" | "cache") =>
  accept({
    kind: "uses-database",
    planned: {
      label: "Reads & writes",
      protocol: target === "database" ? "SQL" : "Redis",
      interaction: "Request / response",
      security,
    },
    settings: {},
  });
const requestOnly = (target: StudioKind) =>
  refuse(`A link to ${noun(target)} is a request; it can't be asynchronous.`);

/**
 * The connection a `source → target` link gets in this mode, or why the link is refused. Queue
 * links are asynchronous only; links to data, storage, search and CDNs are requests only.
 */
export function studioLinkDefaults(
  source: StudioKind,
  target: StudioKind,
  mode: StudioLinkMode,
): StudioLinkResult {
  if (endTiles.has(source)) return refuse(`${Noun(source)} can't link onward.`);
  if (source === "browser" || target === "browser")
    return refuse("Browser apps take no links; the user is the client.");
  if (source === "queue") {
    if (!applications.has(target))
      return refuse(`A queue feeds only an application, not ${noun(target)}.`);
    if (mode === "sync")
      return refuse("A queue feeds an application asynchronously, not by request.");
    return channel("consume");
  }
  if (target === "queue") {
    if (!applications.has(source))
      return refuse(`Only an application publishes to a queue, not ${noun(source)}.`);
    if (mode === "sync") return refuse("Publishing to a queue is asynchronous, not a request.");
    return channel("publish");
  }
  if (source === "external-api") {
    if (!applications.has(target))
      return refuse(`An external API can only call an application, not ${noun(target)}.`);
    return calls(mode);
  }
  if (source === "cdn") {
    if (!applications.has(target) && target !== "object-store")
      return refuse(`A CDN fronts only an application or object storage, not ${noun(target)}.`);
    if (mode === "async") return requestOnly(target);
    return target === "object-store" ? uses() : calls("sync");
  }
  // The source is an application.
  if (target === "database" || target === "cache")
    return mode === "async" ? requestOnly(target) : data(target);
  if (target === "object-store" || target === "search" || target === "cdn")
    return mode === "async" ? requestOnly(target) : uses();
  return calls(mode);
}

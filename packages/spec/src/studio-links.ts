/**
 * Which tiles may link, in which mode, and the connection a new link gets: one table
 * (`studioLinkRules`) serves the canvas, chat and validation. `sync` is a request (a solid line);
 * `async` is a call that does not wait (a dashed line). Rows are by source role and target role;
 * a pair with no row is refused, and so is a mode the row does not allow, in plain words.
 * Stores are end tiles. Browser apps take no links: the user is the client.
 */
import type { ConnectionKind } from "./design.ts";
import type { StudioKind } from "./studio-model.ts";
import type { StudioConnectionCreation } from "./studio-operations.ts";
import { studioTileDefinitions } from "./studio-tiles.ts";

export type StudioLinkMode = "sync" | "async";
export const studioLinkModes = ["sync", "async"] as const satisfies readonly StudioLinkMode[];
export type StudioLinkDefaults = Omit<StudioConnectionCreation, "id" | "from" | "to">;
/** A refusal names the rule in plain words, ready for a notice or a chat reply. */
export type StudioLinkResult =
  | { ok: true; value: StudioLinkDefaults }
  | { ok: false; message: string };

/** The caps on branching. Raise them here, and only here, if a realistic design needs more. */
export const laneLimits = { entriesPerLane: 3, outgoingLinks: 4 } as const;

/**
 * The roles in the link table. `user` is the actor (lane entries); `application` is every
 * Service and API kind except the CDN; `store` is a database, search index, cache or object
 * storage.
 */
export const studioLinkRoles = [
  "user",
  "application",
  "cdn",
  "external",
  "queue",
  "store",
] as const;
export type StudioLinkRole = (typeof studioLinkRoles)[number];
/** A link's source: a tile's kind, or `"user"` for the actor's lane entries. */
export type StudioLinkSource = StudioKind | "user";

const applicationKinds: readonly StudioKind[] = [
  ...studioTileDefinitions.service.kinds,
  ...studioTileDefinitions.api.kinds,
].filter((kind) => kind !== "cdn");
const roleKinds: Record<StudioLinkRole, readonly StudioKind[]> = {
  user: [],
  application: applicationKinds,
  cdn: ["cdn"],
  external: ["external-api"],
  queue: ["queue"],
  store: ["database", "search", "cache", "object-store"],
};

/** A kind's role in the link table; `undefined` for `browser`, which takes no links. */
export function studioLinkRole(kind: StudioLinkSource): StudioLinkRole | undefined {
  if (kind === "user") return "user";
  return studioLinkRoles.find((role) => roleKinds[role].includes(kind));
}

/** The connection a new link of a row gets. Its interaction follows the mode. */
export type StudioLinkConnection = {
  kind: ConnectionKind;
  label: string;
  protocol: StudioLinkDefaults["planned"]["protocol"];
  settings?: StudioLinkDefaults["settings"];
};
export type StudioLinkRule = {
  source: StudioLinkRole;
  target: StudioLinkRole;
  /** Only these kinds of the target role; every kind of it when left out. */
  targets?: readonly StudioKind[];
  /** The modes allowed, default first. */
  modes: readonly [StudioLinkMode, ...StudioLinkMode[]];
  /** The mode a new link gets when none is given. */
  defaultMode: StudioLinkMode;
  /** The connection a new link gets; a lane entry is not a connection and has none. */
  connection?: StudioLinkConnection;
};

const calls: StudioLinkConnection = { kind: "calls", label: "Calls", protocol: "HTTPS" };
const uses: StudioLinkConnection = { kind: "depends-on", label: "Uses", protocol: "HTTPS" };
const sync = { modes: ["sync"], defaultMode: "sync" } as const;
const async = { modes: ["async"], defaultMode: "async" } as const;
const either = { modes: ["sync", "async"], defaultMode: "sync" } as const;

/**
 * The link table, by source role and target role. Exported so a blueprint can publish it.
 * - User entries: the kinds in `studioEntryKinds`, by request.
 * - An application links to anything but the user: stores, search and the CDN by request; a
 *   queue asynchronously (publish); an application or external API sync or async.
 * - A queue sits between applications: it feeds only an application, asynchronously (consume).
 * - An external API calls an application, sync or async.
 * - A CDN fronts an application or object storage, by request.
 * - Stores are end tiles: no row has a store as its source.
 */
export const studioLinkRules: readonly StudioLinkRule[] = [
  {
    source: "user",
    target: "application",
    targets: ["service", "redirect", "identity", "notification", "billing", "gateway"],
    ...sync,
  },
  { source: "user", target: "cdn", ...sync },
  { source: "user", target: "store", targets: ["object-store"], ...sync },
  { source: "user", target: "external", ...sync },
  { source: "application", target: "application", ...either, connection: calls },
  { source: "application", target: "external", ...either, connection: calls },
  {
    source: "application",
    target: "queue",
    ...async,
    connection: {
      kind: "depends-on",
      label: "Publishes",
      protocol: "Messaging",
      settings: { channelUse: "publish" },
    },
  },
  {
    source: "application",
    target: "store",
    targets: ["database"],
    ...sync,
    connection: { kind: "uses-database", label: "Reads & writes", protocol: "SQL" },
  },
  {
    source: "application",
    target: "store",
    targets: ["cache"],
    ...sync,
    connection: { kind: "uses-database", label: "Reads & writes", protocol: "Redis" },
  },
  {
    source: "application",
    target: "store",
    targets: ["object-store", "search"],
    ...sync,
    connection: uses,
  },
  { source: "application", target: "cdn", ...sync, connection: uses },
  {
    source: "queue",
    target: "application",
    ...async,
    connection: {
      kind: "depends-on",
      label: "Consumes",
      protocol: "Messaging",
      settings: { channelUse: "consume" },
    },
  },
  { source: "external", target: "application", ...either, connection: calls },
  { source: "cdn", target: "application", ...sync, connection: calls },
  { source: "cdn", target: "store", targets: ["object-store"], ...sync, connection: uses },
];

/** The kinds a row covers on its target side. */
export const studioLinkRuleTargets = (rule: StudioLinkRule): readonly StudioKind[] =>
  rule.targets ?? roleKinds[rule.target];

/** Kinds the user may link to directly (lane entries): any Service except a worker, any API. */
export const studioEntryKinds: readonly StudioKind[] = studioLinkRules
  .filter((rule) => rule.source === "user")
  .flatMap(studioLinkRuleTargets);

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

/** The row for `source → target`, or `undefined` when the table has none. */
export function studioLinkRule(
  source: StudioLinkSource,
  target: StudioKind,
): StudioLinkRule | undefined {
  const from = studioLinkRole(source);
  const to = studioLinkRole(target);
  return studioLinkRules.find(
    (rule) =>
      rule.source === from && rule.target === to && studioLinkRuleTargets(rule).includes(target),
  );
}

/** Why the table has no row for `source → target`, in plain words. */
function pairRefusal(source: StudioLinkSource, target: StudioKind): string {
  const role = studioLinkRole(source);
  if (source === "user")
    return "A lane starts at a service (not a worker), an API, storage or an external API.";
  if (role === "store") return `${Noun(source)} can't link onward.`;
  if (source === "browser" || target === "browser")
    return "Browser apps take no links; the user is the client.";
  if (role === "queue") return `A queue feeds only an application, not ${noun(target)}.`;
  if (target === "queue") return `Only an application publishes to a queue, not ${noun(source)}.`;
  if (role === "external")
    return `An external API can only call an application, not ${noun(target)}.`;
  if (role === "cdn")
    return `A CDN fronts only an application or object storage, not ${noun(target)}.`;
  return `${Noun(source)} can't link to ${noun(target)}.`;
}

/** Why a row refuses `mode`, in plain words. */
function modeRefusal(rule: StudioLinkRule, target: StudioKind, mode: StudioLinkMode): string {
  if (rule.source === "user") return "A lane entry is a request; it can't be asynchronous.";
  if (rule.source === "queue")
    return "A queue feeds an application asynchronously, not by request.";
  if (rule.target === "queue") return "Publishing to a queue is asynchronous, not a request.";
  return mode === "async"
    ? `A link to ${noun(target)} is a request; it can't be asynchronous.`
    : `A link to ${noun(target)} is asynchronous, not a request.`;
}

/**
 * The mode a new `source → target` link gets when none is given: the row's default (async for
 * queue links, sync otherwise), or sync for a pair the table refuses.
 */
export function studioDefaultLinkMode(
  source: StudioLinkSource,
  target: StudioKind,
): StudioLinkMode {
  return studioLinkRule(source, target)?.defaultMode ?? "sync";
}

/**
 * Why a `source → target` link in `mode` is refused, in plain words, or `undefined`. With no
 * mode, the pair's default is checked.
 */
export function studioLinkRefusal(
  source: StudioLinkSource,
  target: StudioKind,
  mode?: StudioLinkMode,
): string | undefined {
  const rule = studioLinkRule(source, target);
  if (!rule) return pairRefusal(source, target);
  const chosen = mode ?? rule.defaultMode;
  return rule.modes.includes(chosen) ? undefined : modeRefusal(rule, target, chosen);
}

/**
 * The connection a `source → target` link gets, or why the link is refused. With no mode, the
 * link takes the pair's default: async for queue links, sync otherwise.
 */
export function studioLinkDefaults(
  source: StudioKind,
  target: StudioKind,
  mode?: StudioLinkMode,
): StudioLinkResult {
  const rule = studioLinkRule(source, target);
  const chosen = mode ?? rule?.defaultMode ?? "sync";
  const refusal = studioLinkRefusal(source, target, chosen);
  if (refusal || !rule?.connection)
    return { ok: false, message: refusal ?? pairRefusal(source, target) };
  const { kind, label, protocol, settings } = rule.connection;
  return {
    ok: true,
    value: {
      kind,
      planned: {
        label,
        protocol,
        interaction: chosen === "async" ? "Asynchronous" : "Request / response",
        security: "Service identity",
      },
      settings: { ...settings },
    },
  };
}

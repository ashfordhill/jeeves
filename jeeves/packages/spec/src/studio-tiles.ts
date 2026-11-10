/**
 * The seven tile types group the kinds: a type gives its tiles their shape, and `changeKind`
 * switches only within one. `browser` belongs to no type: the actor is the client. What a new tile
 * can be is the link fan (`studioLinkFan`), by kind.
 */
import type { StudioKind } from "./studio-model.ts";

export const studioTileTypes = [
  "service",
  "api",
  "database",
  "cache",
  "queue",
  "storage",
  "external",
] as const;
export type StudioTileType = (typeof studioTileTypes)[number];

export type StudioTileDefinition = {
  name: string;
  /** Data tiles are pills (radius 32); the others are rounded rectangles (radius 14). */
  shape: "rect" | "pill";
  kinds: readonly [StudioKind, ...StudioKind[]];
};

export const studioTileDefinitions: Readonly<Record<StudioTileType, StudioTileDefinition>> = {
  service: {
    name: "Service",
    shape: "rect",
    kinds: ["service", "worker", "redirect", "identity", "notification", "billing", "uploads"],
  },
  api: { name: "API", shape: "rect", kinds: ["gateway", "cdn"] },
  database: { name: "Database", shape: "pill", kinds: ["database", "search"] },
  cache: { name: "Cache", shape: "pill", kinds: ["cache"] },
  queue: { name: "Queue", shape: "pill", kinds: ["queue"] },
  storage: { name: "Storage", shape: "pill", kinds: ["object-store"] },
  external: { name: "External", shape: "rect", kinds: ["external-api"] },
};

/** The tile type a kind belongs to; `undefined` for `browser`, which no tile type offers. */
export function tileTypeOf(kind: StudioKind): StudioTileType | undefined {
  return studioTileTypes.find((type) => studioTileDefinitions[type].kinds.includes(kind));
}

/** The link fan's groups, in order: one row each. */
export const studioLinkFanGroups = ["application", "data", "messaging", "edge"] as const;
export type StudioLinkFanGroup = (typeof studioLinkFanGroups)[number];

/**
 * What a new tile can be (the module authoring contract's tile fan): the kinds a selected tile's
 * or action's link fan offers, by group, always in these slots. Gateway and the legacy Redirect,
 * Notifications and Billing kinds are not offered; tiles of those kinds keep working.
 */
export const studioLinkFan: Readonly<Record<StudioLinkFanGroup, readonly StudioKind[]>> = {
  application: ["service", "worker", "uploads", "identity"],
  data: ["database", "search", "cache", "object-store"],
  messaging: ["queue"],
  edge: ["cdn", "external-api"],
};

/** The link fan's kinds, in slot order. */
export const studioLinkFanKinds: readonly StudioKind[] = studioLinkFanGroups.flatMap(
  (group) => studioLinkFan[group],
);

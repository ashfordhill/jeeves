/**
 * The seven tile types the lane canvas offers. Each type groups existing kinds; the first kind is
 * the default and the inspector switches between the others. `browser` belongs to no type: the
 * actor is the client.
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
  /** Picker icon (a `StudioIcon` name). The tile face shows its kind's own icon. */
  icon: string;
  /** Data tiles are pills (radius 32); the others are rounded rectangles (radius 14). */
  shape: "rect" | "pill";
  kinds: readonly [StudioKind, ...StudioKind[]];
};

export const studioTileDefinitions: Readonly<Record<StudioTileType, StudioTileDefinition>> = {
  service: {
    name: "Service",
    icon: "server",
    shape: "rect",
    kinds: ["service", "worker", "redirect", "identity", "notification", "billing", "uploads"],
  },
  api: { name: "API", icon: "api", shape: "rect", kinds: ["gateway", "cdn"] },
  database: { name: "Database", icon: "database", shape: "pill", kinds: ["database", "search"] },
  cache: { name: "Cache", icon: "bolt", shape: "pill", kinds: ["cache"] },
  queue: { name: "Queue", icon: "list", shape: "pill", kinds: ["queue"] },
  storage: { name: "Storage", icon: "archive", shape: "pill", kinds: ["object-store"] },
  external: { name: "External", icon: "plug", shape: "rect", kinds: ["external-api"] },
};

/** The tile type a kind belongs to; `undefined` for `browser`, which no tile type offers. */
export function tileTypeOf(kind: StudioKind): StudioTileType | undefined {
  return studioTileTypes.find((type) => studioTileDefinitions[type].kinds.includes(kind));
}

/**
 * The kind a new tile of this type gets: the type's first kind, except that a Service spawned
 * after a queue is a worker. Whether the link is allowed is the link rules' question.
 */
export function defaultKind(
  type: StudioTileType,
  context: { after?: StudioKind } = {},
): StudioKind {
  if (type === "service" && context.after === "queue") return "worker";
  return studioTileDefinitions[type].kinds[0];
}

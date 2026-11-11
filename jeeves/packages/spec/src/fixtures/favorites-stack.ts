/**
 * The favorites stack (V3-07, v3 contract section 3): one Service, Account API, whose Required
 * Auth guard verifies Sign-in, beside Favorites on its own database. Favorites' items are a Data
 * access on a second database, Catalog, which a stub Data access in the same tile writes: its
 * product SQL file is where a published view of the eligible items goes. Built by commands from a
 * blank design; module IDs are their names' slugs. Runnable processes on.
 */
import { type DesignDocument, emptyDesign } from "../design.ts";
import type { StudioComponentKind, StudioModuleSlotId } from "../studio-components.ts";
import type { StudioKind } from "../studio-model.ts";
import type { StudioCommand } from "../studio-operations.ts";
import { runStudioCommands } from "./v2-modules.ts";

const tile = (from: string, id: string, name: string, kind: StudioKind): StudioCommand => ({
  type: "addTile",
  from: from === "lane:download" ? { lane: "download" } : { tile: from },
  side: "after",
  tile: { id, name, kind },
  linkId: `${from.replace("lane:", "")}-${id}`,
});
const module = (host: string, id: string, name: string, kind: StudioComponentKind) =>
  ({ type: "addModule", host, kind, id, name }) satisfies StudioCommand;
const connect = (
  id: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({ type: "connectModule", module: id, slot, target });

/** The stack's action, tiles and links. */
export const favoritesStackTileCommands: readonly StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Browse", system: { name: "Favorites stack" } },
  tile("lane:download", "account-api", "Account API", "service"),
  tile("account-api", "favorites", "Favorites", "database"),
  tile("account-api", "catalog", "Catalog", "database"),
  tile("account-api", "sign-in", "Sign-in", "identity"),
];

/** Its four modules: the guard, Favorites with its items, and the Catalog's writer (a stub). */
export const favoritesStackModuleCommands: readonly StudioCommand[] = [
  module("account-api", "account-check", "Account check", "auth-guard"),
  module("account-api", "favorite-items", "Favorite items", "favorites"),
  module("account-api", "item-reader", "Item reader", "data-access"),
  module("account-api", "catalog-writer", "Catalog writer", "data-access"),
  connect("account-check", "identity", { tile: "sign-in" }),
  connect("favorite-items", "state", { tile: "favorites" }),
  connect("item-reader", "database", { tile: "catalog" }),
  connect("favorite-items", "items", { module: "item-reader" }),
  connect("catalog-writer", "database", { tile: "catalog" }),
];

/** The favorites stack, with Runnable processes off (as built) or on. */
export function favoritesStackDesign(processes = true): DesignDocument {
  const built = runStudioCommands(emptyDesign(), [
    ...favoritesStackTileCommands,
    ...favoritesStackModuleCommands,
  ]);
  return processes ? runStudioCommands(built, [{ type: "setRunnableProcesses", on: true }]) : built;
}

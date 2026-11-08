/** Removing elements or connections also removes the studio intent that pointed at them. */
import type { DesignDocument } from "./design.ts";
import { pruneGenerationTargets } from "./generation.ts";
import { pruneOperationContracts } from "./operation-contracts.ts";
import { pruneOwnership } from "./ownership.ts";

/**
 * Called only by explicit destructive operations, on an already detached draft. Never cascade
 * resource ownership: a missing element/package owner must be reassigned or rejected by validation.
 */
export function pruneStudioAfterDelete(
  design: DesignDocument,
  removedElements: string[] = [],
  removedConnections: string[] = [],
): void {
  pruneOwnership(design, removedElements, removedConnections);
  pruneOperationContracts(design, removedElements, removedConnections);
  pruneGenerationTargets(design, removedElements);
  const studio = design.architecture?.studio;
  if (!studio) return;
  const removed = new Set(removedElements);
  const connections = new Set(removedConnections);
  studio.elements = studio.elements.filter((item) => !removed.has(item.element));
  studio.connections = studio.connections.filter((item) => !connections.has(item.connection));
  // An entry is the actor's link to a tile: it goes with the tile.
  if (studio.entries) studio.entries = studio.entries.filter((item) => !removed.has(item.element));
  studio.packages = studio.packages.flatMap((item) => {
    const members = item.members.filter((id) => !removed.has(id));
    return members.length < 2 ? [] : [{ ...item, members }];
  });
  // A host's components are its own internals and go with it; links that traced a removed
  // connection or reached a removed element are dropped. Other services' data is untouched.
  if (studio.components) {
    studio.components = studio.components.filter((item) => !removed.has(item.host));
    const kept = new Set(studio.components.map((item) => item.id));
    for (const item of studio.components)
      if (
        item.settings.kind === "event-consumer" &&
        item.settings.deadLetterQueue &&
        removed.has(item.settings.deadLetterQueue)
      )
        delete item.settings.deadLetterQueue;
    if (studio.componentConnections)
      studio.componentConnections = studio.componentConnections.filter(
        (link) =>
          kept.has(link.from) &&
          (link.to.kind === "component"
            ? kept.has(link.to.id)
            : !removed.has(link.to.id) && !connections.has(link.to.via)),
      );
  }
  for (const binding of studio.elements) {
    const settings = binding.settings;
    if (settings.kind === "browser" && settings.delivery === "bundled") {
      if (settings.servedBy && removed.has(settings.servedBy)) delete settings.servedBy;
    }
    if (settings.kind === "cdn" && settings.origin && removed.has(settings.origin))
      delete settings.origin;
    if (settings.kind === "redirect") {
      for (const field of ["lookupStoreConnection", "lookupCacheConnection"] as const)
        if (settings[field] && connections.has(settings[field])) delete settings[field];
    }
  }
}

import {
  applyOperations,
  type DesignDocument,
  type OperationInput,
  type StudioConnectionCreation,
  type StudioKind,
  type StudioLinkMode,
  studioApplicationKinds,
  studioLinkDefaults,
} from "@jeeves/spec";
import { useDraw } from "../project/store.ts";

export function endpointKind(design: DesignDocument, id: string): StudioKind | undefined {
  return design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;
}
export const applicationKind = (kind?: string) =>
  studioApplicationKinds.some((item) => item === kind);

/** Finite studio endpoints only. Packages never stand in for running applications. */
export function connectionDefaults(
  design: DesignDocument,
  from: string,
  to: string,
): Omit<StudioConnectionCreation, "id" | "from" | "to"> {
  if (
    !design.elements.some((item) => item.id === from) ||
    !design.elements.some((item) => item.id === to)
  )
    throw new Error("Select two existing endpoints.");
  if (from === to) throw new Error("Select two different endpoints.");
  const source = endpointKind(design, from),
    target = endpointKind(design, to);
  if (!source || !target) throw new Error("Connect finite studio objects in a studio design.");
  const link = studioLinkDefaults(source, target, canvasLinkMode(source, target));
  if (!link.ok) throw new Error(link.message);
  return link.value;
}
/** This canvas has no link mode: queue links are asynchronous and all others are requests. */
export const canvasLinkMode = (source: StudioKind, target: StudioKind): StudioLinkMode =>
  source === "queue" || target === "queue" ? "async" : "sync";
export type ConnectionDraft = {
  from?: string;
  to?: string;
  context?: boolean;
  lookup?: { element: string; resource: "database" | "cache" };
  newKind?: StudioKind;
};

/** Rebuild inside the existing mutation queue; automatic layout places new reference cards. */
export function commitAction(
  projectId: string,
  rebuild: (design: DesignDocument) => OperationInput[],
) {
  return useDraw.getState().createPlaced(projectId, (design) => {
    const ops = rebuild(design);
    const result = applyOperations(design, ops, { baseRevision: design.revision });
    if (!result.ok) throw new Error(result.errors[0]?.message ?? "This action is invalid.");
    // Automatic layout places new reference cards; no position is stored.
    return ops;
  });
}
export function connectionCreation(
  id: string,
  from: string,
  to: string,
  design: DesignDocument,
): StudioConnectionCreation {
  return { id, from, to, ...connectionDefaults(design, from, to) };
}

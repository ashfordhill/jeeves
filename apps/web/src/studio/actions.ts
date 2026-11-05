import {
  applyOperations,
  type DesignDocument,
  type OperationInput,
  type StudioConnectionCreation,
  type StudioKind,
  studioApplicationKinds,
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
  return kindConnectionDefaults(source, target);
}
/** The same rules by kind alone, so a picker can list only kinds that can connect. */
export function kindConnectionDefaults(
  source: StudioKind,
  target: StudioKind,
): Omit<StudioConnectionCreation, "id" | "from" | "to"> {
  const publish = applicationKind(source) && target === "queue";
  const consume = source === "queue" && applicationKind(target);
  if (source === "queue" || target === "queue") {
    if (!publish && !consume)
      throw new Error(
        "A queue connects to an application: application → queue publishes; queue → application consumes.",
      );
    return {
      kind: "depends-on" as const,
      planned: {
        label: publish ? "Publishes" : "Consumes",
        protocol: "Messaging",
        interaction: "Asynchronous" as const,
        security: "Service identity" as const,
      },
      settings: { channelUse: publish ? ("publish" as const) : ("consume" as const) },
    };
  }
  const data = target === "database" || target === "cache";
  const allowed =
    applicationKind(source) ||
    (source === "external-api" && applicationKind(target)) ||
    (source === "cdn" && (applicationKind(target) || target === "object-store"));
  if (!allowed)
    throw new Error("Choose an application as the source, or a compatible integration dependency.");
  return {
    kind: data
      ? ("uses-database" as const)
      : applicationKind(target) || target === "external-api"
        ? ("calls" as const)
        : ("depends-on" as const),
    planned: {
      label: data
        ? "Reads & writes"
        : applicationKind(target) || target === "external-api"
          ? "Calls"
          : "Uses",
      protocol: target === "database" ? "SQL" : target === "cache" ? "Redis" : "HTTPS",
      interaction: "Request / response" as const,
      security: "Service identity" as const,
    },
    settings: {},
  };
}
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

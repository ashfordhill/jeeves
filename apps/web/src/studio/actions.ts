import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  type OperationInput,
  type StudioConnectionCreation,
  type StudioKind,
  studioApplicationKinds,
  studioDefinitions,
  studioViews,
} from "@jeeves/spec";
import { useDraw } from "../draw/store.ts";
import { initialPosition, landing } from "./creation.ts";

export function endpointKind(design: DesignDocument, id: string): StudioKind | undefined {
  return design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;
}
export const applicationKind = (kind?: string) =>
  studioApplicationKinds.some((item) => item === kind);

/** Finite studio endpoints only. Packages never stand in for running applications. */
export function connectionDefaults(design: DesignDocument, from: string, to: string) {
  if (
    !design.elements.some((item) => item.id === from) ||
    !design.elements.some((item) => item.id === to)
  )
    throw new Error("Select two existing endpoints.");
  if (from === to) throw new Error("Select two different endpoints.");
  const source = endpointKind(design, from),
    target = endpointKind(design, to);
  if (!source || !target) throw new Error("Connect finite studio objects in a studio design.");
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

/** Rebuild inside the existing mutation queue; new reference cards land without moving old cards. */
export function commitAction(
  projectId: string,
  rebuild: (design: DesignDocument) => OperationInput[],
) {
  return useDraw.getState().createPlaced(projectId, (design) => {
    const ops = rebuild(design);
    const result = applyOperations(design, ops, builtinRegistry(), {
      baseRevision: design.revision,
    });
    if (!result.ok) throw new Error(result.errors[0]?.message ?? "This action is invalid.");
    const loaded = useDraw.getState().loaded;
    const old = studioViews(design, studioDefinitions, loaded?.project.name ?? "System");
    const next = studioViews(result.design, studioDefinitions, loaded?.project.name ?? "System");
    const positions: Record<string, Record<string, { x: number; y: number }>> = {};
    for (const scope of [next.context, next.containers, ...next.details]) {
      const previous = [old.context, old.containers, ...old.details].find(
        (item) => item.key === scope.key,
      );
      const fresh = scope.nodes.filter(
        (node) => !previous?.nodes.some((item) => item.id === node.id),
      );
      if (!fresh.length) continue;
      const saved = loaded?.layout.architecture?.[scope.key]?.positions;
      const current = Object.fromEntries(
        (previous?.nodes ?? []).map((node, i) => [node.id, saved?.[node.id] ?? initialPosition(i)]),
      );
      for (const node of fresh)
        current[node.id] = landing(
          initialPosition(scope.nodes.indexOf(node)),
          Object.values(current),
        );
      positions[scope.key] = current;
    }
    return { ops, positions };
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

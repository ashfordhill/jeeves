/** Builds the operation batches for canvas gestures: placing, attaching, and deleting. */
import type { Registry, TemplateDescription } from "@jeeves/registry";
import type { DesignDocument, OperationInput, TemplateRef } from "@jeeves/spec";
import { uniqueId, uniqueName } from "./ids.ts";

export type AnnotationTool = "text" | "note" | "frame";

export function placeElement(
  design: DesignDocument,
  template: TemplateDescription,
): { id: string; ops: OperationInput[] } {
  const name = uniqueName(design, template.displayName);
  const id = uniqueId(design, name);
  return {
    id,
    ops: [
      {
        op: "addElement",
        element: { id, name, template: { id: template.id, version: template.version } },
      },
    ],
  };
}

export function placeAnnotation(
  design: DesignDocument,
  kind: AnnotationTool,
): { id: string; ops: OperationInput[] } {
  const id = uniqueId(design, kind);
  const annotation = kind === "frame" ? { id, kind, title: "Frame" } : { id, kind, text: "" };
  return { id, ops: [{ op: "addAnnotation", annotation }] };
}

export function attach(
  design: DesignDocument,
  registry: Registry,
  elementId: string,
  template: TemplateRef,
): { ok: true; ops: OperationInput[] } | { ok: false; reason: string } {
  const verdict = registry.canAttach(design, elementId, template);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const attachment = { id: uniqueId(design, `${elementId}-${template.id}`), template };
  return { ok: true, ops: [{ op: "addAttachment", element: elementId, attachment }] };
}

/**
 * Removes the given nodes (elements and annotations) and edges (connections and arrows).
 * Connections that removing an element already cascades away aren't removed twice.
 */
export function deleteOps(
  design: DesignDocument,
  nodeIds: readonly string[],
  edgeIds: readonly string[],
): OperationInput[] {
  const elements = new Set(design.elements.map((e) => e.id).filter((id) => nodeIds.includes(id)));
  const annotationIds = new Set(design.annotations.map((a) => a.id));
  const ops: OperationInput[] = [];
  for (const id of elements) ops.push({ op: "removeElement", id });
  for (const id of [...nodeIds, ...edgeIds]) {
    if (annotationIds.has(id)) ops.push({ op: "removeAnnotation", id });
  }
  for (const connection of design.connections) {
    if (!edgeIds.includes(connection.id)) continue;
    if (elements.has(connection.from.element) || elements.has(connection.to.element)) continue;
    ops.push({ op: "disconnect", id: connection.id });
  }
  return ops;
}

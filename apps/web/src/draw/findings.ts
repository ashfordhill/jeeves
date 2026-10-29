/**
 * Where a finding shows up on the board: element and attachment findings belong to the element's
 * card, connection findings to the connection's edge, and annotation findings to their node.
 */
import type { DesignDocument, Finding } from "@jeeves/spec";
import { type TemplateIndex, templateKey } from "./flow.ts";

export type FindingPlace = { node?: string; edge?: string };

export function placeFinding(design: DesignDocument, finding: Finding): FindingPlace {
  const { element, attachment, connection, annotation } = finding.target;
  if (element) return { node: element };
  if (attachment) {
    const owner = design.elements.find((e) => e.attachments.some((a) => a.id === attachment));
    if (owner) return { node: owner.id };
  }
  if (connection) return { edge: connection };
  if (annotation) return { node: annotation };
  return {};
}

export type FindingIndex = {
  /** Findings per node ID (element cards include their attachments' findings). */
  byNode: ReadonlyMap<string, Finding[]>;
  byEdge: ReadonlyMap<string, Finding[]>;
};

export function indexFindings(design: DesignDocument, findings: readonly Finding[]): FindingIndex {
  const byNode = new Map<string, Finding[]>();
  const byEdge = new Map<string, Finding[]>();
  const add = (map: Map<string, Finding[]>, id: string, f: Finding) => {
    const list = map.get(id);
    if (list) list.push(f);
    else map.set(id, [f]);
  };
  for (const f of findings) {
    const place = placeFinding(design, f);
    if (place.node) add(byNode, place.node, f);
    else if (place.edge) add(byEdge, place.edge, f);
  }
  return { byNode, byEdge };
}

/** Short name of what a finding is about, for the findings list. */
export function findingSubject(
  design: DesignDocument,
  templates: TemplateIndex,
  finding: Finding,
): string {
  const { element, attachment, connection, annotation } = finding.target;
  const owner = element ? design.elements.find((e) => e.id === element) : undefined;
  if (owner && attachment) {
    const a = owner.attachments.find((x) => x.id === attachment);
    const name = a ? (templates.get(templateKey(a.template))?.displayName ?? a.template.id) : "";
    return `${owner.name} · ${name || attachment}`;
  }
  if (owner) return owner.name;
  if (connection) return `Connection ${connection}`;
  if (annotation) return `Annotation ${annotation}`;
  return "Design";
}

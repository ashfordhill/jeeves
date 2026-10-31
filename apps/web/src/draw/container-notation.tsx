/** Derived C2 geometry. These nodes never enter the semantic document or saved layout. */
import { type DesignDocument, plannedCapability } from "@jeeves/spec";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type { BoardNode } from "./flow.ts";
import { TemplateIcon } from "./TemplateIcon.tsx";

export type ContextBoardNode = Node<
  {
    name: string;
    description: string;
    kind: "person" | "external-system" | "system";
  },
  "context" | "systemBoundary"
>;
export const SYSTEM_BOUNDARY = "context:system";

export function withContainerNotation(
  design: DesignDocument,
  nodes: BoardNode[],
  projectName: string,
): BoardNode[] {
  const authored = nodes.filter(
    (node) => node.type !== "context" && node.type !== "systemBoundary",
  );
  const internal = authored.filter(
    (node) =>
      node.type === "element" && plannedCapability(node.data.element.planned)?.role !== "external",
  );
  if (!internal.length && !design.architecture) return authored;
  const left = internal.length ? Math.min(...internal.map((node) => node.position.x)) - 40 : 0;
  const top = internal.length ? Math.min(...internal.map((node) => node.position.y)) - 60 : 0;
  const right = internal.length
    ? Math.max(
        ...internal.map((node) => node.position.x + (node.measured?.width ?? node.width ?? 280)),
      ) + 40
    : 360;
  const bottom = internal.length
    ? Math.max(
        ...internal.map((node) => node.position.y + (node.measured?.height ?? node.height ?? 210)),
      ) + 40
    : 280;
  const boundary: ContextBoardNode = {
    id: SYSTEM_BOUNDARY,
    type: "systemBoundary",
    position: { x: left, y: top },
    width: right - left,
    height: bottom - top,
    measured: { width: right - left, height: bottom - top },
    zIndex: -2,
    style: { pointerEvents: "none" },
    draggable: false,
    connectable: false,
    selectable: false,
    focusable: false,
    data: {
      name: design.architecture?.system.name ?? projectName,
      description: "Software system boundary",
      kind: "system",
    },
  };
  const participants = new Set(
    (design.architecture?.relationships ?? [])
      .filter((r) => r.from === "system" || r.to === "system")
      .flatMap((r) => [r.from, r.to]),
  );
  let person = 0,
    external = 0;
  const context: ContextBoardNode[] = (design.architecture?.nodes ?? [])
    .filter((node) => participants.has(node.id))
    .map((node) => ({
      id: `context:${node.id}`,
      type: "context",
      width: 250,
      height: 150,
      measured: { width: 250, height: 150 },
      selected: nodes.find((item) => item.id === `context:${node.id}`)?.selected,
      position: {
        x: node.kind === "person" ? left - 350 : right + 100,
        y: top + 40 + (node.kind === "person" ? person++ : external++) * 200,
      },
      data: node,
      draggable: false,
      connectable: false,
    }));
  // Planned external systems also belong outside. Their authored layout is left intact.
  const outside = authored.map((node) =>
    node.type === "element" && plannedCapability(node.data.element.planned)?.role === "external"
      ? { ...node, position: { x: right + 100, y: top + 40 + external++ * 240 }, draggable: false }
      : node,
  );
  return [boundary, ...outside, ...context];
}

export function ContextBoardCard({ data, selected }: NodeProps<ContextBoardNode>) {
  return (
    <article
      className={`c2-context-card${selected ? " is-selected" : ""}`}
      data-family={data.kind === "person" ? "person" : "external"}
      aria-label={`${data.name}, ${data.kind === "person" ? "Person" : "External system"}`}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <TemplateIcon name={data.kind === "person" ? "user" : "world"} size={26} />
      <span className="element-card-stereotype">
        {data.kind === "person" ? "Person" : "External system"}
      </span>
      <strong>{data.name}</strong>
      <p>{data.description || "Describe this participant's responsibility."}</p>
      <Handle type="source" position={Position.Right} id="out" />
    </article>
  );
}
export function SystemBoundary({ data }: NodeProps<ContextBoardNode>) {
  return (
    <section className="c2-system-boundary" aria-label={`${data.name} system boundary`}>
      <span>
        {data.name} <small>[Software system]</small>
      </span>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </section>
  );
}

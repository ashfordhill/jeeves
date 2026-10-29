/**
 * Plain arrows with an unbound end, drawn from the layout's `points` in flow coordinates.
 * A bound end starts at its item's center. Arrows with no points to draw are skipped.
 */
import type { DesignDocument, LayoutDocument } from "@jeeves/spec";
import { useNodes, ViewportPortal } from "@xyflow/react";
import { freeArrows } from "../flow.ts";

export function FreeArrows({ design, layout }: { design: DesignDocument; layout: LayoutDocument }) {
  const nodes = useNodes();
  const arrows = freeArrows(design);
  if (arrows.length === 0) return null;

  const center = (id: string | undefined) => {
    const node = id ? nodes.find((n) => n.id === id) : undefined;
    if (!node) return undefined;
    const w = node.measured?.width ?? node.width ?? 0;
    const h = node.measured?.height ?? node.height ?? 0;
    return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
  };

  return (
    <ViewportPortal>
      <svg className="free-arrows" aria-hidden>
        <defs>
          <marker
            id="free-arrow-head"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" className="free-arrow-head" />
          </marker>
        </defs>
        {arrows.map((arrow) => {
          const points = [...(layout.items[arrow.id]?.points ?? [])];
          const start = center(arrow.from);
          const end = center(arrow.to);
          if (start) points.unshift(start);
          if (end) points.push(end);
          if (points.length < 2) return null;
          return (
            <polyline
              key={arrow.id}
              className="arrow-path"
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              markerEnd="url(#free-arrow-head)"
            />
          );
        })}
      </svg>
    </ViewportPortal>
  );
}

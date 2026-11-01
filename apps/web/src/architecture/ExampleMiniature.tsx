import { architectureExample } from "@jeeves/spec";
import { elementFamily } from "./type-style.tsx";

/** The same editable composition powers the preview; no illustrative extra dependencies. */
export function ExampleMiniature({ id }: { id: string }) {
  const { design } = architectureExample(id);
  const points = new Map(
    design.elements.map((element, index) => [
      element.id,
      {
        x: (index % 3) * 220 + 10,
        y: Math.floor(index / 3) * 105 + 10,
      },
    ]),
  );
  return (
    <svg
      className="example-miniature"
      viewBox={`0 0 670 ${Math.ceil(design.elements.length / 3) * 105}`}
      aria-hidden="true"
    >
      {design.connections.map((connection) => {
        const from = points.get(connection.from.element)!;
        const to = points.get(connection.to.element)!;
        return (
          <path
            key={connection.id}
            d={`M${from.x + 100},${from.y + 35} L${to.x + 100},${to.y + 35}`}
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2"
            opacity="0.45"
            strokeDasharray={connection.planned?.interaction === "Asynchronous" ? "7 4" : undefined}
          />
        );
      })}
      {design.elements.map((element) => {
        const point = points.get(element.id)!;
        return (
          <g
            key={element.id}
            data-family={elementFamily(element)}
            data-preview-element={element.id}
          >
            <rect x={point.x} y={point.y} width="200" height="70" rx="10" />
            <text x={point.x + 100} y={point.y + 40} textAnchor="middle">
              {element.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

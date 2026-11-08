import type { BoardSelection } from "@jeeves/board";
import { type DesignDocument, LANE_ACTOR, type LaneEdge, type LaneGraph } from "@jeeves/spec";
import { laneNodeName } from "./LaneCanvas.tsx";

export function relationshipVerb(design: DesignDocument, edge: LaneEdge): string {
  return (
    design.connections.find((item) => item.id === edge.id)?.planned.label ??
    (edge.source === LANE_ACTOR ? "Starts action" : "Enters service")
  );
}

/** A stable anchor survives selecting a route. The list selects canonical edge IDs directly. */
export function RelationshipFocus({
  design,
  graph,
  anchor,
  active,
  selection,
  onFocus,
  onSelect,
  onRemove,
}: {
  design: DesignDocument;
  graph: LaneGraph;
  anchor: string;
  active: boolean;
  selection: BoardSelection;
  onFocus: () => void;
  onSelect: (selection: BoardSelection) => void;
  onRemove: (id: string) => void;
}) {
  const name = (id: string) => laneNodeName(design, graph, id);
  if (!active)
    return (
      <div className="lane-focus-start">
        <button type="button" onClick={onFocus}>
          Focus relationships
        </button>
      </div>
    );
  const selected = graph.edges.find((edge) => edge.id === selection.line);
  return (
    <section className="lane-relationship-focus" aria-label={`Relationships for ${name(anchor)}`}>
      <div className="lane-focus-heading">
        <strong>{name(anchor)}</strong>
        <button
          type="button"
          aria-label={`All for ${name(anchor)}`}
          onClick={() => onSelect({ tile: anchor })}
        >
          All for this tile
        </button>
      </div>
      <p>Select a relationship to trace it on its own.</p>
      {(["Incoming", "Outgoing"] as const).map((direction) => {
        const edges = graph.edges.filter(
          (edge) => (direction === "Incoming" ? edge.target : edge.source) === anchor,
        );
        return (
          <div key={direction}>
            <h3>
              {direction} · {edges.length}
            </h3>
            {edges.length ? (
              <ul>
                {edges.map((edge) => (
                  <li key={edge.id}>
                    <button
                      type="button"
                      aria-pressed={selection.line === edge.id}
                      onClick={() => onSelect({ line: edge.id })}
                    >
                      <span>
                        {name(edge.source)} → {name(edge.target)}
                      </span>
                      <span>
                        {relationshipVerb(design, edge)} · {edge.async ? "Async" : "Request"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>
        );
      })}
      {selected && selected.source !== LANE_ACTOR ? (
        <button type="button" className="lane-focus-remove" onClick={() => onRemove(selected.id)}>
          Remove relationship
        </button>
      ) : null}
    </section>
  );
}

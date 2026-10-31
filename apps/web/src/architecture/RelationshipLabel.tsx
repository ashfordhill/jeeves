import type { RelationshipInteraction } from "@jeeves/spec";

export function relationshipLineStyle(interaction?: RelationshipInteraction) {
  return {
    strokeDasharray:
      interaction === "Asynchronous" ? "7 4" : interaction === "Streaming" ? "2 3" : "none",
    strokeLinecap: interaction === "Streaming" ? ("round" as const) : ("butt" as const),
  };
}

export function RelationshipLabel({
  description,
  protocol,
  planned,
}: {
  description: string;
  protocol?: string;
  planned?: boolean;
}) {
  return (
    <>
      <span className="relationship-description">{description}</span>
      {protocol ? <span className="relationship-protocol">{protocol}</span> : null}
      {planned ? <span className="relationship-planned">Planned</span> : null}
    </>
  );
}

export function RelationshipLegend() {
  return (
    <section aria-label="Relationship styles">
      <p>Relationship styles in C2 and C3</p>
      {(["Request / response", "Asynchronous", "Streaming"] as const).map((interaction) => (
        <div key={interaction} className="relationship-legend-row">
          <svg width="55" height="16" aria-hidden="true">
            <path
              d="M 2 8 L 52 8"
              style={{
                stroke: "var(--ink)",
                strokeWidth: 2,
                ...relationshipLineStyle(interaction),
              }}
            />
          </svg>
          <span>{interaction}</span>
        </div>
      ))}
      <p>Planned badges describe design intent.</p>
    </section>
  );
}

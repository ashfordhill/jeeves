/** C4 presentation only. These values never select transport or runtime behavior. */
import { z } from "zod";
import type { Connection, DesignDocument } from "./design.ts";

export const relationshipLabelSchema = z.string().trim().max(120);
export const relationshipProtocolSchema = z.string().trim().min(1).max(80);
export const relationshipInteractionSchema = z.enum([
  "Request / response",
  "Asynchronous",
  "Streaming",
]);
export type RelationshipInteraction = z.infer<typeof relationshipInteractionSchema>;

export function connectionPresentation(connection: Connection, design: DesignDocument) {
  const target = design.elements.find((element) => element.id === connection.to.element);
  const name = target?.name ?? connection.to.element;
  const defaults = {
    "uses-database": { description: `Reads and writes ${name} records`, protocol: "SQL" },
    calls: {
      description: `Calls ${name}${/\bAPI$/i.test(name) ? "" : " API"}`,
      protocol: "HTTPS/JSON",
    },
    "depends-on": { description: `Uses ${name}`, protocol: "Undecided" },
  }[connection.kind];
  return {
    description: connection.planned?.label ?? (connection.label?.trim() || defaults.description),
    protocol: connection.planned?.protocol ?? connection.protocol ?? defaults.protocol,
    interaction: connection.planned?.interaction ?? connection.interaction ?? "Request / response",
    planned: Boolean(connection.planned),
  };
}

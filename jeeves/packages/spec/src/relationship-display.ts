/** C4 presentation only. These values never select transport or runtime behavior. */
import { z } from "zod";
import type { Connection } from "./design.ts";

export const relationshipLabelSchema = z.string().trim().max(120);
export const relationshipProtocolSchema = z.string().trim().min(1).max(80);
export const relationshipInteractionSchema = z.enum([
  "Request / response",
  "Asynchronous",
  "Streaming",
]);
export type RelationshipInteraction = z.infer<typeof relationshipInteractionSchema>;

export function connectionPresentation(connection: Connection) {
  return {
    description: connection.planned.label,
    protocol: connection.planned.protocol,
    interaction: connection.planned.interaction,
  };
}

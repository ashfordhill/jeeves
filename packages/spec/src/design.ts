import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { classificationSchema } from "./architecture-choices.ts";
import { idSchema } from "./ids.ts";
import {
  relationshipInteractionSchema,
  relationshipLabelSchema,
  relationshipProtocolSchema,
} from "./relationship-display.ts";

export const connectionKindSchema = z.enum(["uses-database", "calls", "depends-on"]);
export type ConnectionKind = z.infer<typeof connectionKindSchema>;

/**
 * One C2 box: an application or resource. Its studio settings live in `architecture.studio`,
 * keyed by this ID.
 */
export const elementSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  classification: classificationSchema.optional(),
  description: z.string().trim().max(240).optional(),
});
export type Element = z.output<typeof elementSchema>;
export type ElementInput = z.input<typeof elementSchema>;

/** One end of a connection: always an element. */
export const endpointSchema = z.strictObject({ element: idSchema });
export type Endpoint = z.infer<typeof endpointSchema>;

/** The C4 description of a relationship, shown on its line and exported in the blueprint. */
export const plannedConnectionSchema = z.strictObject({
  label: relationshipLabelSchema.min(1),
  protocol: relationshipProtocolSchema.default("HTTPS"),
  interaction: relationshipInteractionSchema.default("Request / response"),
  security: z
    .enum(["Service identity", "User identity", "Public", "Private network"])
    .default("Service identity"),
});

export const connectionSchema = z.strictObject({
  id: idSchema,
  kind: connectionKindSchema,
  from: endpointSchema,
  to: endpointSchema,
  planned: plannedConnectionSchema,
});
export type Connection = z.infer<typeof connectionSchema>;

/**
 * A studio design. `revision` is bumped once per applied operation batch, never by layout changes.
 * Documents in any other shape are rejected.
 */
export const designSchema = z.strictObject({
  schemaVersion: z.literal(2),
  revision: z.int().nonnegative(),
  architecture: architectureSchema.optional(),
  elements: z.array(elementSchema).default([]),
  connections: z.array(connectionSchema).default([]),
});
export type DesignDocument = z.output<typeof designSchema>;
export type DesignDocumentInput = z.input<typeof designSchema>;

export function emptyDesign(): DesignDocument {
  return { schemaVersion: 2, revision: 0, elements: [], connections: [] };
}

export type DesignIdType = "element" | "connection" | "package" | "entry";
/** How a message names each kind of identity ("used by a lane entry"). */
export const designIdNouns: Record<DesignIdType, string> = {
  element: "an element",
  connection: "a connection",
  package: "a package",
  entry: "a lane entry",
};

/** Every ID in the design with what it names, in document order. */
export function* designIds(design: DesignDocument): Generator<{ id: string; type: DesignIdType }> {
  for (const element of design.elements) yield { id: element.id, type: "element" };
  for (const connection of design.connections) yield { id: connection.id, type: "connection" };
  for (const item of design.architecture?.studio?.packages ?? [])
    yield { id: item.id, type: "package" };
  for (const item of design.architecture?.studio?.entries ?? [])
    yield { id: item.id, type: "entry" };
}

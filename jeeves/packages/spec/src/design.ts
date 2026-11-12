import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { classificationSchema } from "./architecture-choices.ts";
import { designScopeSchema } from "./design-scope.ts";
import { generationSchema } from "./generation.ts";
import { idSchema } from "./ids.ts";
import { operationContractsSchema } from "./operation-contracts.ts";
import { ownershipSchema } from "./ownership.ts";
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
export const designV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  revision: z.int().nonnegative(),
  architecture: architectureSchema.optional(),
  elements: z.array(elementSchema).default([]),
  connections: z.array(connectionSchema).default([]),
});
/** Explicit readers preserve legacy meaning; reading never writes or upgrades a document. */
export const designV3Schema = designV2Schema.extend({
  schemaVersion: z.literal(3),
  scope: designScopeSchema,
  ownership: ownershipSchema.optional(),
  operations: operationContractsSchema.optional(),
  generation: generationSchema.optional(),
});
export const designSchema = z.discriminatedUnion("schemaVersion", [designV2Schema, designV3Schema]);
export type DesignDocument = z.output<typeof designSchema>;
export type DesignDocumentInput = z.input<typeof designSchema>;

type Path = readonly PropertyKey[];
/** A saved studio setting's number outside its bound: `architecture.studio.<elements|components>.<i>.settings.<key>`. */
function settingBound(issue: z.core.$ZodIssue) {
  const [architecture, studio, list, index, settings, key, ...rest] = issue.path;
  return (
    (issue.code === "too_big" || issue.code === "too_small") &&
    issue.origin === "number" &&
    architecture === "architecture" &&
    studio === "studio" &&
    (list === "elements" || list === "components") &&
    typeof index === "number" &&
    settings === "settings" &&
    typeof key === "string" &&
    rest.length === 0
  );
}
const at = (value: unknown, path: Path) =>
  path.reduce<unknown>((item, key) => (item as Record<PropertyKey, unknown>)?.[key], value);
function put(value: unknown, path: Path, next: unknown) {
  const parent = at(value, path.slice(0, -1)) as Record<PropertyKey, unknown>;
  parent[path.at(-1) as PropertyKey] = next;
}

/**
 * Reads a stored document. A saved setting's number outside its bound (an older design, or a
 * bound tightened since) is kept as it was, so the design still opens, with that value's
 * `CONFIG_INVALID` finding, and its own control can put it right (V3-18). Any other problem
 * fails exactly as `designSchema.parse` does.
 */
export function parseStoredDesign(document: unknown): DesignDocument {
  const first = designSchema.safeParse(document);
  if (first.success) return first.data;
  if (!first.error.issues.every(settingBound)) throw first.error;
  // Parse with each such value at its bound, then put the saved value back.
  const placeholder = structuredClone(document);
  for (const issue of first.error.issues)
    if (issue.code === "too_big" || issue.code === "too_small")
      put(
        placeholder,
        issue.path,
        Number(issue.code === "too_big" ? issue.maximum : issue.minimum) +
          (issue.inclusive === false ? (issue.code === "too_big" ? -1 : 1) : 0),
      );
  const parsed = designSchema.parse(placeholder);
  for (const issue of first.error.issues) put(parsed, issue.path, at(document, issue.path));
  return parsed;
}

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

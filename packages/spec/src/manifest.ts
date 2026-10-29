import { z } from "zod";
import { configValuesSchema, connectionKindSchema } from "./design.ts";
import { idSchema, type TemplateRef, versionSchema } from "./ids.ts";

export const elementKindSchema = z.enum([
  "service",
  "frontend",
  "library",
  "database",
  "worker",
  "external",
]);
export type ElementKind = z.infer<typeof elementKindSchema>;

/**
 * A connection point on an element or attachment. A manifest has at most one port per
 * (kind, direction), so connections don't need to name ports.
 */
export const portSchema = z.strictObject({
  kind: connectionKindSchema,
  direction: z.enum(["in", "out"]),
  label: z.string().min(1),
  /** An unconnected required port is a readiness finding. */
  required: z.boolean().default(false),
  /** Whether more than one connection may use this port. */
  multiple: z.boolean().default(true),
  /** What may sit at the other end. Omitted means anything with a matching port. */
  accepts: z
    .strictObject({
      templates: z.array(idSchema).min(1).optional(),
      elementKinds: z.array(elementKindSchema).min(1).optional(),
    })
    .optional(),
});
export type Port = z.output<typeof portSchema>;

/**
 * A template's config schema: a Zod object whose fields carry defaults where a sensible one
 * exists. Fields without a default are required and show up as `CONFIG_REQUIRED` findings.
 * Checked structurally so a schema from another copy of Zod is still recognized.
 */
const configObjectSchema = z.custom<z.ZodObject>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "shape" in value &&
    typeof (value as { safeParse?: unknown }).safeParse === "function",
  "Expected a Zod object schema",
);

const manifestBase = {
  id: idSchema,
  version: versionSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  config: configObjectSchema,
  presets: z
    .array(z.strictObject({ id: idSchema, name: z.string().min(1), config: configValuesSchema }))
    .default([]),
  ports: z.array(portSchema).default([]),
  /** Display hints for the card: a Tabler icon name and the config keys shown as chips. */
  card: z.strictObject({
    icon: z.string().min(1),
    chips: z.array(z.string()).max(3).default([]),
  }),
};

export const elementManifestSchema = z.strictObject({
  ...manifestBase,
  kind: z.literal("element"),
  elementKind: elementKindSchema,
  /** Attachment templates this element accepts, each optionally limited in count. */
  attachmentSlots: z
    .array(z.strictObject({ template: idSchema, max: z.int().positive().optional() }))
    .default([]),
});

export const attachmentManifestSchema = z.strictObject({
  ...manifestBase,
  kind: z.literal("attachment"),
});

export const templateManifestSchema = z.discriminatedUnion("kind", [
  elementManifestSchema,
  attachmentManifestSchema,
]);
export type TemplateManifest = z.output<typeof templateManifestSchema>;
export type ElementManifest = z.output<typeof elementManifestSchema>;
export type AttachmentManifest = z.output<typeof attachmentManifestSchema>;
export type TemplateManifestInput = z.input<typeof templateManifestSchema>;

/** Identity helper for `templates/<id>/manifest.ts`; the registry validates on load. */
export function defineTemplate<const T extends TemplateManifestInput>(manifest: T): T {
  return manifest;
}

/** What validation and `applyOperations` need from a registry. */
export interface TemplateLookup {
  get(ref: TemplateRef): TemplateManifest | undefined;
  /** Known versions of a template ID, oldest first; empty if the ID is unknown. */
  versions(id: string): readonly string[];
}

export function findPort(
  manifest: TemplateManifest,
  kind: Port["kind"],
  direction: Port["direction"],
): Port | undefined {
  return manifest.ports.find((port) => port.kind === kind && port.direction === direction);
}

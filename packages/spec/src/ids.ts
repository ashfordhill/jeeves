import { z } from "zod";

/**
 * IDs for elements, attachments, connections, and annotations. They are unique across the whole
 * design (the layout document is keyed by them) and element IDs become directory names in the
 * generated project, so they are lowercase slugs.
 */
export const idSchema = z
  .string()
  .max(63)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single hyphens");

export const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Use a semantic version such as 0.1.0");

export const templateRefSchema = z.strictObject({
  id: idSchema,
  version: versionSchema,
});
export type TemplateRef = z.infer<typeof templateRefSchema>;

export function formatTemplateRef(ref: TemplateRef): string {
  return `${ref.id}@${ref.version}`;
}

/** Numeric semver comparison; negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

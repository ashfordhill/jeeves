import type { DesignDocument } from "./design.ts";

/** Current application compilers have no exact resolver for studio intent. Metadata alone is safe. */
export function studioGenerationSupport(
  design: DesignDocument,
): { supported: true } | { supported: false; code: "STUDIO_DESIGN_ONLY"; message: string } {
  const studio = design.architecture?.studio;
  if (!studio || (!studio.elements.length && !studio.connections.length && !studio.packages.length))
    return { supported: true };
  return {
    supported: false,
    code: "STUDIO_DESIGN_ONLY",
    message:
      "Studio settings and packages are design-only. Application generation requires a separately implemented exact studio runtime resolver. Portable design export remains available.",
  };
}

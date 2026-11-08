import { type DesignDocument, designSchema } from "@jeeves/spec";
import { canonicalJson, freeze, refuse, sha256 } from "../json.ts";

export type V2Input = { designJson: string };
export type V2ValidatedInput = {
  design: DesignDocument;
  /** Original declarations, before schema defaults/transforms; authoritative for provenance. */
  rawDesign: unknown;
  designJson: string;
  sourceSha256: string;
  sourceCanonicalSha256: string;
};

/** Exact saved bytes are provenance; only the spec's normalized model selects behavior. */
export function validateV2Input(input: V2Input): V2ValidatedInput {
  let raw: unknown;
  try {
    raw = JSON.parse(input.designJson);
  } catch {
    refuse("INVALID_JSON", "design.json", "Supply a saved schema3 design JSON document.");
  }
  const parsed = designSchema.safeParse(raw);
  if (!parsed.success) refuse("INVALID_STRUCTURE", "design.json", parsed.error.message);
  if (parsed.data.schemaVersion !== 3 || !parsed.data.generation)
    refuse(
      "GENERATION_REQUIRED",
      "/generation",
      "V2 requires explicit schema3 generation selections.",
    );
  return freeze({
    design: parsed.data,
    rawDesign: raw,
    designJson: input.designJson,
    sourceSha256: sha256(input.designJson),
    sourceCanonicalSha256: sha256(canonicalJson(raw)),
  });
}

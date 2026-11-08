import {
  designBlueprintV3,
  designBlueprintV3Schema,
  designSchema,
  findingCatalog,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import {
  atPointer,
  canonicalJson,
  freeze,
  type JsonObject,
  refuse,
  sameJson,
  sha256,
} from "./json.ts";
import { templateIds, youtubeLocalProfile } from "./profile.ts";

const text = z.string().min(1);
const settings = z.record(z.string(), z.json());
const selector = {
  sourcePath: text,
  requiredSettings: settings,
  proposedTemplateId: z.enum(templateIds),
  templateVersion: z.null(),
  availability: z.literal("not implemented"),
};
const bindingsSchema = z.strictObject({
  format: z.literal("youtube-v1-local-bindings-proposal-v1"),
  status: text,
  sourceSnapshot: text,
  sourceCanonicalSha256: text,
  sourceSchemaVersion: z.literal(2),
  blueprintVersion: z.literal(3),
  selectionRules: z.array(text),
  runtimePins: z.literal("runtime-pins.json"),
  elements: z.array(
    z.strictObject({
      ...selector,
      elementId: text,
      definition: z.strictObject({ id: text, version: text }),
      owner: z.union([z.null(), z.strictObject({ kind: z.literal("element"), id: text })]),
      runtime: text,
      functionalCoverage: text,
      gap: text,
    }),
  ),
  components: z.array(
    z.strictObject({
      ...selector,
      componentId: text,
      hostId: text,
      behavior: text,
      links: z.array(z.json()),
    }),
  ),
  connections: z.array(
    z.strictObject({
      connectionId: text,
      fromId: text,
      toId: text,
      sourcePath: text,
      declaredProtocol: text,
      declaredSecurity: text,
      localResource: text,
      access: text,
      proposedOnly: z.literal(true),
    }),
  ),
  explicitUnsupportedIntent: z.array(
    z.strictObject({
      target: z.union([
        z.strictObject({ elementId: text }),
        z.strictObject({ connectionId: text }),
      ]),
      sourcePath: text,
      declared: z.json(),
      classification: text,
      localBinding: text,
      generatorMustReport: z.literal(true),
    }),
  ),
  localConfig: z.record(z.string(), z.json()),
  customGapReferences: text,
  immutableInputs: text,
});

export type LocalBindings = z.infer<typeof bindingsSchema>;
export type InputArtifactName = keyof typeof youtubeLocalProfile.artifacts;
export interface ExperimentalInput {
  profileId: string;
  /** Exact frozen UTF-8 JSON bytes, not parsed/reserialized responses. */
  artifacts: Record<InputArtifactName, string>;
  /** Optional immutable image; without it provenance records a reference, never inclusion. */
  diagramPng?: Uint8Array;
}

function parseJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return refuse("INVALID_JSON", path, "Expected a JSON document.");
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const result = schema.safeParse(value);
  if (!result.success) refuse("INVALID_STRUCTURE", path, result.error.message);
  return result.data;
}
function match(actual: unknown, expected: unknown, path: string) {
  if (!sameJson(actual, expected))
    refuse(
      "CONTRADICTORY_MAPPING",
      path,
      "Mapping must match the exact canonical source declaration.",
    );
}
function uniqueIds(rows: readonly string[], path: string) {
  if (new Set(rows).size !== rows.length)
    refuse("DUPLICATE_MAPPING", path, "Each canonical ID must occur exactly once.");
}

/** Input strings are copied/parsed, checked and frozen before trusted templates run. */
export function validateExperimentalInput(input: ExperimentalInput) {
  if (!input || typeof input !== "object")
    refuse("INVALID_STRUCTURE", "/", "Expected an experimental generator input object.");
  if (input.diagramPng !== undefined && !(input.diagramPng instanceof Uint8Array))
    refuse("INVALID_STRUCTURE", "diagram.png", "Expected PNG bytes as Uint8Array.");
  if (input.profileId !== youtubeLocalProfile.id)
    refuse(
      "UNSUPPORTED_PROFILE",
      "/profileId",
      "Only the frozen youtube-local-v1 snapshot is supported; select it or add a reviewed versioned profile.",
    );
  const artifacts = { ...input.artifacts };
  match(
    Object.keys(artifacts).sort(),
    Object.keys(youtubeLocalProfile.artifacts).sort(),
    "/artifacts",
  );
  for (const [name, value] of Object.entries(artifacts))
    if (typeof value !== "string")
      refuse("INVALID_STRUCTURE", `/artifacts/${name}`, "Expected UTF-8 JSON text.");
  const design = parse(
    designSchema,
    parseJson(artifacts["design.json"], "design.json"),
    "design.json",
  );
  const blueprint = parse(
    designBlueprintV3Schema,
    parseJson(artifacts["blueprint.json"], "blueprint.json"),
    "blueprint.json",
  );
  const bindings = parse(
    bindingsSchema,
    parseJson(artifacts["local-bindings.json"], "local-bindings.json"),
    "local-bindings.json",
  );
  const manifest = parseJson(artifacts["manifest.json"], "manifest.json");
  const runtimePins = parse(
    z.record(z.string(), z.json()),
    parseJson(artifacts["runtime-pins.json"], "runtime-pins.json"),
    "runtime-pins.json",
  );
  const blockers = validateDesign(design).filter(
    (item) => findingCatalog[item.code].category === "structural",
  );
  if (blockers.length) refuse("INVALID_DESIGN", "design.json", canonicalJson(blockers));
  match(blueprint, designBlueprintV3(design), "blueprint.json");
  const studio = design.architecture?.studio;
  if (!studio) refuse("INVALID_DESIGN", "/architecture/studio", "A studio source is required.");
  uniqueIds(
    bindings.elements.map((item) => item.elementId),
    "bindings/elements",
  );
  uniqueIds(
    bindings.components.map((item) => item.componentId),
    "bindings/components",
  );
  uniqueIds(
    bindings.connections.map((item) => item.connectionId),
    "bindings/connections",
  );
  match(
    bindings.elements.map((item) => item.elementId).sort(),
    design.elements.map((item) => item.id).sort(),
    "bindings/elements",
  );
  match(
    bindings.components.map((item) => item.componentId).sort(),
    (studio.components ?? []).map((item) => item.id).sort(),
    "bindings/components",
  );
  match(
    bindings.connections.map((item) => item.connectionId).sort(),
    design.connections.map((item) => item.id).sort(),
    "bindings/connections",
  );
  for (const item of bindings.elements) {
    const actual = atPointer(design, item.sourcePath);
    match(
      actual,
      {
        element: item.elementId,
        definition: item.definition,
        settings: item.requiredSettings,
        ...(item.owner ? { owner: item.owner } : {}),
      },
      item.sourcePath,
    );
  }
  for (const item of bindings.components) {
    const value = atPointer(design, item.sourcePath);
    if (!value || typeof value !== "object")
      refuse(
        "CONTRADICTORY_MAPPING",
        item.sourcePath,
        "A mapping must point to its source declaration object.",
      );
    const actual = value as {
      id?: string;
      host?: string;
      settings?: unknown;
    };
    match(
      [actual.id, actual.host, actual.settings],
      [item.componentId, item.hostId, item.requiredSettings],
      item.sourcePath,
    );
    match(
      item.links,
      (studio.componentConnections ?? []).filter((link) => link.from === item.componentId),
      `${item.sourcePath}/links`,
    );
  }
  for (const item of bindings.connections) {
    const value = atPointer(design, item.sourcePath);
    if (!value || typeof value !== "object")
      refuse(
        "CONTRADICTORY_MAPPING",
        item.sourcePath,
        "A mapping must point to its source declaration object.",
      );
    const actual = value as {
      id?: string;
      from?: unknown;
      to?: unknown;
      planned?: { protocol?: string; security?: string };
    };
    match(
      [actual.id, actual.from, actual.to, actual.planned?.protocol, actual.planned?.security],
      [
        item.connectionId,
        { element: item.fromId },
        { element: item.toId },
        item.declaredProtocol,
        item.declaredSecurity,
      ],
      item.sourcePath,
    );
  }
  uniqueIds(
    bindings.explicitUnsupportedIntent.map((item) => item.sourcePath),
    "bindings/explicitUnsupportedIntent",
  );
  for (const item of bindings.explicitUnsupportedIntent)
    match(atPointer(design, item.sourcePath), item.declared, item.sourcePath);
  const canonicalSourceSha256 = sha256(canonicalJson(design));
  if (canonicalSourceSha256 !== youtubeLocalProfile.sourceCanonicalSha256)
    refuse(
      "UNSUPPORTED_SOURCE",
      "design.json",
      "This profile accepts only frozen snapshot005; archive intentional changes and add a new reviewed profile.",
    );
  match(bindings.sourceCanonicalSha256, canonicalSourceSha256, "bindings/sourceCanonicalSha256");
  // Trusted profile hashes pin the entire selectors, local policies, pins and freeze manifest.
  // The input manifest alone cannot authorize altered mappings or silently floated dependencies.
  for (const name of Object.keys(youtubeLocalProfile.artifacts) as InputArtifactName[]) {
    if (sha256(artifacts[name]) !== youtubeLocalProfile.artifacts[name].sha256)
      refuse(
        "INPUT_HASH_MISMATCH",
        name,
        "Exact frozen artifact bytes do not match the trusted profile.",
      );
  }
  const diagramPng = input.diagramPng ? new Uint8Array(input.diagramPng) : undefined;
  if (diagramPng && sha256(diagramPng) !== youtubeLocalProfile.diagram.sha256)
    refuse(
      "INPUT_HASH_MISMATCH",
      "diagram.png",
      "Image bytes do not match the source-linked diagram.",
    );
  return Object.freeze({
    ...freeze({
      profile: youtubeLocalProfile,
      artifacts,
      design,
      blueprint,
      bindings,
      runtimePins: runtimePins as JsonObject,
      inputManifest: manifest,
    }),
    diagramPng,
  });
}
export type ValidatedInput = ReturnType<typeof validateExperimentalInput>;

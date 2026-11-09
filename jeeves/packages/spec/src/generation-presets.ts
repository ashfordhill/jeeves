/** Explicit reviewed creation/attachment commands. Parsing and loading never materialize defaults.
 * The finite source seed is captured here, independent of historical v1 input/output files. */

import { type DesignDocument, designSchema } from "./design.ts";
import { emptyDesignScope } from "./design-scope.ts";
import { generationPresets, generationRuntime } from "./generation-catalog.ts";
import { youtubePresetSelections } from "./generation-preset-selections.ts";
import source from "./generation-preset-source.json" with { type: "json" };
import { idSchema } from "./ids.ts";
import { sameContractRef } from "./operation-records.ts";
import type { OperationInput } from "./operations.ts";
import { designOwnership } from "./ownership.ts";

export function buildGenerationPresetCommand(
  design: DesignDocument,
  input: { preset: "video" | "youtube"; prefix?: string },
): { ops: OperationInput[] } {
  const prefix = input.prefix === undefined ? "" : `${idSchema.parse(input.prefix)}-`;
  const seed = designSchema.parse(structuredClone(source));
  if (seed.schemaVersion !== 3 || !seed.architecture?.studio || !seed.ownership)
    throw Error("Invalid compiled seed");
  const generation = youtubePresetSelections();
  const base = new Set([
    "upload",
    "metadata-db",
    "originals",
    "upload-queue",
    "transcoder",
    "transcoded",
    "completion-events",
    "completion-handler",
    "identity",
  ]);
  if (input.preset === "video") {
    seed.architecture.system = {
      name: "Video feature",
      description:
        "Owned asset uploads and fixed CPU video processing with host-supplied product hooks.",
    };
    seed.elements = seed.elements.filter((e) => base.has(e.id));
    seed.connections = seed.connections.filter(
      (c) => base.has(c.from.element) && base.has(c.to.element),
    );
    generation.selections = generation.selections.filter((s) =>
      ["owned-multipart", "asset-lifecycle", "video-hls"].includes(s.binding.kind),
    );
    for (const selection of generation.selections)
      if (selection.binding.kind === "asset-lifecycle") delete selection.binding.publication;
    generation.preset = generationPresets.video.ref;
    for (const e of seed.elements) {
      e.name =
        e.id === "upload"
          ? "Asset upload API"
          : e.id === "completion-handler"
            ? "Asset lifecycle"
            : e.name;
      e.description =
        "Reusable owned asset upload and fixed CPU video processing; the host supplies product codecs and completion hooks.";
    }
  }
  const elements = new Set(seed.elements.map((e) => e.id)),
    connections = new Set(seed.connections.map((c) => c.id));
  const studio = seed.architecture.studio;
  studio.elements = studio.elements.filter((e) => elements.has(e.element));
  studio.connections = studio.connections.filter((c) => connections.has(c.connection));
  studio.components = studio.components?.filter(
    (c) => elements.has(c.host) && (input.preset !== "video" || c.id !== "handler-publications"),
  );
  if (input.preset === "video") {
    const guard = studio.components?.find((component) => component.id === "upload-auth");
    if (guard) {
      guard.name = "Verified uploader";
      guard.description =
        "Verifies the host application's principal; role and ownership policy are supplied by its adapter.";
    }
  }
  const components = new Set(studio.components?.map((c) => c.id));
  studio.componentConnections = studio.componentConnections?.filter(
    (c) => components.has(c.from) && c.to.kind === "element" && connections.has(c.to.via),
  );
  studio.entries = studio.entries?.filter((e) => elements.has(e.element));
  studio.actions = studio.actions?.filter((a) => studio.entries?.some((e) => e.lane === a.lane));
  const ownership = seed.ownership;
  ownership.roles = ownership.roles.filter((r) => elements.has(r.element));
  const owners = new Set(ownership.roles.map((r) => r.owner));
  ownership.owners = ownership.owners.filter((o) => owners.has(o.id));
  ownership.resources = ownership.resources.filter((r) => elements.has(r.element));
  ownership.grants = ownership.grants.filter(
    (g) => elements.has(g.role) && elements.has(g.resource),
  );
  ownership.dependencies = ownership.dependencies.filter((d) => connections.has(d.connection));
  const ids = new Set([
    ...seed.elements.map((e) => e.id),
    ...seed.connections.map((c) => c.id),
    ...(studio.components ?? []).map((c) => c.id),
    ...(studio.componentConnections ?? []).map((c) => c.id),
    ...(studio.entries ?? []).map((e) => e.id),
    ...ownership.owners.map((o) => o.id),
    ...generation.selections.map((s) => s.id),
  ]);
  const refKeys = new Set([
    "id",
    "element",
    "connection",
    "from",
    "via",
    "host",
    "owner",
    "authority",
    "role",
    "resource",
    "source",
    "origin",
    "guard",
    "upload",
    "lifecycle",
    "reader",
    "query",
  ]);
  const remap = (value: unknown, key = ""): unknown =>
    typeof value === "string"
      ? refKeys.has(key) && ids.has(value)
        ? idSchema.parse(`${prefix}${value}`)
        : value
      : Array.isArray(value)
        ? value.map((v) => remap(v, key))
        : value && typeof value === "object"
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, k)]))
          : value;
  const addition = designSchema.parse(remap({ ...seed, generation }));
  if (
    addition.schemaVersion !== 3 ||
    !addition.architecture?.studio ||
    !addition.ownership ||
    !addition.generation
  )
    throw Error("Invalid attachment");
  const current = designOwnership(design),
    existingGeneration = design.schemaVersion === 3 ? design.generation : undefined;
  if (existingGeneration && !sameContractRef(existingGeneration.runtime, generationRuntime.ref))
    throw Error("Existing runtime differs");
  if (existingGeneration?.preset)
    throw Error("Existing preset must be explicitly detached before attaching another preset");
  const occupied = new Set([
    ...design.elements.map((e) => e.id),
    ...design.connections.map((c) => c.id),
    ...(design.architecture?.studio?.components ?? []).map((c) => c.id),
    ...current.owners.map((o) => o.id),
    ...(existingGeneration?.selections ?? []).map((s) => s.id),
  ]);
  for (const id of ids)
    if (occupied.has(`${prefix}${id}`))
      throw Error(
        `Attachment identity ${prefix}${id} already exists; choose an explicit free prefix`,
      );
  const previous = design.architecture?.studio;
  const nextStudio = { ...addition.architecture.studio, ...previous };
  for (const key of [
    "elements",
    "packages",
    "connections",
    "components",
    "componentConnections",
    "entries",
  ] as const)
    Object.assign(nextStudio, {
      [key]: [...(previous?.[key] ?? []), ...(addition.architecture.studio[key] ?? [])],
    });
  nextStudio.actions = [
    ...(previous?.actions ?? []),
    ...(addition.architecture.studio.actions ?? []).filter(
      (a) => !previous?.actions?.some((p) => p.lane === a.lane),
    ),
  ];
  return {
    ops: [
      ...(design.schemaVersion === 2
        ? [{ op: "upgradeDesign" as const, scope: emptyDesignScope() }]
        : []),
      ...addition.elements.map((element) => ({ op: "addElement" as const, element })),
      ...addition.connections.map((connection) => ({ op: "connect" as const, connection })),
      {
        op: "setArchitecture",
        architecture: { ...(design.architecture ?? addition.architecture), studio: nextStudio },
      },
      {
        op: "setOwnership",
        ownership: {
          owners: [...current.owners, ...addition.ownership.owners],
          roles: [...current.roles, ...addition.ownership.roles],
          resources: [...current.resources, ...addition.ownership.resources],
          grants: [...current.grants, ...addition.ownership.grants],
          dependencies: [...current.dependencies, ...addition.ownership.dependencies],
        },
      },
      {
        op: "setGeneration",
        generation: {
          ...addition.generation,
          selections: [
            ...(existingGeneration?.selections ?? []),
            ...addition.generation.selections,
          ],
        },
      },
    ],
  };
}

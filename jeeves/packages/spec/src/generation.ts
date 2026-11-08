/** Finite source bindings. No executable paths, arbitrary maps, callbacks or SQL in saved source. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import {
  generationRuntime,
  knownGenerationPreset,
  knownGenerationTemplate,
} from "./generation-catalog.ts";
import { idSchema } from "./ids.ts";
import { exactContractRefSchema, sameContractRef } from "./operation-records.ts";
import { designOwnership } from "./ownership.ts";
import { studioApplicationKinds } from "./studio-model.ts";

export const generationTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("element"), element: idSchema }),
  z.strictObject({ kind: z.literal("component"), component: idSchema, host: idSchema }),
]);
export const generationDependencySchema = z.strictObject({
  resource: idSchema,
  connection: idSchema,
});
export const generationIdentitySchema = z.strictObject({ element: idSchema, guard: idSchema });
const dep = generationDependencySchema;
export const generationBindingSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("owned-multipart"),
    state: dep,
    objects: dep,
    identity: generationIdentitySchema,
    jobs: dep,
  }),
  z.strictObject({
    kind: z.literal("asset-lifecycle"),
    upload: idSchema,
    state: dep,
    results: dep,
    publication: dep.optional(),
  }),
  z.strictObject({
    kind: z.literal("video-hls"),
    originals: dep,
    outputs: dep,
    jobs: dep,
    results: dep,
  }),
  z.strictObject({ kind: z.literal("positive-cache-read"), source: dep, cache: dep }),
  z.strictObject({ kind: z.literal("event-counter"), state: dep, events: dep }),
  z.strictObject({ kind: z.literal("search-projection"), index: dep, events: dep }),
  z.strictObject({ kind: z.literal("search-query"), index: dep }),
  z.strictObject({ kind: z.literal("youtube-upload"), upload: idSchema, lifecycle: idSchema }),
  z.strictObject({ kind: z.literal("youtube-watch"), reader: idSchema, counts: dep, events: dep }),
  z.strictObject({ kind: z.literal("youtube-search"), query: idSchema }),
]);
export const generationSelectionSchema = z.strictObject({
  id: idSchema,
  target: generationTargetSchema,
  template: exactContractRefSchema,
  binding: generationBindingSchema,
});
export const generationSchema = z.strictObject({
  version: z.literal(1),
  runtime: exactContractRefSchema,
  preset: exactContractRefSchema.optional(),
  selections: z.array(generationSelectionSchema).max(500),
});
export type Generation = z.infer<typeof generationSchema>;
export type GenerationSelection = z.infer<typeof generationSelectionSchema>;
export type GenerationBinding = z.infer<typeof generationBindingSchema>;
export type GenerationDependency = z.infer<typeof generationDependencySchema>;
export type GenerationTarget = z.infer<typeof generationTargetSchema>;
export type GenerationIdentity = z.infer<typeof generationIdentitySchema>;
export type GenerationResourceKind = "database" | "object-store" | "queue" | "cache" | "search";
export const designGeneration = (design: DesignDocument): Generation | undefined =>
  design.schemaVersion === 3 ? design.generation : undefined;
export const generationHost = (selection: GenerationSelection) =>
  selection.target.kind === "element" ? selection.target.element : selection.target.host;

/** Explicit field traversal also gives validators/resolvers canonical source paths. */
export function generationReferences(binding: GenerationBinding) {
  const resources: {
    field: string;
    dependency: GenerationDependency;
    kind: GenerationResourceKind;
    channel?: "publish" | "consume";
  }[] = [];
  const selections: {
    field: string;
    selection: string;
    kind: GenerationBinding["kind"];
    relation: "host" | "authority";
  }[] = [];
  const resource = (
    field: string,
    dependency: GenerationDependency,
    kind: GenerationResourceKind,
    channel?: "publish" | "consume",
  ) => resources.push({ field, dependency, kind, ...(channel && { channel }) });
  const selected = (
    field: string,
    selection: string,
    kind: GenerationBinding["kind"],
    relation: "host" | "authority" = "host",
  ) => selections.push({ field, selection, kind, relation });
  switch (binding.kind) {
    case "owned-multipart":
      resource("state", binding.state, "database");
      resource("objects", binding.objects, "object-store");
      resource("jobs", binding.jobs, "queue", "publish");
      break;
    case "asset-lifecycle":
      selected("upload", binding.upload, "owned-multipart", "authority");
      resource("state", binding.state, "database");
      resource("results", binding.results, "queue", "consume");
      if (binding.publication) resource("publication", binding.publication, "queue", "publish");
      break;
    case "video-hls":
      resource("originals", binding.originals, "object-store");
      resource("outputs", binding.outputs, "object-store");
      resource("jobs", binding.jobs, "queue", "consume");
      resource("results", binding.results, "queue", "publish");
      break;
    case "positive-cache-read":
      resource("source", binding.source, "database");
      resource("cache", binding.cache, "cache");
      break;
    case "event-counter":
      resource("state", binding.state, "database");
      resource("events", binding.events, "queue", "consume");
      break;
    case "search-projection":
      resource("index", binding.index, "search");
      resource("events", binding.events, "queue", "consume");
      break;
    case "search-query":
      resource("index", binding.index, "search");
      break;
    case "youtube-upload":
      selected("upload", binding.upload, "owned-multipart");
      selected("lifecycle", binding.lifecycle, "asset-lifecycle", "authority");
      break;
    case "youtube-watch":
      selected("reader", binding.reader, "positive-cache-read");
      resource("counts", binding.counts, "database");
      resource("events", binding.events, "queue", "publish");
      break;
    case "youtube-search":
      selected("query", binding.query, "search-query");
      break;
  }
  return { resources, selections };
}

/** Unknown exact refs survive as unavailable declarations; canonical contradictions refuse edits. */
export function generationFindings(design: DesignDocument): Finding[] {
  const model = designGeneration(design);
  if (!model) return [];
  const findings: Finding[] = [];
  const report = (
    code: "CONFIG_INVALID" | "CONFIG_REQUIRED" | "UNKNOWN_REFERENCE" | "NEEDS_TEMPLATE",
    path: (string | number)[],
    message: string,
    element?: string,
  ) =>
    findings.push(
      finding(code, message, { path: ["generation", ...path], ...(element && { element }) }),
    );
  if (!sameContractRef(model.runtime, generationRuntime.ref))
    report(
      "NEEDS_TEMPLATE",
      ["runtime"],
      "Unresolved exact generation runtime; no code may be selected from it.",
    );
  if (model.preset && !knownGenerationPreset(model.preset))
    report(
      "NEEDS_TEMPLATE",
      ["preset"],
      "Unresolved exact generation preset; no defaults may be substituted.",
    );
  const studio = design.architecture?.studio;
  const elements = new Set(design.elements.map((entry) => entry.id));
  const kinds = new Map(studio?.elements.map((entry) => [entry.element, entry.settings.kind]));
  const ids = new Set<string>(),
    targets = new Set<string>();
  model.selections.forEach((selection, index) => {
    const base = ["selections", index],
      host = generationHost(selection),
      refs = generationReferences(selection.binding),
      known = knownGenerationTemplate(selection.template);
    const row = (
      code: "CONFIG_INVALID" | "CONFIG_REQUIRED" | "UNKNOWN_REFERENCE" | "NEEDS_TEMPLATE",
      path: (string | number)[],
      message: string,
    ) => report(code, [...base, ...path], message, host);
    if (ids.has(selection.id))
      row("CONFIG_INVALID", ["id"], `Duplicate generation selection ${selection.id}.`);
    ids.add(selection.id);
    const target = `${JSON.stringify(selection.target)}:${selection.binding.kind}`;
    if (targets.has(target))
      row("CONFIG_INVALID", ["target"], "Select each template binding once per canonical target.");
    targets.add(target);
    if (!elements.has(host))
      row("UNKNOWN_REFERENCE", ["target"], `Missing generation host ${host}.`);
    else if (!studioApplicationKinds.some((kind) => kind === kinds.get(host)))
      row("CONFIG_INVALID", ["target"], "A generation target must be a studio application.");
    if (selection.target.kind === "component") {
      const componentId = selection.target.component;
      const component = studio?.components?.find((entry) => entry.id === componentId);
      if (!component)
        row(
          "UNKNOWN_REFERENCE",
          ["target", "component"],
          "Missing canonical generation component.",
        );
      else if (component.host !== host)
        row(
          "CONFIG_INVALID",
          ["target", "host"],
          "Component host does not match generation target.",
        );
    }
    if (selection.binding.kind === "owned-multipart") {
      const identity = selection.binding.identity;
      if (!elements.has(identity.element))
        row(
          "UNKNOWN_REFERENCE",
          ["binding", "identity", "element"],
          "Missing canonical identity element.",
        );
      else if (kinds.get(identity.element) !== "identity")
        row(
          "CONFIG_INVALID",
          ["binding", "identity", "element"],
          "Verified identity must bind an identity tile.",
        );
      const guard = studio?.components?.find((entry) => entry.id === identity.guard);
      if (!guard)
        row(
          "UNKNOWN_REFERENCE",
          ["binding", "identity", "guard"],
          "Missing canonical authentication guard.",
        );
      else if (guard.host !== host || guard.settings.kind !== "auth-guard")
        row(
          "CONFIG_INVALID",
          ["binding", "identity", "guard"],
          "Authentication guard must belong to the selected upload host.",
        );
    }
    if (known && known.definition.binding !== selection.binding.kind)
      row(
        "CONFIG_INVALID",
        ["binding", "kind"],
        "The exact template reference requires its own tagged binding.",
      );
    row(
      "NEEDS_TEMPLATE",
      ["template"],
      known
        ? "Declared template only; an installed implementation must be resolved by the generation host."
        : "Unresolved exact template reference; no code may be selected from it.",
    );
    for (const { field, dependency, kind, channel } of refs.resources) {
      const path = ["binding", field];
      if (!elements.has(dependency.resource))
        row(
          "UNKNOWN_REFERENCE",
          [...path, "resource"],
          `Missing bound ${kind} ${dependency.resource}.`,
        );
      else if (kinds.get(dependency.resource) !== kind)
        row("CONFIG_INVALID", [...path, "resource"], `Binding requires a canonical ${kind}.`);
      const connection = design.connections.find((entry) => entry.id === dependency.connection);
      if (!connection)
        row(
          "UNKNOWN_REFERENCE",
          [...path, "connection"],
          `Missing bound connection ${dependency.connection}.`,
        );
      else if (
        connection.from.element !== (channel === "consume" ? dependency.resource : host) ||
        connection.to.element !== (channel === "consume" ? host : dependency.resource)
      )
        row(
          "CONFIG_INVALID",
          [...path, "connection"],
          "Bound connection endpoints must match the selected host and resource.",
        );
      if (
        connection &&
        channel &&
        studio?.connections.find((entry) => entry.connection === connection.id)?.settings
          .channelUse !== channel
      )
        row(
          "CONFIG_INVALID",
          [...path, "connection"],
          `Bound channel must declare ${channel} use.`,
        );
    }
    if (selection.binding.kind === "youtube-upload") {
      const binding = selection.binding;
      const lifecycle = model.selections.find((entry) => entry.id === binding.lifecycle);
      if (
        lifecycle?.binding.kind === "asset-lifecycle" &&
        lifecycle.binding.upload !== binding.upload
      )
        row(
          "CONFIG_INVALID",
          ["binding", "lifecycle"],
          "YouTube upload lifecycle must reference the adapter's chosen owned-upload selection.",
        );
    }
    for (const ref of refs.selections) {
      const selected = model.selections.find((entry) => entry.id === ref.selection);
      if (!selected)
        row(
          "UNKNOWN_REFERENCE",
          ["binding", ref.field],
          `Missing generation selection ${ref.selection}.`,
        );
      else if (selected.binding.kind !== ref.kind)
        row("CONFIG_INVALID", ["binding", ref.field], `Binding requires a ${ref.kind} selection.`);
      else if (ref.relation === "host" && generationHost(selected) !== host)
        row(
          "CONFIG_INVALID",
          ["binding", ref.field],
          "Adapter selection must belong to the same host.",
        );
      else if (ref.relation === "authority") {
        const roles = designOwnership(design).roles,
          owner = roles.find((entry) => entry.element === host)?.owner,
          otherOwner = roles.find((entry) => entry.element === generationHost(selected))?.owner;
        if (!owner || !otherOwner)
          row(
            "CONFIG_REQUIRED",
            ["binding", ref.field],
            "Cross-role lifecycle binding needs explicit owner declarations.",
          );
        else if (owner !== otherOwner)
          row(
            "CONFIG_INVALID",
            ["binding", ref.field],
            "Upload and lifecycle roles must share explicit authority.",
          );
        if (
          selection.binding.kind === "asset-lifecycle" &&
          selected.binding.kind === "owned-multipart" &&
          selection.binding.state.resource !== selected.binding.state.resource
        )
          row(
            "CONFIG_INVALID",
            ["binding", "state"],
            "Upload and lifecycle must bind the same authoritative state resource.",
          );
      }
    }
  });
  return findings;
}

/** Delete a selected target with its selection. Surviving consumers of removed facts must refuse. */
export function pruneGenerationTargets(
  design: DesignDocument,
  removedElements: readonly string[] = [],
  removedComponents: readonly string[] = [],
) {
  const model = designGeneration(design);
  if (!model) return;
  model.selections = model.selections.filter(
    (entry) =>
      !removedElements.includes(generationHost(entry)) &&
      !(entry.target.kind === "component" && removedComponents.includes(entry.target.component)),
  );
}

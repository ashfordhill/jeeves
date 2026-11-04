/** A reusable grouping of real applications, not an additional runtime or settings kind. */
import { idSchema } from "./ids.ts";
import {
  createStudioSettings,
  type DefinitionRef,
  studioDefinitionVersion,
} from "./studio-model.ts";
import type { StudioCommand } from "./studio-operations.ts";

export const studioServiceWorkerPreset = Object.freeze({
  id: "studio-service-worker",
  version: studioDefinitionVersion,
  name: "Service and worker",
  creationName: "Service and worker",
  description: "An independent application and worker sharing one package-owned work queue.",
  libraryGroup: "Presets",
  creationScopes: Object.freeze(["c2"] as const),
  members: Object.freeze(["service", "worker"] as const),
  resources: Object.freeze(["queue"] as const),
  visual: Object.freeze({ icon: "building", color: "api", shape: "box" } as const),
  c4bObligations: Object.freeze([
    "Application/worker behavior, broker integration and delivery guarantees require implementation. The package is a grouping, not another deployment.",
  ]),
});
export const studioPackagePresets = Object.freeze([studioServiceWorkerPreset]);
export function resolveStudioPackagePreset(ref: DefinitionRef) {
  return studioPackagePresets.find(
    (preset) => preset.id === ref.id && preset.version === ref.version,
  );
}
export type StudioServiceWorkerIds = Record<
  "package" | "service" | "worker" | "queue" | "publish" | "consume",
  string
>;

/** Caller allocates every ID. The returned command is submitted as one ordinary atomic batch. */
export function instantiateStudioPackagePreset(
  ref: DefinitionRef,
  ids: StudioServiceWorkerIds,
  system?: Extract<StudioCommand, { type: "create" }>["system"],
): Extract<StudioCommand, { type: "create" }> {
  const preset = resolveStudioPackagePreset(ref);
  if (!preset) throw new Error(`Unknown studio package preset ${ref.id}@${ref.version}.`);
  const values = Object.values(ids).map((id) => idSchema.parse(id));
  if (values.length !== 6 || new Set(values).size !== values.length)
    throw new Error("Provide six distinct identities for the package preset.");
  return {
    type: "create",
    ...(system && { system: structuredClone(system) }),
    elements: [
      { id: ids.service, name: "Microservice", settings: createStudioSettings("service") },
      { id: ids.worker, name: "Worker service", settings: createStudioSettings("worker") },
      {
        id: ids.queue,
        name: "Work queue",
        settings: createStudioSettings("queue"),
        owner: { kind: "package", id: ids.package },
      },
    ],
    connections: [
      {
        id: ids.publish,
        from: ids.service,
        to: ids.queue,
        kind: "depends-on",
        planned: {
          label: "Publishes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: { channelUse: "publish" },
      },
      {
        id: ids.consume,
        from: ids.queue,
        to: ids.worker,
        kind: "depends-on",
        planned: {
          label: "Consumes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: { channelUse: "consume" },
      },
    ],
    package: {
      id: ids.package,
      name: preset.creationName,
      description: "",
      members: [ids.service, ids.worker],
      preset: { id: preset.id, version: preset.version },
    },
  };
}

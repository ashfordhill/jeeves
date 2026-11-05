/** A reusable grouping of real applications, not an additional runtime or settings kind. */
import { type DefinitionRef, studioDefinitionVersion } from "./studio-model.ts";

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

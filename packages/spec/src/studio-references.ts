/** Remap graph identities, never immutable definition identities or example provenance. */
import type { StudioModel, StudioSettings } from "./studio-model.ts";

export function mapStudioSettings(
  settings: StudioSettings,
  ids: Readonly<Record<string, string>>,
): StudioSettings {
  const ref = (id: string) => ids[id] ?? id;
  if (settings.kind === "browser" && settings.delivery === "bundled")
    return { ...settings, ...(settings.servedBy && { servedBy: ref(settings.servedBy) }) };
  if (settings.kind === "cdn")
    return { ...settings, ...(settings.origin && { origin: ref(settings.origin) }) };
  if (settings.kind === "redirect")
    return {
      ...settings,
      ...(settings.lookupStoreConnection && {
        lookupStoreConnection: ref(settings.lookupStoreConnection),
      }),
      ...(settings.lookupCacheConnection && {
        lookupCacheConnection: ref(settings.lookupCacheConnection),
      }),
    };
  return structuredClone(settings);
}

export function studioSettingReferences(settings: StudioSettings): string[] {
  if (settings.kind === "browser" && settings.delivery === "bundled")
    return settings.servedBy ? [settings.servedBy] : [];
  if (settings.kind === "cdn") return settings.origin ? [settings.origin] : [];
  if (settings.kind === "redirect")
    return [settings.lookupStoreConnection, settings.lookupCacheConnection].filter(
      (id): id is string => !!id,
    );
  return [];
}

export function mapStudioModel(
  studio: StudioModel,
  ids: Readonly<Record<string, string>>,
): StudioModel {
  const ref = (id: string) => ids[id] ?? id;
  return {
    ...structuredClone(studio),
    elements: studio.elements.map((binding) => ({
      ...structuredClone(binding),
      element: ref(binding.element),
      settings: mapStudioSettings(binding.settings, ids),
      ...(binding.owner && { owner: { ...binding.owner, id: ref(binding.owner.id) } }),
    })),
    packages: studio.packages.map((item) => ({
      ...structuredClone(item),
      id: ref(item.id),
      members: item.members.map(ref),
    })),
    connections: studio.connections.map((binding) => ({
      ...structuredClone(binding),
      connection: ref(binding.connection),
    })),
  };
}

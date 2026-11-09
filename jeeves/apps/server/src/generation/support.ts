import { loadLocalV2Registry } from "@jeeves/generator";

// The actual executing default registry, not a second hand-maintained capability list.
let registry: ReturnType<typeof loadLocalV2Registry> | undefined;
export const executingGenerationRegistry = () => {
  registry ??= loadLocalV2Registry();
  return registry;
};

export const installedGenerationSupport = () => executingGenerationRegistry().installed;

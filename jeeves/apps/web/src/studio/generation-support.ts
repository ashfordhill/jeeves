import { buildSupportedAuthoringCommand, type GenerationInstalledSupport } from "@jeeves/spec";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../project/api.ts";

const absent: GenerationInstalledSupport = { templates: [] };
let support = absent;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const getGenerationSupport = () => support;
export function useGenerationSupport() {
  useEffect(() => {
    if (pending) return;
    pending = api
      .generationSupport()
      .then((value) => {
        support = value;
        for (const listener of listeners) listener();
      })
      .catch(() => {
        pending = undefined;
      });
  }, []);
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getGenerationSupport);
}
export const buildEditorCommand = (
  design: Parameters<typeof buildSupportedAuthoringCommand>[0],
  command: Parameters<typeof buildSupportedAuthoringCommand>[1],
) => buildSupportedAuthoringCommand(design, command, getGenerationSupport());

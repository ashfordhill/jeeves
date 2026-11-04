import type { Viewport } from "@xyflow/react";
import { useEffect, useState } from "react";

type Preferences = {
  chatOpen: boolean;
  inspectorOpen: boolean;
  chatWidth: number;
  inspectorWidth: number;
  scope?: string;
  cameras: Record<string, Viewport>;
};
const defaults: Preferences = {
  chatOpen: true,
  inspectorOpen: false,
  chatWidth: 300,
  inspectorWidth: 320,
  cameras: {},
};
const key = (project: string) => `jeeves.studio.ui.v1:${project}`;
const width = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(240, Math.min(400, value))
    : fallback;
function read(project: string): Preferences {
  try {
    const saved: Partial<Preferences> = JSON.parse(localStorage.getItem(key(project)) ?? "{}");
    const cameras = Object.fromEntries(
      Object.entries(saved.cameras ?? {}).filter(
        ([, camera]) =>
          camera &&
          [camera.x, camera.y, camera.zoom].every(Number.isFinite) &&
          camera.zoom >= 0.1 &&
          camera.zoom <= 2,
      ),
    );
    return {
      chatOpen: typeof saved.chatOpen === "boolean" ? saved.chatOpen : true,
      inspectorOpen: typeof saved.inspectorOpen === "boolean" ? saved.inspectorOpen : false,
      chatWidth: width(saved.chatWidth, 300),
      inspectorWidth: width(saved.inspectorWidth, 320),
      scope: typeof saved.scope === "string" ? saved.scope : undefined,
      cameras,
    };
  } catch {
    return { ...defaults, cameras: {} };
  }
}

/** UI-only state never writes a semantic document or an existing project's layout. */
export function useStudioPreferences(project: string) {
  const [preferences, setPreferences] = useState(() => read(project));
  useEffect(() => {
    try {
      localStorage.setItem(key(project), JSON.stringify(preferences));
    } catch {
      // Browsers may deny local preferences; the current session remains usable.
    }
  }, [project, preferences]);
  return [preferences, setPreferences] as const;
}

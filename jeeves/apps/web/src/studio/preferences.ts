import { useEffect, useState } from "react";

type Preferences = {
  chatOpen: boolean;
  inspectorOpen: boolean;
  chatWidth: number;
  inspectorWidth: number;
};
const defaults: Preferences = {
  chatOpen: true,
  inspectorOpen: false,
  chatWidth: 300,
  inspectorWidth: 320,
};
const key = (project: string) => `jeeves.studio.ui.v1:${project}`;
const width = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(240, Math.min(400, value))
    : fallback;
function read(project: string): Preferences {
  try {
    const saved: Partial<Preferences> = JSON.parse(localStorage.getItem(key(project)) ?? "{}");
    return {
      chatOpen: typeof saved.chatOpen === "boolean" ? saved.chatOpen : defaults.chatOpen,
      inspectorOpen:
        typeof saved.inspectorOpen === "boolean" ? saved.inspectorOpen : defaults.inspectorOpen,
      chatWidth: width(saved.chatWidth, defaults.chatWidth),
      inspectorWidth: width(saved.inspectorWidth, defaults.inspectorWidth),
    };
  } catch {
    return { ...defaults };
  }
}

/** The rails' open state and widths, per project in this browser. Never part of the design. */
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

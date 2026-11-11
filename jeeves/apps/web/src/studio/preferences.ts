import { useEffect, useState } from "react";

/**
 * The canvas's view, in the toggle's order: module hosts drawn as containers of their modules
 * (the default), or one plain tile per element.
 */
export const canvasViews = ["detailed", "simple"] as const;
export type CanvasView = (typeof canvasViews)[number];
/** A view saved before Simple had its name ("overview") reads as Simple. */
const savedView = (value: unknown): CanvasView | undefined =>
  value === "overview" ? "simple" : canvasViews.find((view) => view === value);

type Preferences = {
  chatOpen: boolean;
  inspectorOpen: boolean;
  chatWidth: number;
  inspectorWidth: number;
  view: CanvasView;
};
const defaults: Preferences = {
  chatOpen: true,
  inspectorOpen: false,
  chatWidth: 300,
  inspectorWidth: 320,
  view: "detailed",
};
const key = (project: string) => `jeeves.studio.ui.v1:${project}`;
const width = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(240, Math.min(400, value))
    : fallback;
/** A project's saved preferences; anything missing or invalid takes its default. */
export function readPreferences(project: string): Preferences {
  try {
    const saved: Partial<Preferences> = JSON.parse(localStorage.getItem(key(project)) ?? "{}");
    return {
      chatOpen: typeof saved.chatOpen === "boolean" ? saved.chatOpen : defaults.chatOpen,
      inspectorOpen:
        typeof saved.inspectorOpen === "boolean" ? saved.inspectorOpen : defaults.inspectorOpen,
      chatWidth: width(saved.chatWidth, defaults.chatWidth),
      inspectorWidth: width(saved.inspectorWidth, defaults.inspectorWidth),
      view: savedView(saved.view) ?? defaults.view,
    };
  } catch {
    return { ...defaults };
  }
}

/**
 * The rails' open state and widths and the canvas view, per project in this browser. Never part
 * of the design, its history, the blueprint or chat.
 */
export function useStudioPreferences(project: string) {
  const [preferences, setPreferences] = useState(() => readPreferences(project));
  useEffect(() => {
    try {
      localStorage.setItem(key(project), JSON.stringify(preferences));
    } catch {
      // Browsers may deny local preferences; the current session remains usable.
    }
  }, [project, preferences]);
  return [preferences, setPreferences] as const;
}

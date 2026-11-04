/** The three top-level views. The selected one lives in the URL hash (#/draw, #/runs, #/settings). */
export const VIEWS = [
  { id: "draw", label: "Design" },
  { id: "runs", label: "Generate" },
  { id: "settings", label: "Settings" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export const DEFAULT_VIEW: ViewId = "draw";

export function viewFromHash(hash: string): ViewId {
  const id = hash.replace(/^#\/?/, "");
  return VIEWS.find((v) => v.id === id)?.id ?? DEFAULT_VIEW;
}

/** The top-level views. The selected one lives in the URL hash (#/design, #/settings). */
export const VIEWS = [
  { id: "design", label: "Design" },
  { id: "settings", label: "Settings" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export const DEFAULT_VIEW: ViewId = "design";

export function viewFromHash(hash: string): ViewId {
  const id = hash.replace(/^#\/?/, "");
  return VIEWS.find((v) => v.id === id)?.id ?? DEFAULT_VIEW;
}

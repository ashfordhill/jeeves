/** Temporary opt-in only. UX15 owns default rollout and removal of this switch. */
export function isNextStudio(): boolean {
  return new URLSearchParams(window.location.search).get("studio") === "next";
}

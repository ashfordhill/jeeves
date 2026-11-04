/** Shared by the diagram and its routing worker; no UI or DOM dependencies. */
export function boundedStudioText(text: string, limit: number) {
  const characters = Array.from(text.replace(/\s+/g, " ").trim());
  return characters.length <= limit
    ? characters.join("")
    : `${characters.slice(0, limit - 1).join("")}…`;
}

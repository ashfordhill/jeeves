// Ported from automation-illustrator src/board/tiles/svgInner.ts (0803c4a).

/** Inner markup of a standalone SVG file, for wrappers that set size and color. */
export function svgInner(markup: string): string {
  const open = markup.indexOf(">");
  const close = markup.lastIndexOf("</svg>");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error("svgInner: expected a complete <svg> document");
  }
  return markup.slice(open + 1, close).trim();
}

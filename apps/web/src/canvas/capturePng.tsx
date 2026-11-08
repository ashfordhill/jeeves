import { type BoardSnapshot, BoardSnapshotView } from "@jeeves/board";
import { toCanvas } from "html-to-image";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { CAPTURE_BACKGROUND, CAPTURE_SCALE, captureBounds, sha256 } from "./diagramCapture.ts";
import "./diagram-export.css";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Embed the same bundled font faces as the studio. Fetch failures must not yield fallback PNGs. */
async function captureFonts(signal: AbortSignal) {
  const faces = Array.from(document.styleSheets).flatMap((sheet) =>
    Array.from(sheet.cssRules).filter(
      (rule): rule is CSSFontFaceRule =>
        rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes("Nunito Variable"),
    ),
  );
  if (!faces.length) throw new Error("The studio font is unavailable. Reload and try again.");
  return (
    await Promise.all(
      faces.map(async (rule) => {
        let css = rule.cssText;
        const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
        for (const [match, url] of urls) {
          if (!url) continue;
          const response = await fetch(new URL(url, rule.parentStyleSheet?.href ?? location.href), {
            signal,
          });
          if (!response.ok) throw new Error("The studio font could not be embedded. Try again.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("The studio font could not be read."));
            void response.blob().then((blob) => reader.readAsDataURL(blob), reject);
          });
          css = css.replace(match, `url("${data}")`);
        }
        return css;
      }),
    )
  ).join("\n");
}

/** Same React Flow tile and SVG line renderers, mounted offscreen at their resolved board scale. */
export async function capturePng(
  snapshot: BoardSnapshot,
  signal: AbortSignal,
  assertCurrent: () => void,
) {
  const bounds = captureBounds(snapshot);
  const host = document.createElement("div");
  host.className = "diagram-capture-host";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  document.body.append(host);
  const root = createRoot(host);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    host.remove();
    // Closing/switching can abort during the workspace's React commit.
    queueMicrotask(() => root.unmount());
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    flushSync(() => root.render(<BoardSnapshotView snapshot={snapshot} bounds={bounds} />));
    const surface = host.querySelector<HTMLElement>(".board-snapshot");
    if (!surface) throw new Error("The capture surface could not be opened.");
    const fontEmbedCSS = await captureFonts(signal);
    const sample = snapshot.tiles.map((tile) => tile.label).join(" ");
    await document.fonts.load('800 14px "Nunito Variable"', sample);
    await document.fonts.ready;
    if (!document.fonts.check('800 14px "Nunito Variable"', sample))
      throw new Error("The studio font has not loaded. Try again.");
    // React Flow must commit every offscreen node and SVG edge before capture.
    let drawn = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      signal.throwIfAborted();
      assertCurrent();
      await frame();
      if (
        surface.querySelectorAll(".react-flow__node").length === snapshot.tiles.length &&
        surface.querySelectorAll(".react-flow__edge-path").length === snapshot.lines.length &&
        surface.querySelectorAll(".board-line-arrow").length ===
          snapshot.lines.filter((line) => line.directed).length
      ) {
        drawn = true;
        break;
      }
    }
    if (!drawn) throw new Error("Some diagram tiles or routes did not render. PNG export stopped.");
    await frame();
    const canvas = await toCanvas(surface, {
      width: bounds.w,
      height: bounds.h,
      pixelRatio: CAPTURE_SCALE,
      backgroundColor: CAPTURE_BACKGROUND,
      fontEmbedCSS,
      // html-to-image deep-clones SVG descendants. Preserve board-scoped variables so their
      // inline stroke: var(--board-line/paper) still resolves inside the serialized image.
      includeStyleProperties: Array.from(getComputedStyle(surface)),
      skipAutoScale: true, // Bounds are checked first; never silently shrink a large image.
      filter: (node) => !(node instanceof Element && node.hasAttribute("data-export-omit")),
    });
    signal.throwIfAborted();
    assertCurrent();
    if (canvas.width !== bounds.w * CAPTURE_SCALE || canvas.height !== bounds.h * CAPTURE_SCALE)
      throw new Error("The browser changed the image dimensions. PNG export stopped.");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (blob?.type === "image/png" && blob.size) resolve(blob);
        else reject(new Error("The browser could not encode this diagram as PNG."));
      }, "image/png"),
    );
    return {
      blob,
      bounds,
      width: canvas.width,
      height: canvas.height,
      pngSha256: await sha256(await blob.arrayBuffer()),
      fontCssSha256: await sha256(new TextEncoder().encode(fontEmbedCSS)),
    };
  } finally {
    signal.removeEventListener("abort", dispose);
    dispose();
  }
}

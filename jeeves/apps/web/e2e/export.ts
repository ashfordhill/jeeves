/** Exports the PNG and its capture details by mouse, and checks the PNG has visible routes. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { expect } from "./studio.ts";

export type Details = {
  capturedAt: string;
  project: { id: string; revision: number };
  image: {
    filename: string;
    width: number;
    height: number;
    sha256: string;
    scale: number;
    bounds: { x: number; y: number };
  };
  view: { canvas?: string; owners: { rendered: string; requestedExpanded: boolean }[] };
  tiles: { id: string }[];
  lines: { id: string }[];
  layout: { routes: Record<string, { x: number; y: number }[]> };
};
const bytes = async (download: Download) => {
  const path = await download.path();
  if (!path) throw new Error("Missing downloaded file");
  return readFile(path);
};
export async function exportPng(page: Page) {
  // Observe the actual offscreen export artwork. The live view may still be animating from a
  // view switch; its intermediate d is not the snapshot geometry being rasterized.
  const capture = await page.evaluateHandle(() => {
    const state = {
      artwork: {} as Record<string, { d: string; light?: string }>,
      observer: undefined as MutationObserver | undefined,
    };
    state.observer = new MutationObserver(() => {
      for (const edge of document.querySelectorAll(".diagram-capture-host .react-flow__edge")) {
        const id = edge.getAttribute("data-id");
        const d = edge.querySelector(".react-flow__edge-path")?.getAttribute("d");
        if (id && d)
          state.artwork[id] = {
            d,
            light: (edge.querySelector(".board-wire") as SVGElement | null)?.style.getPropertyValue(
              "--wire-light",
            ),
          };
      }
    });
    state.observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    return state;
  });
  await page.getByRole("button", { name: "Export diagram", exact: true }).click();
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const pngDownload = await pngEvent;
  const png = await bytes(pngDownload);
  const artwork = await capture.evaluate((state) => {
    state.observer?.disconnect();
    return state.artwork;
  });
  await capture.dispose();
  const jsonEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download capture details" }).click();
  const jsonDownload = await jsonEvent;
  const details: Details = JSON.parse((await bytes(jsonDownload)).toString());
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(createHash("sha256").update(png).digest("hex")).toBe(details.image.sha256);
  expect(png.readUInt32BE(16)).toBe(details.image.width);
  expect(png.readUInt32BE(20)).toBe(details.image.height);
  // SVG wrappers and CSS variables can disappear in foreignObject rasterization despite a
  // complete DOM. Sample route ink from the actual PNG to catch that failure.
  const missing = await page.evaluate(
    async ({ base64, details, artwork }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No PNG decoder");
      ctx.drawImage(img, 0, 0);
      return Object.keys(details.layout.routes).flatMap((id) => {
        const art = artwork[id];
        if (!art?.d) return [id];
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", art.d);
        const length = path.getTotalLength();
        // Native SVG geometry includes cubic fans, quadratic corners and gathers. Wire colour
        // is checked in the decoded PNG, so invisible/black/theme-dark wire bodies fail too.
        const colour = art.light?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        const expected = colour?.slice(1).map((hex) => Number.parseInt(hex, 16));
        for (let step = 5; step <= 95; step++) {
          const at = path.getPointAtLength((length * step) / 100);
          const x = Math.round((at.x - details.image.bounds.x) * details.image.scale);
          const y = Math.round((at.y - details.image.bounds.y) * details.image.scale);
          const pixels = ctx.getImageData(x - 2, y - 2, 5, 5).data;
          for (let i = 0; i < pixels.length; i += 4) {
            if (
              expected
                ? expected.every((channel, j) => Math.abs((pixels[i + j] ?? 255) - channel) < 15)
                : (pixels[i] ?? 255) < 80 &&
                  (pixels[i + 1] ?? 255) < 110 &&
                  (pixels[i + 2] ?? 255) < 130
            )
              return [];
          }
        }
        return [id];
      });
    },
    { base64: png.toString("base64"), details, artwork },
  );
  expect(missing, "Every exported route contains its light wire colour").toEqual([]);
  await page.getByRole("button", { name: "Close export diagram" }).click();
  await expect(page.locator(".diagram-capture-host")).toHaveCount(0);
  return {
    png,
    artwork,
    details,
    filenames: [pngDownload.suggestedFilename(), jsonDownload.suggestedFilename()],
  };
}

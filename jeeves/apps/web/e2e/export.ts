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
  await page.getByRole("button", { name: "Export diagram", exact: true }).click();
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const pngDownload = await pngEvent;
  const png = await bytes(pngDownload);
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
    async ({ base64, details }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No PNG decoder");
      ctx.drawImage(img, 0, 0);
      return Object.entries(details.layout.routes).flatMap(([id, route]) => {
        const pairs = route.slice(1).flatMap((b, i) => {
          const a = route[i];
          return a ? [{ a, b }] : [];
        });
        const segment = pairs.sort(
          (x, y) =>
            Math.hypot(y.b.x - y.a.x, y.b.y - y.a.y) - Math.hypot(x.b.x - x.a.x, x.b.y - x.a.y),
        )[0];
        if (!segment) return [id];
        const { a, b } = segment;
        for (let step = 25; step <= 75; step++) {
          const x = Math.round(
            (a.x + ((b.x - a.x) * step) / 100 - details.image.bounds.x) * details.image.scale,
          );
          const y = Math.round(
            (a.y + ((b.y - a.y) * step) / 100 - details.image.bounds.y) * details.image.scale,
          );
          const pixels = ctx.getImageData(x - 2, y - 2, 5, 5).data;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              (pixels[i] ?? 255) < 80 &&
              (pixels[i + 1] ?? 255) < 110 &&
              (pixels[i + 2] ?? 255) < 130
            )
              return [];
        }
        return [id];
      });
    },
    { base64: png.toString("base64"), details },
  );
  expect(missing, "Every exported route contains visible ink").toEqual([]);
  await page.getByRole("button", { name: "Close export diagram" }).click();
  await expect(page.locator(".diagram-capture-host")).toHaveCount(0);
  return {
    png,
    details,
    filenames: [pngDownload.suggestedFilename(), jsonDownload.suggestedFilename()],
  };
}

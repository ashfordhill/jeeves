import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { createStudy, expect, lines, test, tile } from "./studio.ts";

type Details = {
  project: { id: string; revision: number };
  image: {
    width: number;
    height: number;
    sha256: string;
    scale: number;
    bounds: { x: number; y: number };
  };
  view: { owners: { rendered: string; requestedExpanded: boolean }[] };
  tiles: { id: string }[];
  lines: { id: string }[];
  layout: { routes: Record<string, { x: number; y: number }[]> };
};
const bytes = async (download: Download) => {
  const path = await download.path();
  if (!path) throw new Error("Missing downloaded file");
  return readFile(path);
};
async function exportPng(page: Page) {
  await page.getByRole("button", { name: "Export diagram", exact: true }).click();
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const png = await bytes(await pngEvent);
  const jsonEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download capture details" }).click();
  const details: Details = JSON.parse((await bytes(await jsonEvent)).toString());
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
  return { png, details };
}
const view = (page: Page) =>
  page.locator(".lane-canvas .board").evaluate((board) => ({
    camera: board.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform,
    nodes: Array.from(board.querySelectorAll<HTMLElement>(".react-flow__node")).map((el) => [
      el.dataset.id,
      el.style.transform,
      el.className,
    ]),
    edges: Array.from(board.querySelectorAll<HTMLElement>(".react-flow__edge")).map((el) => [
      el.dataset.id,
      el.getAttribute("class"),
    ]),
  }));

test("PNG contains full YouTube routes after mouse focus, pan, zoom and dark mode without changing state", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E PNG YouTube", "YouTube · studio study");
  try {
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    const first = await exportPng(page);
    expect(first.details.tiles).toHaveLength(21);
    expect(first.details.lines).toHaveLength(25);
    await tile(page, "Transcoder").click();
    await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
    await expect(lines(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Hand", exact: true }).click();
    const paper = await page.locator(".lane-canvas").boundingBox();
    if (!paper) throw new Error("No paper");
    await page.mouse.move(paper.x + paper.width / 2, paper.y + paper.height / 2);
    await page.mouse.down();
    await page.mouse.move(paper.x + paper.width / 2 - 200, paper.y + paper.height / 2 + 60, {
      steps: 5,
    });
    await page.mouse.up();
    await page.mouse.wheel(0, -450);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const focused = await view(page);
    const second = await exportPng(page);
    expect(second.details.image.sha256).toBe(first.details.image.sha256);
    expect(await view(page)).toEqual(focused);
    await expect(lines(page)).toHaveCount(4);
    expect(await (await page.request.get(`/api/projects/${id}/design`)).json()).toEqual(before);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("owner projection is explicit; stale revisions, missing fonts and cancelled captures refuse downloads", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E PNG owner");
  let switched: string | undefined;
  try {
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    const collapsed = await exportPng(page);
    expect(collapsed.details.view.owners[0]).toMatchObject({
      rendered: "collapsed",
      requestedExpanded: false,
    });
    expect(collapsed.details.tiles).toHaveLength(6);
    await page.getByRole("button", { name: "Expand roles", exact: true }).click();
    // Export while the owner expansion is still arranging/animating.
    const expanded = await exportPng(page);
    expect(expanded.details.view.owners[0]).toMatchObject({
      rendered: "roles",
      requestedExpanded: true,
    });
    expect(expanded.details.tiles).toHaveLength(7);
    expect(expanded.details.lines).toHaveLength(7);
    let downloads = 0;
    page.on("download", () => downloads++);
    const endpoint = `**/api/projects/${id}/design`;
    await page.route(endpoint, async (route) =>
      route.fulfill({
        json: { ...before, design: { ...before.design, revision: before.design.revision + 1 } },
      }),
    );
    await page.getByRole("button", { name: "Export diagram", exact: true }).click();
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("saved revision differs");
    expect(downloads).toBe(0);
    await page.unroute(endpoint);
    await page.route("**/*.woff2*", (route) => route.fulfill({ status: 503, body: "unavailable" }));
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("font could not be embedded");
    await expect(page.locator(".diagram-capture-host")).toHaveCount(0);
    await page.unroute("**/*.woff2*");
    // Stalled font readiness must also be disposable when closing then switching projects.
    await page.evaluate(() =>
      Object.defineProperty(document.fonts, "ready", {
        configurable: true,
        value: new Promise(() => {}),
      }),
    );
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    await expect(page.locator(".diagram-capture-host")).toHaveCount(1);
    await page.getByRole("button", { name: "Close export diagram" }).click();
    await expect(page.locator(".diagram-capture-host")).toHaveCount(0);
    switched = await createStudy(page, "E2E PNG switched", "blank");
    expect(downloads).toBe(0);
    expect(await (await page.request.get(`/api/projects/${id}/design`)).json()).toEqual(before);
  } finally {
    if (switched) await page.request.delete(`/api/projects/${switched}`);
    await page.request.delete(`/api/projects/${id}`);
  }
});

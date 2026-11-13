import type { Page } from "@playwright/test";
import { exportPng } from "./export.ts";
import {
  clickLine,
  createFoundation,
  createStudy,
  dragPaper,
  expect,
  lines,
  ready,
  test,
  tile,
} from "./studio.ts";

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

test("PNG contains full YouTube routes after mouse selection, pan, zoom and dark mode without changing state", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E PNG YouTube", "YouTube · studio study");
  try {
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    // The Simple view: one plain tile per element and one line per relationship.
    await page.getByRole("button", { name: "Simple", exact: true }).click();
    await expect(page.locator(".lane-container")).toHaveCount(0);
    await ready(page);
    const first = await exportPng(page);
    expect(first.details.tiles).toHaveLength(21);
    expect(first.details.lines).toHaveLength(25);
    await tile(page, "Transcoder").click();
    await clickLine(page, "transcoder-read");
    // Pan by dragging empty paper, then zoom with the wheel.
    const camera = () =>
      page
        .locator(".board .react-flow__viewport")
        .evaluate((el) => (el as HTMLElement).style.transform);
    const fitted = await camera();
    await dragPaper(page, { x: -200, y: 60 });
    await expect.poll(camera).not.toBe(fitted);
    await page.mouse.wheel(0, -450);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const selected = await view(page);
    const second = await exportPng(page);
    expect(second.details.image.sha256).toBe(first.details.image.sha256);
    expect(await view(page)).toEqual(selected);
    await expect(lines(page)).toHaveCount(25);
    await expect(page.locator('.board .react-flow__edge[data-id="transcoder-read"]')).toHaveClass(
      /selected/,
    );
    expect(await (await page.request.get(`/api/projects/${id}/design`)).json()).toEqual(before);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("canonical process export retains ownership; stale revisions, missing fonts and cancelled captures refuse downloads", async ({
  page,
}) => {
  const id = await createFoundation(page, "E2E PNG owner");
  let switched: string | undefined;
  try {
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    const canonical = await exportPng(page);
    expect(canonical.details.view.owners[0]).toMatchObject({
      rendered: "roles",
      requestedExpanded: false,
    });
    expect(canonical.details.tiles).toHaveLength(7);
    expect(canonical.details.lines).toHaveLength(7);
    await tile(page, "Create link").click();
    const selected = await exportPng(page);
    expect(selected.details.image.sha256).toBe(canonical.details.image.sha256);
    expect(selected.details.tiles).toEqual(canonical.details.tiles);
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

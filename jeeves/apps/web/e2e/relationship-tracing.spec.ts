import type { Page } from "@playwright/test";
import { clickLine, createStudy, design, expect, lines, showView, test, tile } from "./studio.ts";

/** The lines drawn in the selection colour: the selected line, or the selected tile's lines. */
const highlighted = (page: Page) =>
  lines(page).evaluateAll((edges) =>
    edges
      .filter(
        (edge) =>
          (edge.querySelector(".board-line-arrow") as SVGPathElement | null)?.style.stroke ===
          "var(--board-select)",
      )
      .map((edge) => (edge as HTMLElement).dataset.id)
      .sort(),
  );
/** Line IDs in paint order: later lines are drawn over earlier ones. */
const paintOrder = (page: Page) =>
  lines(page).evaluateAll((edges) => edges.map((edge) => (edge as HTMLElement).dataset.id));
/** Lines whose accessible name ("A to B") has `name` at either end. */
const touching = (page: Page, name: string) =>
  lines(page).evaluateAll(
    (edges, name) =>
      edges
        .filter((edge) => (edge.getAttribute("aria-label") ?? "").split(" to ").includes(name))
        .map((edge) => (edge as HTMLElement).dataset.id)
        .sort(),
    name,
  );
const positions = (page: Page) =>
  page
    .locator(".react-flow__node")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform));
const clickPaper = (page: Page) =>
  page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });

test("selection traces YouTube relationships, ends when cleared and leaves the design alone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E YouTube tracing", "YouTube · studio study", "Simple");
  try {
    const blueprint = async () =>
      await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    const before = await blueprint();
    const initialPositions = await positions(page);
    const inspector = page.locator(".studio-inspector");
    const transcoder = [
      "jobs-transcoder",
      "transcoder-publish",
      "transcoder-read",
      "transcoder-write",
    ];

    // A selected tile's lines turn the selection colour and are drawn over the rest; none hide.
    await tile(page, "Transcoder").click();
    await expect.poll(() => highlighted(page)).toEqual(transcoder);
    await expect(lines(page)).toHaveCount(25);
    expect((await paintOrder(page)).slice(-4).sort()).toEqual(transcoder);

    // A clicked line shows its saved label and is drawn on top.
    for (const [edge, verb] of [
      ["transcoder-read", "Reads originals"],
      ["transcoder-write", "Stores segments, playlists and thumbnails"],
      ["handler-metadata", "Records playable videos"],
    ] as const) {
      await clickLine(page, edge);
      await expect.poll(() => highlighted(page)).toEqual([edge]);
      expect((await paintOrder(page)).at(-1)).toBe(edge);
      await expect(inspector.locator(".lane-connection-label")).toHaveText(verb);
    }

    // Clicking empty paper ends the trace: no mode is left on.
    await clickPaper(page);
    await expect.poll(() => highlighted(page)).toEqual([]);
    await expect(page.locator(".board .react-flow__edge.selected")).toHaveCount(0);
    await expect(inspector.locator(".lane-inspector-kind").first()).toHaveText("System");
    await expect(lines(page)).toHaveCount(25);
    expect(await blueprint()).toEqual(before);

    // The selected line's X removes the relationship; one Undo restores it.
    await clickLine(page, "indexer-write");
    await page
      .getByRole("button", { name: "Remove Search indexer to Search index", exact: true })
      .click();
    await expect(page.locator('.react-flow__edge[data-id="indexer-write"]')).toHaveCount(0);
    await expect(lines(page)).toHaveCount(24);
    expect((await design(page, id)).connections.some((c) => c.id === "indexer-write")).toBe(false);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(lines(page)).toHaveCount(25);
    await expect
      .poll(async () => (await design(page, id)).connections.some((c) => c.id === "indexer-write"))
      .toBe(true);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await expect.poll(() => positions(page)).toEqual(initialPositions);
    const after = await blueprint();
    expect({ ...after, revision: before.revision }).toEqual(before);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("a shared stem asks which relationship the mouse intends", async ({ page }) => {
  const id = await createStudy(page, "E2E YouTube overlap", "YouTube · studio study", "Simple");
  try {
    // Watch's first 32px belong to several routes. SVG stacking must not pick one silently.
    const path = page.locator('.react-flow__edge[data-id="watch-cache"] .react-flow__edge-path');
    const point = await path.evaluate((el) => {
      const p = el as SVGPathElement;
      const at = p.getPointAtLength(16);
      const m = p.getScreenCTM();
      if (!m) throw new Error("No route");
      const screen = new DOMPoint(at.x, at.y).matrixTransform(m);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
    const chooser = page.getByRole("dialog", { name: "Choose relationship" });
    await expect(chooser).toBeVisible();
    await expect(chooser.locator('[data-line-id="watch-cache"]')).toBeVisible();
    await expect(chooser.locator('[data-line-id="watch-metadata"]')).toBeVisible();
    const viewport = page.locator(".react-flow__viewport");
    const camera = await viewport.getAttribute("style");
    const box = await chooser.boundingBox();
    if (!box) throw new Error("The chooser is not drawn.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => chooser.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await viewport.getAttribute("style")).toBe(camera);
    await chooser.locator('[data-line-id="watch-metadata"]').click();
    await expect(page.locator('.react-flow__edge[data-id="watch-metadata"]')).toHaveClass(
      /selected/,
    );
    await expect(page.locator(".studio-inspector .lane-connection-label")).toHaveText(
      "Reads video details on a miss",
    );
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("removing a selected tile traces its surviving neighbour and Undo restores the route", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  await tile(page, "Click events").click();
  await expect.poll(() => highlighted(page)).toEqual(await touching(page, "Click events"));
  await tile(page, "Click events")
    .getByRole("button", { name: "Remove Click events", exact: true })
    .click();
  await expect(tile(page, "Click events")).toHaveCount(0);
  await expect(tile(page, "Redirect service")).toHaveClass(/selected/);
  await expect(page.locator(".studio-inspector").getByLabel("Name", { exact: true })).toHaveValue(
    "Redirect service",
  );
  const redirect = await touching(page, "Redirect service");
  expect(redirect.length).toBeGreaterThan(0);
  await expect.poll(() => highlighted(page)).toEqual(redirect);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tile(page, "Click events")).toHaveCount(1);
  expect((await design(page, id)).elements.some((item) => item.id === "click-events")).toBe(true);
  await expect(lines(page)).toHaveCount(12);
  await clickPaper(page);
  await expect.poll(() => highlighted(page)).toEqual([]);
});

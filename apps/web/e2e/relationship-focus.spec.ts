import { createStudy, design, expect, lines, test, tile } from "./studio.ts";

test("focus traces named YouTube relationships without changing the design", async ({ page }) => {
  const id = await createStudy(page, "E2E YouTube focus", "YouTube · studio study");
  try {
    const before = await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    const positions = () =>
      page
        .locator(".react-flow__node")
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform));
    const initialPositions = await positions();
    const inspector = page.locator(".studio-inspector");
    const status = page.getByRole("region", { name: "Relationship focus" });
    await tile(page, "Transcoder").click();
    await inspector.getByRole("button", { name: "Focus relationships", exact: true }).click();
    const focused = inspector.getByRole("region", { name: "Relationships for Transcoder" });
    await expect(focused).toContainText("Incoming · 1");
    await expect(focused).toContainText("Outgoing · 3");
    await expect(status).toContainText("4 shown · 21 relationships hidden");
    for (const [target, verb, edge] of [
      ["Original videos", "Reads originals", "transcoder-read"],
      ["Transcoded videos", "Stores segments, playlists and thumbnails", "transcoder-write"],
    ]) {
      await focused.getByRole("button", { name: new RegExp(`Transcoder → ${target}`) }).click();
      await expect(lines(page)).toHaveCount(1);
      await expect(page.locator(`.react-flow__edge[data-id="${edge}"]`)).toHaveClass(/selected/);
      await expect(inspector.locator(".lane-connection-label")).toHaveText(verb as string);
      await expect(focused).toBeVisible();
      await expect(status).toContainText("1 shown · 24 relationships hidden");
      await status.getByRole("button", { name: "Fit focus", exact: true }).click();
    }
    await focused.getByRole("button", { name: "All for Transcoder", exact: true }).click();
    await expect(lines(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await tile(page, "Watch API").click();
    const watch = inspector.getByRole("region", { name: "Relationships for Watch API" });
    await watch.getByRole("button", { name: /Watch API → Metadata database/ }).click();
    await expect(inspector.locator(".lane-connection-label")).toHaveText(
      "Reads video details on a miss",
    );
    await expect(lines(page)).toHaveCount(1);
    await expect(page.locator('.react-flow__edge[data-id="watch-metadata"]')).toHaveClass(
      /selected/,
    );
    for (const [name, target, edge] of [
      ["Completion handler", "Metadata database", "handler-metadata"],
      ["Search indexer", "Search index", "indexer-write"],
    ]) {
      await tile(page, name as string).click();
      const focus = inspector.getByRole("region", { name: `Relationships for ${name}` });
      await expect(focus).toContainText("Incoming · 1");
      await expect(focus).toContainText("Outgoing · 1");
      await focus.getByRole("button", { name: new RegExp(`${name} → ${target}`) }).click();
      await expect(lines(page)).toHaveCount(1);
      await expect(page.locator(`.react-flow__edge[data-id="${edge}"]`)).toHaveClass(/selected/);
    }
    expect(await (await page.request.get(`/api/projects/${id}/blueprint`)).json()).toEqual(before);
    await inspector.getByRole("button", { name: "Remove relationship", exact: true }).click();
    await expect(page.locator('.react-flow__edge[data-id="indexer-write"]')).toHaveCount(0);
    await expect(lines(page)).toHaveCount(1);
    expect((await design(page, id)).connections.some((c) => c.id === "indexer-write")).toBe(false);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(
      inspector.getByRole("region", { name: "Relationships for Search indexer" }),
    ).toContainText("Outgoing · 1");
    await status.getByRole("button", { name: "Show all", exact: true }).click();
    await expect(status).toHaveCount(0);
    await expect(lines(page)).toHaveCount(25);
    await expect.poll(positions).toEqual(initialPositions);
    const after = await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    expect({ ...after, revision: before.revision }).toEqual(before);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("a shared stem asks which relationship the mouse intends", async ({ page }) => {
  const id = await createStudy(page, "E2E YouTube overlap", "YouTube · studio study");
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

test("removing the focus anchor follows the surviving tile and Undo restores the route", async ({
  page,
  tinyurl: id,
}) => {
  await tile(page, "Click events").click();
  await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
  await tile(page, "Click events")
    .getByRole("button", { name: "Remove Click events", exact: true })
    .click();
  await expect(tile(page, "Click events")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Relationships for Redirect service" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Relationship focus" })).toContainText(
    "relationships hidden",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tile(page, "Click events")).toHaveCount(1);
  expect((await design(page, id)).elements.some((item) => item.id === "click-events")).toBe(true);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await expect(lines(page)).toHaveCount(12);
});

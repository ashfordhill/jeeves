import { design, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("the user's line to an action has no X, and Delete leaves it", async ({
  page,
  tinyurl: id,
}) => {
  await ready(page);
  // Click the middle of the User → Open link line, between the two tiles.
  const line = page.locator('.board .react-flow__edge[data-id="@actor-download"]');
  const point = await line.locator("path.react-flow__edge-path").evaluate((path) => {
    const svg = path as SVGPathElement;
    const at = svg.getPointAtLength(svg.getTotalLength() / 2);
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error("The line is not drawn.");
    return { x: at.x * matrix.a + matrix.e, y: at.y * matrix.d + matrix.f };
  });
  await page.mouse.click(point.x, point.y);
  await expect(line).toHaveClass(/selected/);
  await expect(page.getByText("The line goes with the action.")).toBeVisible();
  await expect(page.locator(".board-remove-line")).toHaveCount(0);

  await page.keyboard.press("Delete");
  // A refusal would show as a notice within a moment; give it the time to appear.
  await page.waitForTimeout(500);
  await expect(lines(page)).toHaveCount(12);
  await expect(page.locator(".studio-notice")).toHaveCount(0);
  expect((await design(page, id)).revision).toBe(1);
});

test("removes a tile with its X, restitches its links and undoes", async ({
  page,
  tinyurl: id,
}) => {
  await tile(page, "Click events").click();
  await tile(page, "Click events")
    .getByRole("button", { name: "Remove Click events", exact: true })
    .click();

  await ready(page);
  await expect(tiles(page)).toHaveCount(10);
  await expect(lines(page)).toHaveCount(11);
  // The first predecessor (here the Redirect service) is selected.
  await expect(tile(page, "Redirect service")).toHaveClass(/selected/);
  const removed = await design(page, id);
  expect(removed.revision).toBe(2);
  expect(removed.elements.map((e) => e.id)).not.toContain("click-events");
  // Publisher and consumer are joined by an asynchronous call.
  expect(removed.connections.find((c) => c.id === "redirect-analytics")).toMatchObject({
    from: { element: "redirect" },
    to: { element: "analytics" },
    planned: { interaction: "Asynchronous" },
  });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tiles(page)).toHaveCount(11);
  await expect(lines(page)).toHaveCount(12);
  const restored = await design(page, id);
  expect(restored.revision).toBe(3);
  expect(restored.elements.map((e) => e.id)).toContain("click-events");
  expect(restored.connections.map((c) => c.id)).not.toContain("redirect-analytics");
});

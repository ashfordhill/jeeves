import { design, expect, lines, ready, test, tile, tiles } from "./studio.ts";

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

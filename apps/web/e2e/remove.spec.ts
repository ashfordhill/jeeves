import { design, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("removes a tile with its X, restitches its lane entry and undoes", async ({
  page,
  tinyurl: id,
}) => {
  await tile(page, "CDN").click();
  await tile(page, "CDN").getByRole("button", { name: "Remove CDN", exact: true }).click();

  await ready(page);
  await expect(tiles(page)).toHaveCount(9);
  await expect(lines(page)).toHaveCount(10);
  // The first predecessor (here the user) is selected.
  await expect(tile(page, "User")).toHaveClass(/selected/);
  const removed = await design(page, id);
  expect(removed.revision).toBe(2);
  expect(removed.elements.map((e) => e.id)).not.toContain("cdn");
  expect(removed.architecture.studio.entries).toContainEqual({
    id: "download-redirect",
    lane: "download",
    element: "redirect",
  });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tiles(page)).toHaveCount(10);
  await expect(lines(page)).toHaveCount(11);
  const restored = await design(page, id);
  expect(restored.revision).toBe(3);
  expect(restored.architecture.studio.entries.find((e) => e.lane === "download")?.element).toBe(
    "cdn",
  );
});

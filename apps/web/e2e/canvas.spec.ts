import { dashedLines, expect, lines, test, tile, tiles } from "./studio.ts";

test("shows the TinyURL study on the lane canvas", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  // The user and nine tiles; two lane entries and nine connections, three dashed (the click path).
  await expect(tiles(page)).toHaveCount(10);
  await expect(lines(page)).toHaveCount(11);
  await expect(dashedLines(page)).toHaveCount(3);
  await expect(tile(page, "User")).toBeVisible();
  await expect(page.locator(".board-chip")).toHaveCount(2);
});

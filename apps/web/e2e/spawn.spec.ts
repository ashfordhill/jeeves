import { design, expect, lines, moveOnto, pull, ready, test, tile, tiles } from "./studio.ts";

test("pulls a + tab onto the fan to add a tile", async ({ page, tinyurl: id }) => {
  await tile(page, "Redirect service").click();
  await pull(page, "Redirect service", "Request after");
  const cache = page.locator(".board-pull").getByRole("button", { name: "Cache", exact: true });
  await moveOnto(page, cache);
  await page.mouse.up();

  await ready(page);
  await expect(tiles(page)).toHaveCount(11);
  await expect(lines(page)).toHaveCount(12);
  await expect(tile(page, "Cache")).toHaveClass(/selected/);
  await expect(page.locator(".studio-inspector").getByLabel("Name", { exact: true })).toBeFocused();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.connections.find((c) => c.to.element === "cache")?.from.element).toBe("redirect");
});

test("pulls a --- tab onto a tile to link it asynchronously", async ({ page, tinyurl: id }) => {
  await tile(page, "Shorten API").click();
  // The inspector opened beside the canvas, and the fitted camera refitted, so no Fit is needed.
  const dashed = page.locator(".board .react-flow__edge-path.is-dashed");
  await expect(dashed).toHaveCount(3);
  await pull(page, "Shorten API", "Async after");
  await moveOnto(page, tile(page, "Click events"));
  await expect(tile(page, "Click events")).toHaveClass(/is-drop-over/);
  await page.mouse.up();

  await ready(page);
  await expect(dashed).toHaveCount(4);
  // A merge leaves the source selected, ready for its next fork or merge.
  await expect(tile(page, "Shorten API")).toHaveClass(/selected/);
  await expect(tile(page, "Click events")).not.toHaveClass(/selected/);
  const publish = (await design(page, id)).connections.find(
    (c) => c.from.element === "shorten-api" && c.to.element === "click-events",
  );
  expect(publish?.planned).toMatchObject({ label: "Publishes", interaction: "Asynchronous" });
});

test("drops the user's other lane tab on an entry tile to start both lanes there", async ({
  page,
  tinyurl: id,
}) => {
  const chip = (name: string) => page.locator(".board").getByRole("button", { name, exact: true });
  await tile(page, "User").click();
  await pull(page, "User", "Upload lane");
  await moveOnto(page, tile(page, "CDN"));
  await expect(tile(page, "CDN")).toHaveClass(/is-drop-over/);
  await page.mouse.up();

  await ready(page);
  // Still one entry line to the CDN, its chip now showing both lane icons.
  await expect(lines(page)).toHaveCount(11);
  await expect(chip("Download and upload lanes: User to CDN").locator("svg")).toHaveCount(2);
  await expect(chip("Download lane: User to CDN")).toHaveCount(0);
  await expect(tile(page, "User")).toHaveClass(/selected/);
  const shared = await design(page, id);
  expect(shared.revision).toBe(2);
  expect(shared.architecture.studio.entries).toEqual([
    { id: "download-cdn", lane: "both", element: "cdn" },
    { id: "upload-shorten-api", lane: "upload", element: "shorten-api" },
  ]);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(chip("Download lane: User to CDN")).toBeVisible();
  await expect(chip("Upload lane: User to Shorten API")).toBeVisible();
  const restored = await design(page, id);
  expect(restored.revision).toBe(3);
  expect(restored.architecture.studio.entries.map((e) => `${e.lane} ${e.element}`)).toEqual([
    "download cdn",
    "upload shorten-api",
  ]);
});

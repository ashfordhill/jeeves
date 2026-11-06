import type { Page } from "@playwright/test";
import {
  dashedLines,
  design,
  expect,
  lines,
  moveOnto,
  pull,
  ready,
  test,
  tile,
  tiles,
} from "./studio.ts";

/** The open fan's items (every tile type, in order). */
const fan = (page: Page) => page.locator(".board-pull [data-fan-item]");
const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });

test("pulls a + tab onto the fan to add a tile", async ({ page, tinyurl: id }) => {
  await tile(page, "Redirect service").click();
  await expect(tile(page, "Redirect service").locator(".board-tab")).toHaveCount(3);
  await pull(page, "Redirect service", "Add after");
  // All seven types; after a service, every one fits.
  await expect(fan(page)).toHaveCount(7);
  await expect(page.locator('.board-pull [aria-disabled="true"]')).toHaveCount(0);
  await moveOnto(page, fanItem(page, "Cache"));
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

test("greys the types a side can't add, with the reason", async ({ page, tinyurl: id }) => {
  await tile(page, "Links database").click();
  // A store has no right `+`: its left `+` and the attach tab show.
  await expect(tile(page, "Links database").locator(".board-tab")).toHaveCount(2);
  await pull(page, "Links database", "Add before", { x: -60, y: 12 });
  await expect(fan(page)).toHaveCount(7);
  // Before a database only an application fits (an external API can only call one).
  for (const name of ["Service", "API"])
    await expect(fanItem(page, name)).not.toHaveAttribute("aria-disabled");
  for (const name of ["Database", "Cache", "Queue", "Storage", "External"])
    await expect(fanItem(page, name)).toHaveAttribute("aria-disabled", "true");
  await moveOnto(page, fanItem(page, "Queue"));
  // Its tip gives the name and the reason; releasing there changes nothing.
  const tip = page.locator(".board-fan-tip");
  await expect(tip).toContainText("Queue");
  await expect(tip.locator(".board-fan-reason")).toHaveText(
    "A queue can't link to Links database. A queue feeds only an application, not a database.",
  );
  await page.mouse.up();

  await expect(fan(page)).toHaveCount(0);
  await expect(tiles(page)).toHaveCount(10);
  expect((await design(page, id)).revision).toBe(1);
});

test("a + released on a tile changes nothing", async ({ page, tinyurl: id }) => {
  await tile(page, "Redirect service").click();
  // The left `+` fans left; Analytics worker, which Redirect could attach to, is on the right.
  await pull(page, "Redirect service", "Add before");
  await expect(fan(page)).toHaveCount(7);
  await expect(page.locator(".board-scrim")).toHaveCount(0);
  await moveOnto(page, tile(page, "Analytics worker"));
  await expect(tile(page, "Analytics worker")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();

  await expect(fan(page)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(11);
  await expect(page.locator(".studio-notice")).toHaveCount(0);
  expect((await design(page, id)).revision).toBe(1);
});

test("attaches a store to a service, backwards, then undoes it", async ({ page, tinyurl: id }) => {
  await tile(page, "Analytics store").click();
  await pull(page, "Analytics store", "Attach");
  await expect(fan(page)).toHaveCount(0);
  // A store can't link onward, so Redirect service is offered as Redirect → Analytics store.
  await expect(tile(page, "Redirect service")).toHaveClass(/is-drop-target/);
  await moveOnto(page, tile(page, "Redirect service"));
  await expect(tile(page, "Redirect service")).toHaveClass(/is-drop-over/);
  await page.mouse.up();

  await ready(page);
  await expect(lines(page)).toHaveCount(12);
  await expect(tile(page, "Analytics store")).toHaveClass(/selected/);
  const read = (await design(page, id)).connections.find(
    (c) => c.from.element === "redirect" && c.to.element === "analytics-store",
  );
  expect(read).toMatchObject({ kind: "uses-database" });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(lines(page)).toHaveCount(11);
  const undone = (await design(page, id)).connections;
  expect(
    undone.some((c) => c.from.element === "redirect" && c.to.element === "analytics-store"),
  ).toBe(false);
});

test("attaches to a queue asynchronously, the pair's default", async ({ page, tinyurl: id }) => {
  await tile(page, "Shorten API").click();
  // The inspector opened beside the canvas, and the fitted camera refitted, so no Fit is needed.
  await expect(dashedLines(page)).toHaveCount(3);
  await pull(page, "Shorten API", "Attach");
  await moveOnto(page, tile(page, "Click events"));
  await expect(tile(page, "Click events")).toHaveClass(/is-drop-over/);
  await page.mouse.up();

  await ready(page);
  await expect(dashedLines(page)).toHaveCount(4);
  // An attach leaves the source selected, ready for its next fork or merge.
  await expect(tile(page, "Shorten API")).toHaveClass(/selected/);
  await expect(tile(page, "Click events")).not.toHaveClass(/selected/);
  const publish = (await design(page, id)).connections.find(
    (c) => c.from.element === "shorten-api" && c.to.element === "click-events",
  );
  expect(publish?.planned).toMatchObject({ label: "Publishes", interaction: "Asynchronous" });
});

test("refuses the user's upload attach on a tile that already starts a lane", async ({
  page,
  tinyurl: id,
}) => {
  const chip = (name: string) => page.locator(".board").getByRole("button", { name, exact: true });
  await tile(page, "User").click();
  // Per lane, a `+` for a new entry tile and an attach tab for an existing one.
  for (const name of [
    "Add to download lane",
    "Attach to download lane",
    "Add to upload lane",
    "Attach to upload lane",
  ])
    await expect(tile(page, "User").getByRole("button", { name, exact: true })).toBeVisible();
  await pull(page, "User", "Attach to upload lane");
  // A tile has one entry: the CDN starts the download lane, so it stays dimmed.
  await expect(tile(page, "Redirect service")).toHaveClass(/is-drop-target/);
  await moveOnto(page, tile(page, "CDN"));
  await expect(tile(page, "CDN")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();

  await expect(page.locator(".studio-notice")).toHaveText(
    "CDN already starts the download lane; a tile has one entry.",
  );
  await expect(lines(page)).toHaveCount(11);
  await expect(chip("Download lane: User to CDN")).toBeVisible();
  await expect(chip("Upload lane: User to Shorten API")).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(1);
  expect(saved.architecture.studio.entries.map((e) => `${e.lane} ${e.element}`)).toEqual([
    "download cdn",
    "upload shorten-api",
  ]);
});

import type { Page } from "@playwright/test";
import {
  createStudy,
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
  await expect(tiles(page)).toHaveCount(12);
  await expect(lines(page)).toHaveCount(13);
  await expect(tile(page, "Cache")).toHaveClass(/selected/);
  await expect(page.locator(".studio-inspector").getByLabel("Name", { exact: true })).toBeFocused();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.connections.find((c) => c.to.element === "cache")?.from.element).toBe("redirect");
});

test("greys the types a side can't add, with the reason", async ({ page, tinyurl: id }) => {
  await tile(page, "URL database").click();
  // A store has no right `+`: its left `+` and the attach tab show.
  await expect(tile(page, "URL database").locator(".board-tab")).toHaveCount(2);
  await pull(page, "URL database", "Add before", { x: -60, y: 12 });
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
    "A queue can't link to URL database. A queue feeds only an application, not a database.",
  );
  await page.mouse.up();

  await expect(fan(page)).toHaveCount(0);
  await expect(tiles(page)).toHaveCount(11);
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
  await expect(lines(page)).toHaveCount(12);
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
  await expect(lines(page)).toHaveCount(13);
  await expect(tile(page, "Analytics store")).toHaveClass(/selected/);
  const read = (await design(page, id)).connections.find(
    (c) => c.from.element === "redirect" && c.to.element === "analytics-store",
  );
  expect(read).toMatchObject({ kind: "uses-database" });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(lines(page)).toHaveCount(12);
  const undone = (await design(page, id)).connections;
  expect(
    undone.some((c) => c.from.element === "redirect" && c.to.element === "analytics-store"),
  ).toBe(false);
});

test("attaches to a queue asynchronously, the pair's default", async ({ page, tinyurl: id }) => {
  await tile(page, "Shorten service").click();
  // The inspector opened beside the canvas, and the fitted camera refitted, so no Fit is needed.
  await expect(dashedLines(page)).toHaveCount(3);
  await pull(page, "Shorten service", "Attach");
  await moveOnto(page, tile(page, "Click events"));
  await expect(tile(page, "Click events")).toHaveClass(/is-drop-over/);
  await page.mouse.up();

  await ready(page);
  await expect(dashedLines(page)).toHaveCount(4);
  // An attach leaves the source selected, ready for its next fork or merge.
  await expect(tile(page, "Shorten service")).toHaveClass(/selected/);
  await expect(tile(page, "Click events")).not.toHaveClass(/selected/);
  const publish = (await design(page, id)).connections.find(
    (c) => c.from.element === "shorten" && c.to.element === "click-events",
  );
  expect(publish?.planned).toMatchObject({ label: "Publishes", interaction: "Asynchronous" });
});

test("the user's + offers its actions; an action attaches a tile as its entry", async ({
  page,
  tinyurl: id,
}) => {
  const tabs = (name: string) => tile(page, name).locator(".board-tab");
  await tile(page, "User").click();
  // TinyURL has both actions, so the user's one `+` is gone; nothing attaches onto the user.
  await expect(tabs("User")).toHaveCount(0);

  // An action has a right `+` and an attach tab, and no left `+`. Every tile that could be an
  // entry already is one, so Open link shows only its `+`.
  await tile(page, "Open link").click();
  await expect(tile(page, "Open link").getByRole("button", { name: "Add after" })).toBeVisible();
  await expect(tabs("Open link")).toHaveCount(1);
  await pull(page, "Open link", "Add after");
  // An action reaches a service or an API: the stores, the queue and External are greyed.
  for (const name of ["Service", "API"])
    await expect(fanItem(page, name)).not.toHaveAttribute("aria-disabled");
  for (const name of ["Database", "Cache", "Queue", "Storage", "External"])
    await expect(fanItem(page, name)).toHaveAttribute("aria-disabled", "true");
  await moveOnto(page, fanItem(page, "Storage"));
  await expect(page.locator(".board-fan-tip .board-fan-reason")).toHaveText(
    "Open link can't link to object storage. An action reaches a service (not a worker), an API or the CDN.",
  );
  await page.mouse.up();

  // A Service after the Shorten service has no entry: Shorten's attach tab can make it one.
  await tile(page, "Shorten service").click();
  await pull(page, "Shorten service", "Add after");
  await moveOnto(page, fanItem(page, "Service"));
  await page.mouse.up();
  await ready(page);
  await expect(lines(page)).toHaveCount(13);
  await tile(page, "Shorten").click();
  await expect(tabs("Shorten")).toHaveCount(2);
  await pull(page, "Shorten", "Attach");
  // A tile has one entry: Redirect service starts the download lane, so it stays dimmed.
  await expect(tile(page, "Service")).toHaveClass(/is-drop-target/);
  await moveOnto(page, tile(page, "Redirect service"));
  await expect(tile(page, "Redirect service")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(page.locator(".studio-notice")).toHaveText(
    "Redirect service already starts the download lane; a tile has one entry.",
  );
  await expect(lines(page)).toHaveCount(13);
  await page.getByRole("button", { name: "Dismiss notice" }).click();

  await pull(page, "Shorten", "Attach");
  await moveOnto(page, tile(page, "Service"));
  await page.mouse.up();
  await ready(page);
  await expect(lines(page)).toHaveCount(14);
  await expect(tile(page, "Shorten")).toHaveClass(/selected/);
  const saved = await design(page, id);
  expect(saved.revision).toBe(3);
  expect(saved.architecture.studio.entries.map((e) => `${e.lane} ${e.element}`)).toEqual([
    "download stats-api",
    "download redirect",
    "upload shorten",
    "upload service",
  ]);
});

test("builds both actions from a blank design", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Blank actions", "blank");
  try {
    // A blank design opens with the user selected and its one `+`.
    await expect(tile(page, "User").locator(".board-tab")).toHaveCount(1);
    await pull(page, "User", "Add action");
    await expect(fan(page)).toHaveCount(2);
    await moveOnto(page, fanItem(page, "Consume"));
    await page.mouse.up();
    await ready(page);
    // The new action is selected with its Name ready to type over.
    const name = page.locator(".studio-inspector").getByLabel("Name", { exact: true });
    await expect(name).toBeFocused();
    await name.fill("Watch");
    await name.blur();
    await expect(tile(page, "Watch")).toBeVisible();

    await pull(page, "Watch", "Add after");
    await moveOnto(page, fanItem(page, "API"));
    await page.mouse.up();
    await ready(page);
    await expect(tile(page, "API")).toHaveClass(/selected/);

    // The user's `+` greys the action the design already has.
    await tile(page, "User").click();
    await pull(page, "User", "Add action");
    await expect(fanItem(page, "Consume")).toHaveAttribute("aria-disabled", "true");
    await moveOnto(page, fanItem(page, "Consume"));
    await expect(page.locator(".board-fan-tip .board-fan-reason")).toHaveText(
      "This design already has a Consume action; each lane has one.",
    );
    await moveOnto(page, fanItem(page, "Produce"));
    await page.mouse.up();
    await ready(page);
    await expect(tiles(page)).toHaveCount(4);
    await expect(lines(page)).toHaveCount(3);
    const saved = await design(page, id);
    expect(saved.architecture.studio.actions).toEqual([
      { lane: "download", name: "Watch" },
      { lane: "upload", name: "Produce" },
    ]);
    expect(saved.architecture.studio.entries).toEqual([
      { id: "download-api", lane: "download", element: "api" },
    ]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

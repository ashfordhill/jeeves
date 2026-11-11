/**
 * The module `+` and its menu (V3-03, owner feedback 4 and 9, D3): in Detailed every container that
 * can hold modules, an empty one included, has a `+` at the bottom inside its frame; in Simple the
 * selected tile has one, clear of its kind label; the inspector's Modules section has one whose
 * menu opens left of the rail. One menu and one command: a click toggles it, a click away or
 * Escape closes it, and a pick adds the module and opens it with its name focused. The link fan
 * opens by a click too, and in a narrow canvas it sits beside its tile, never over it.
 */
import type { Locator, Page } from "@playwright/test";
import {
  createStudy,
  design,
  dragPaper,
  expect,
  fan,
  fanItem,
  moduleMenu,
  openFan,
  paperPoint,
  pickFrom,
  ready,
  settledBox,
  showView,
  test,
  tile,
} from "./studio.ts";

const PLUS = "Add module";
const inspector = (page: Page) => page.locator(".studio-inspector");
const nameField = (page: Page) => inspector(page).getByLabel("Name", { exact: true });
type Saved = Awaited<ReturnType<typeof design>> & {
  architecture: { studio: { components?: { host: string; name: string }[] } };
};
const modules = async (page: Page, id: string) =>
  ((await design(page, id)) as Saved).architecture.studio.components ?? [];

/** Its box once the layout, the camera and any animation have stopped moving it. */
const box = (target: Locator) => settledBox(target);
type Box = Awaited<ReturnType<typeof box>>;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;

/** A blank project with the user's Consume action and a Microservice after it, by mouse. */
async function blankService(page: Page, name: string, view: "Detailed" | "Simple" = "Detailed") {
  const id = await createStudy(page, name, "blank", view);
  await pickFrom(page, "User", "Add action", "Consume");
  await expect(tile(page, "Consume")).toHaveClass(/selected/);
  await ready(page);
  await pickFrom(page, "Consume", "Add linked tile", "Microservice");
  await expect(tile(page, "Microservice")).toHaveClass(/selected/);
  await ready(page);
  return id;
}

test("an empty Service is a container with a + at its bottom; it toggles the menu and adds a module", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await blankService(page, "E2E Module plus");
  try {
    // In Detailed the new, empty Service is a container: its header, no rows and its `+`, at the
    // bottom centre inside the frame. The user and the action have none.
    const service = tile(page, "Microservice");
    await expect(service.locator(".lane-container")).toHaveCount(1);
    await expect(service.locator(".lane-container-row")).toHaveCount(0);
    const plus = service.getByRole("button", { name: PLUS, exact: true });
    await expect(plus).toHaveCount(1);
    await expect(page.locator(".board").getByRole("button", { name: PLUS })).toHaveCount(1);
    const frame = await box(service.locator(".board-tile"));
    const header = await box(service.locator(".lane-container-header"));
    let at = await box(plus);
    expect(inside(at, frame)).toBe(true);
    expect(Math.abs(at.x + at.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(1);
    expect(at.y).toBeGreaterThan(header.y + header.height);

    // A click opens the menu, a second click on the `+` closes it.
    await plus.click();
    await expect(moduleMenu(page)).toBeVisible();
    await expect(plus).toHaveAttribute("aria-expanded", "true");
    await expect(moduleMenu(page)).toHaveAccessibleName("Add module to Microservice");
    expect(
      await moduleMenu(page)
        .locator("legend")
        .evaluateAll((items) => items.map((item) => item.textContent)),
    ).toEqual(["Template", "Part of a template", "Stub"]);
    // It sits beside the tile, not over it, on the board.
    expect(overlaps(await box(moduleMenu(page)), frame)).toBe(false);
    expect(inside(await box(moduleMenu(page)), await box(page.locator(".lane-canvas")))).toBe(true);
    await plus.click();
    await expect(moduleMenu(page)).toHaveCount(0);
    await expect(plus).toHaveAttribute("aria-expanded", "false");
    // A click away (on the paper) closes it, and so does Escape; neither adds anything.
    await plus.click();
    await expect(moduleMenu(page)).toBeVisible();
    const paper = await paperPoint(page);
    await page.mouse.click(paper.x, paper.y);
    await expect(moduleMenu(page)).toHaveCount(0);
    await plus.click();
    await expect(moduleMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(moduleMenu(page)).toHaveCount(0);
    expect(await modules(page, id)).toEqual([]);
    const before = (await design(page, id)).revision;

    // A pick adds the module in one step and opens it with its Name focused; the container grows
    // a row and its `+` stays at the bottom.
    await plus.click();
    await moduleMenu(page).getByRole("menuitem", { name: "Data access", exact: true }).click();
    await expect(moduleMenu(page)).toHaveCount(0);
    await expect(nameField(page)).toHaveValue("Data access");
    await expect(nameField(page)).toBeFocused();
    await expect(
      inspector(page).getByRole("button", { name: "Back to Microservice", exact: true }),
    ).toBeVisible();
    await ready(page);
    await expect(service.locator(".lane-container-row")).toHaveCount(1);
    await expect(service.locator(".lane-container-row")).toHaveAttribute("data-mark", "open");
    expect(await modules(page, id)).toMatchObject([{ host: "microservice", name: "Data access" }]);
    expect((await design(page, id)).revision).toBe(before + 1);
    at = await box(plus);
    expect(at.y).toBeGreaterThan((await box(service.locator(".lane-container-row"))).y);

    // In Connect mode the `+` is gone.
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(service.getByRole("button", { name: PLUS })).toHaveCount(0);
    await page.getByRole("button", { name: "Pointer", exact: true }).click();
    await expect(service.getByRole("button", { name: PLUS })).toHaveCount(1);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("the selected tile's + in Simple adds a module, clear of its kind label", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await blankService(page, "E2E Module plus Simple", "Simple");
  try {
    const service = tile(page, "Microservice");
    await expect(service).toHaveClass(/selected/);
    const plus = service.getByRole("button", { name: PLUS, exact: true });
    await expect(plus).toHaveCount(1);
    // Inside the tile, over none of its icon, name and kind label.
    const at = await box(plus);
    expect(inside(at, await box(service.locator(".board-tile")))).toBe(true);
    for (const part of [".lane-tile-icon", ".lane-tile-name", ".lane-tile-kind"])
      expect(overlaps(at, await box(service.locator(part))), part).toBe(false);
    // Only the selected tile shows one.
    await tile(page, "Consume").click();
    await expect(page.locator(".board").getByRole("button", { name: PLUS })).toHaveCount(0);
    await service.click();
    await expect(plus).toHaveCount(1);

    await plus.click();
    await expect(moduleMenu(page)).toBeVisible();
    expect(overlaps(await box(moduleMenu(page)), await box(service))).toBe(false);
    await moduleMenu(page).getByRole("menuitem", { name: "Rate limiter", exact: true }).click();
    await expect(nameField(page)).toHaveValue("Rate limiter");
    await expect(nameField(page)).toBeFocused();
    expect(await modules(page, id)).toMatchObject([{ host: "microservice", name: "Rate limiter" }]);
    // The host stays selected with its `+`.
    await expect(service).toHaveClass(/selected/);
    await expect(plus).toHaveCount(1);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("the inspector's + opens the same menu left of the rail and adds a module", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await blankService(page, "E2E Module plus inspector");
  try {
    // The tile page has its Modules section with the `+`, even before it has a module.
    const section = inspector(page).locator("section", {
      has: page.getByRole("heading", { name: "Modules", exact: true }),
    });
    await expect(section).toHaveCount(1);
    const plus = section.getByRole("button", { name: PLUS, exact: true });
    await plus.click();
    await expect(moduleMenu(page)).toBeVisible();
    await expect(plus).toHaveAttribute("aria-expanded", "true");
    // Out to the left of the rail, level with the `+`, on screen.
    const rail = await box(page.getByRole("complementary", { name: "Inspector rail" }));
    const menu = await box(moduleMenu(page));
    expect(menu.x + menu.width).toBeLessThanOrEqual(rail.x);
    expect(menu.x + menu.width).toBeGreaterThan(rail.x - 24);
    await expect(moduleMenu(page)).toBeInViewport({ ratio: 1 });
    // The same kinds as the board's `+`.
    const kinds = await moduleMenu(page)
      .getByRole("menuitem")
      .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
    await page.keyboard.press("Escape");
    await tile(page, "Microservice").getByRole("button", { name: PLUS }).click();
    expect(
      await moduleMenu(page)
        .getByRole("menuitem")
        .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label"))),
    ).toEqual(kinds);
    // A click away closes it.
    await inspector(page).getByLabel("Description", { exact: true }).click();
    await expect(moduleMenu(page)).toHaveCount(0);

    await plus.click();
    await moduleMenu(page).getByRole("menuitem", { name: "Cache reader", exact: true }).click();
    await expect(nameField(page)).toHaveValue("Cache reader");
    await expect(nameField(page)).toBeFocused();
    expect(await modules(page, id)).toMatchObject([{ host: "microservice", name: "Cache reader" }]);
    // Back on the tile page: its card, then the `+`.
    await inspector(page).getByRole("button", { name: "Back to Microservice" }).click();
    await expect(
      section
        .getByRole("list", { name: "Modules" })
        .getByRole("button", { name: "Open Cache reader" }),
    ).toBeVisible();
    await expect(section.getByRole("button", { name: PLUS })).toBeVisible();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("the link fan opens by a click, toggles and closes like the menu, and adds a tile", async ({
  page,
  tinyurl: id,
}) => {
  await showView(page, "Simple");
  const before = (await design(page, id)).revision;
  await tile(page, "Shorten service").click();
  const tab = tile(page, "Shorten service").getByRole("button", { name: "Add linked tile" });
  // Click, click again: open, closed.
  await tab.click();
  await expect(fan(page)).toHaveCount(11);
  await expect(tab).toHaveAttribute("aria-expanded", "true");
  await tab.click();
  await expect(fan(page)).toHaveCount(0);
  // A click away closes it, Escape too; nothing changed.
  await tab.click();
  const paper = await paperPoint(page);
  await page.mouse.click(paper.x, paper.y);
  await expect(fan(page)).toHaveCount(0);
  await tile(page, "Shorten service").click();
  await openFan(page, "Shorten service", "Add linked tile");
  await page.keyboard.press("Escape");
  await expect(fan(page)).toHaveCount(0);
  expect((await design(page, id)).revision).toBe(before);
  // A click on a kind adds it, selected with its Name focused.
  await openFan(page, "Shorten service", "Add linked tile");
  await fanItem(page, "Search index").click();
  await ready(page);
  await expect(tile(page, "Search index")).toHaveClass(/selected/);
  await expect(nameField(page)).toBeFocused();
  const saved = await design(page, id);
  expect(saved.revision).toBe(before + 1);
  expect(saved.connections.find((item) => item.to.element === "search-index")?.from.element).toBe(
    "shorten",
  );
});

test("in a narrow canvas the link fan sits beside its tile, never over it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(
    page,
    "E2E Narrow fan",
    "TinyURL · extended study (design only)",
    "Simple",
  );
  try {
    // Both rails open: the canvas is narrower than the fan's panel beside a tile near its right.
    const service = tile(page, "Redirect service");
    await service.click();
    await expect(page.getByRole("complementary", { name: "Inspector rail" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Chat rail" })).toBeVisible();
    const canvas = await box(page.locator(".lane-canvas"));
    expect(canvas.width).toBeLessThan(700);
    // Pan it near the canvas's right edge, as a tile there sits.
    const start = await box(service);
    await dragPaper(page, {
      x: canvas.x + canvas.width - 60 - (start.x + start.width),
      y: canvas.y + canvas.height / 2 - (start.y + start.height / 2),
    });
    const frame = await box(service);
    expect(canvas.x + canvas.width - (frame.x + frame.width)).toBeLessThan(100);
    await service.click();
    await expect(service).toHaveClass(/selected/);
    await openFan(page, "Redirect service", "Add linked tile");
    const panel = await box(page.locator(".board-pull .board-fan-panel"));
    // The panel is wider than the room on the tile's right: it goes beside the tile instead.
    expect(panel.width).toBeGreaterThan(canvas.x + canvas.width - (frame.x + frame.width));
    expect(overlaps(panel, frame)).toBe(false);
    expect(inside(panel, canvas)).toBe(true);
    for (const item of await fan(page).all()) {
      await expect(item).toBeInViewport({ ratio: 1 });
      expect(overlaps(await box(item), frame)).toBe(false);
    }
    // Still a working fan.
    await fanItem(page, "Cache").click();
    await ready(page);
    await expect(tile(page, "Cache")).toHaveClass(/selected/);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

/**
 * Usable connection dots (TP02). In Connect mode a module row's dot keeps a hit area at least 16px
 * wide on screen at any zoom, as tall as the rows' 32px pitch allows, while the dot itself stays
 * small; neighbouring rows' areas meet halfway. Hovering a container grows its dots a little. A
 * connect drag held near or past the canvas edge pans the canvas towards it, as far as the tiles
 * go, with the line still ending at the pointer, and a release on an allowed end still connects;
 * this holds for a row's dot and for a tile.
 */
import type { Locator, Page } from "@playwright/test";
import {
  createStudy,
  design,
  expect,
  moveOnto,
  ready,
  showView,
  stillBoard,
  test,
  tile,
} from "./studio.ts";

const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name, exact: true });
const dot = (page: Page, module: string) =>
  page.locator(`.board .lane-container-row[data-module="${module}"] .lane-container-row-dot`);
const canvas = (page: Page) => page.locator(".board .react-flow");
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();

type ModuleLink = { from: string; to: { kind: string; id: string; via?: string } };
const moduleLinks = async (page: Page, id: string) =>
  (
    (await design(page, id)) as unknown as {
      architecture: { studio: { componentConnections?: ModuleLink[] } };
    }
  ).architecture.studio.componentConnections ?? [];

type Box = { x: number; y: number; width: number; height: number };
const box = async (target: Locator): Promise<Box> => {
  const found = await target.boundingBox();
  if (!found) throw new Error("Not drawn.");
  return found;
};

/**
 * The camera once it has stopped moving (a Fit and a wheel zoom animate): the same for three reads
 * in a row, 100ms apart, as `stillBoard` waits, since one unchanged read can fall between two slow
 * frames of an animation under load.
 */
async function camera(page: Page) {
  const read = () =>
    page.locator(".board .react-flow__viewport").evaluate((element) => {
      const [x, y, zoom] = ((element as HTMLElement).style.transform.match(/-?[\d.]+/g) ?? []).map(
        Number,
      );
      return { x: x ?? 0, y: y ?? 0, zoom: zoom ?? 1 };
    });
  let last = JSON.stringify(await read());
  for (let same = 0, tries = 0; tries < 60; tries += 1) {
    await page.waitForTimeout(100);
    const now = await read();
    same = JSON.stringify(now) === last ? same + 1 : 0;
    if (same === 3) return now;
    last = JSON.stringify(now);
  }
  throw new Error("The camera never stops moving.");
}

/** What a press at (x, y) would start from: a row's module by its dot, a tile, or paper. */
const pressAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const hit = document.elementFromPoint(x as number, y as number);
      const handle = hit?.closest<HTMLElement>("[data-board-end-handle]");
      if (handle) return handle.closest<HTMLElement>("[data-board-end]")?.dataset.boardEnd ?? "?";
      const node = hit?.closest<HTMLElement>(".react-flow__node");
      return node ? `tile:${node.dataset.id}` : "paper";
    },
    [x, y],
  );

/**
 * The dot's hit area, found as the mouse finds it: from its centre, how far left and right a
 * press still takes the module, and, just inside the row, how far up and down; what lies beyond.
 */
const hitArea = (page: Page, module: string, at: { x: number; y: number }) =>
  page.evaluate(
    ({ module, at }) => {
      const owner = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        const handle = hit?.closest<HTMLElement>("[data-board-end-handle]");
        if (handle) return handle.closest<HTMLElement>("[data-board-end]")?.dataset.boardEnd;
        return hit?.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? "paper";
      };
      const reach = (dx: number, dy: number, x = at.x, y = at.y) => {
        let d = 0;
        while (d < 60 && owner(x + dx * (d + 0.25), y + dy * (d + 0.25)) === module) d += 0.25;
        return d;
      };
      const left = reach(-1, 0);
      const right = reach(1, 0);
      const inRow = at.x - 4;
      const up = reach(0, -1, inRow);
      const down = reach(0, 1, inRow);
      return {
        width: left + right,
        height: up + down,
        top: at.y - up,
        bottom: at.y + down,
        above: owner(inRow, at.y - up - 0.5),
        below: owner(inRow, at.y + down + 0.5),
      };
    },
    { module, at },
  );

/** Whether `inner` is inside `outer` with `clear` to spare on every side. */
const inside = (inner: Box, outer: Box, clear: number) =>
  inner.x >= outer.x + clear &&
  inner.y >= outer.y + clear &&
  inner.x + inner.width <= outer.x + outer.width - clear &&
  inner.y + inner.height <= outer.y + outer.height - clear;

/**
 * With a connect drag under way, holds the mouse just past the canvas edge on `target`'s side
 * until the canvas has panned all of `target` into view, and returns where it held.
 * The mouse stays down there.
 */
async function holdPastEdge(page: Page, target: Locator) {
  const board = await box(canvas(page));
  const end = await box(target);
  const past = 16;
  const along = (start: number, size: number, from: number, length: number) =>
    from + length > start + size
      ? start + size + past
      : from < start
        ? start - past
        : from + length / 2;
  const at = {
    x: along(board.x, board.width, end.x, end.width),
    y: along(board.y, board.height, end.y, end.height),
  };
  await page.mouse.move(at.x, at.y, { steps: 8 });
  await expect
    .poll(async () => inside(await box(target), board, 1), { timeout: 15_000 })
    .toBe(true);
  return at;
}

test("at the fit, a module connects from anywhere in its dot's hit area", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Dots YouTube", "YouTube · studio study");
  try {
    await tool(page, "Detailed").click();
    await ready(page);
    await tool(page, "Connect").click();
    await tool(page, "Fit").click();
    const { zoom } = await camera(page);
    // The YouTube study's Detailed fit is small; the board publishes its zoom for hit areas.
    expect(zoom).toBeLessThan(0.45);
    expect(
      await page
        .locator(".board")
        .evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--board-zoom"))),
    ).toBeCloseTo(zoom, 4);

    // Watch API's last two rows: the dots stay drawn at 12px (about 4px here), 32px apart.
    const views = await box(dot(page, "watch-views"));
    const counts = await box(dot(page, "watch-counts"));
    expect(views.width).toBeCloseTo(12 * zoom, 0);
    const centre = { x: views.x + views.width / 2, y: views.y + views.height / 2 };
    const pitch = centre.y - (counts.y + counts.height / 2);
    expect(pitch).toBeCloseTo(32 * zoom, 0);
    // The hit area is at least 16px wide and as tall as the pitch: it meets the row above's
    // halfway between the dots, and below the last row it is the tile again.
    const hit = await hitArea(page, "watch-views", centre);
    expect(hit.width).toBeGreaterThanOrEqual(15.5);
    expect(hit.height).toBeGreaterThanOrEqual(pitch - 1.5);
    expect(hit.above).toBe("watch-counts");
    expect(Math.abs(hit.top - (centre.y - pitch / 2))).toBeLessThanOrEqual(1);
    expect(hit.below).toBe("watch");
    test.info().annotations.push({
      type: "hit area",
      description: `${hit.width}×${hit.height}px at zoom ${zoom.toFixed(3)}; the dot ${views.width.toFixed(1)}px`,
    });
    // A press 7px left of the dot, in its row, is the module's (the dot's old 28px area reached
    // under 5px here); so is one 2px right of it.
    expect(await pressAt(page, centre.x - 7, centre.y)).toBe("watch-views");
    expect(await pressAt(page, centre.x + 2, centre.y)).toBe("watch-views");
    expect(await pressAt(page, centre.x - 7, centre.y - pitch + 1)).toBe("watch-counts");

    // Hovering the container grows its dots a little.
    await tile(page, "Watch API").locator(".lane-container-header").hover();
    await expect
      .poll(async () => (await box(dot(page, "watch-views"))).width)
      .toBeGreaterThan(14 * zoom);

    // The drag from the hit area, 7px off the dot, connects the module, not the tile.
    const before = await design(page, id);
    const links = await moduleLinks(page, id);
    await page.mouse.move(centre.x - 7, centre.y);
    await page.mouse.down();
    await moveOnto(page, tile(page, "View counts"));
    await expect(tile(page, "View counts")).toHaveClass(/is-drop-over/);
    await page.mouse.up();
    await expect.poll(async () => (await moduleLinks(page, id)).length).toBe(links.length + 1);
    const after = await design(page, id);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.connections).toEqual(before.connections);
    expect((await moduleLinks(page, id)).at(-1)).toMatchObject({
      from: "watch-views",
      to: { kind: "element", id: "view-counts" },
    });
    // One Undo step.
    await undo(page);
    await expect.poll(async () => moduleLinks(page, id)).toEqual(links);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("a dot drag held past the canvas edge pans, then connects on release", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Dots edge pan", "YouTube · studio study");
  try {
    // With the inspector open, the canvas has a rail past its right edge, the header above it.
    await page.getByRole("button", { name: "Open inspector" }).click();
    await tool(page, "Detailed").click();
    await ready(page);
    await tool(page, "Connect").click();
    await tool(page, "Fit").click();
    await camera(page);
    // Zoomed in on the Upload service's Job publisher, Metadata (a database) is out of view. The
    // zoom aims at the pointer only while it is on a tile, so aim once the tiles are still too.
    await stillBoard(page);
    const source = dot(page, "upload-jobs");
    const start = await box(source);
    expect(await pressAt(page, start.x + start.width / 2, start.y + start.height / 2)).toBe(
      "upload-jobs",
    );
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.wheel(0, -1200);
    const zoomed = await camera(page);
    const target = tile(page, "Metadata");
    expect(inside(await box(target), await box(canvas(page)), 1)).toBe(false);

    // The press lands on the module's dot, inside the board, and the move starts a connect drag:
    // each a precondition of the pan, so a failure names the step that broke.
    const links = await moduleLinks(page, id);
    const from = await box(source);
    expect(inside(from, await box(canvas(page)), 0)).toBe(true);
    expect(await pressAt(page, from.x + from.width / 2, from.y + from.height / 2)).toBe(
      "upload-jobs",
    );
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y, { steps: 3 });
    await expect(page.locator(".board")).toHaveAttribute("data-connecting");
    const held = await holdPastEdge(page, target);
    // The canvas moved, at the same zoom, and the line still ends at the pointer.
    const panned = await camera(page);
    expect(panned.zoom).toBe(zoomed.zoom);
    expect(panned).not.toEqual(zoomed);
    const line = page.locator(".board-connect-line line");
    expect(Number(await line.getAttribute("x2"))).toBeCloseTo(held.x, 0);
    expect(Number(await line.getAttribute("y2"))).toBeCloseTo(held.y, 0);
    // Back inside, the pan stops; released on the database, the module connects.
    const board = await box(canvas(page));
    await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2, { steps: 4 });
    await moveOnto(page, target);
    await expect(target).toHaveClass(/is-drop-over/);
    await page.mouse.up();
    await expect.poll(async () => (await moduleLinks(page, id)).length).toBe(links.length + 1);
    expect((await moduleLinks(page, id)).at(-1)).toMatchObject({
      from: "upload-jobs",
      to: { kind: "element", id: "metadata-db" },
    });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("a tile drag held past the canvas edge pans, then links on release", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  await page.getByRole("button", { name: "Open inspector" }).click();
  await tool(page, "Connect").click();
  await tool(page, "Fit").click();
  await camera(page);
  // Zoomed in on Shorten service, Click events is out of view.
  const source = tile(page, "Shorten service");
  const start = await box(source);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.wheel(0, -1200);
  const zoomed = await camera(page);
  const target = tile(page, "Click events");
  expect(inside(await box(target), await box(canvas(page)), 1)).toBe(false);

  const before = await design(page, id);
  const from = await box(source);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 3 });
  const held = await holdPastEdge(page, target);
  const panned = await camera(page);
  expect(panned.zoom).toBe(zoomed.zoom);
  expect(panned).not.toEqual(zoomed);
  const line = page.locator(".board-connect-line line");
  expect(Number(await line.getAttribute("x2"))).toBeCloseTo(held.x, 0);
  expect(Number(await line.getAttribute("y2"))).toBeCloseTo(held.y, 0);
  const board = await box(canvas(page));
  await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2, { steps: 4 });
  await moveOnto(page, target);
  await expect(target).toHaveClass(/is-drop-over/);
  await page.mouse.up();
  await expect
    .poll(async () => (await design(page, id)).connections.length)
    .toBe(before.connections.length + 1);
  expect(
    (await design(page, id)).connections.find(
      (item) => item.from.element === "shorten" && item.to.element === "click-events",
    ),
  ).toMatchObject({ planned: { interaction: "Asynchronous" } });
});

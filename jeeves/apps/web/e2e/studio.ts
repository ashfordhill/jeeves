/** Shared steps for the studio smoke specs. Each spec works on its own new TinyURL project. */
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** The lane canvas has laid out and taken its camera. */
export const ready = (page: Page) =>
  expect(page.locator('.board[data-layout="ready"][data-board="ready"]')).toBeVisible({
    timeout: 20_000,
  });

/**
 * Waits until no tile moves on screen for 300 ms, longer than the board's 200 ms layout animation.
 * A save's re-layout lands, animates and may move the camera after `ready` already holds; at
 * v2's Detailed fit a tile can be 28px across, so a click or drag aimed during that motion misses.
 */
export async function stillBoard(page: Page) {
  const boxes = () =>
    page
      .locator(".board .react-flow__node")
      .evaluateAll((nodes) =>
        nodes.map((node) => JSON.stringify(node.getBoundingClientRect())).join("|"),
      );
  let last = await boxes();
  for (let same = 0, tries = 0; same < 3; tries += 1) {
    if (tries > 200) throw new Error("The board never stops moving.");
    await page.waitForTimeout(100);
    const now = await boxes();
    same = now === last ? same + 1 : 0;
    last = now;
  }
}

/** A canvas view; a new project opens in Detailed, the default. */
export type CanvasView = "Detailed" | "Simple";

/**
 * Shows a canvas view by its toggle button, by mouse, and waits until its tiles, lines and camera
 * have stopped moving: a switch animates every tile and then fits.
 */
export async function showView(page: Page, view: CanvasView) {
  const toggle = page.getByRole("group", { name: "View", exact: true });
  await toggle.getByRole("button", { name: view, exact: true }).click();
  await expect(toggle.getByRole("button", { name: view, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (view === "Simple") await expect(page.locator(".board .lane-container")).toHaveCount(0);
  await ready(page);
  const drawn = () =>
    page
      .locator(".lane-canvas .board")
      .evaluate((board) =>
        [
          board.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform,
          ...Array.from(board.querySelectorAll<HTMLElement>(".react-flow__node")).map(
            (node) => node.style.transform,
          ),
          ...Array.from(board.querySelectorAll(".react-flow__edge-path")).map((path) =>
            path.getAttribute("d"),
          ),
        ].join(" "),
      );
  let last = await drawn();
  for (let still = 0, i = 0; still < 2; i += 1) {
    if (i >= 60) throw new Error("The canvas never stops moving.");
    await page.waitForTimeout(150);
    const now = await drawn();
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

/**
 * Creates a study project through the project menu (the default study unless `study`
 * names another by its label, or is "blank" for a blank architecture) and returns its ID. It
 * opens in Detailed, the default; `view: "Simple"` switches to the Simple view by mouse, for
 * specs written for one plain tile per element.
 */
export async function createStudy(
  page: Page,
  name = "E2E TinyURL",
  study?: string,
  view: CanvasView = "Detailed",
): Promise<string> {
  // Without a project in the URL the app opens the most recent one, which may be another test's
  // and be deleted as it loads. So open a project no test deletes, when there is one.
  const listed = await page.request.get("/api/projects");
  const projects = listed.ok()
    ? ((await listed.json()).projects as { id: string; name: string }[])
    : [];
  const stable = projects.find((item) => !item.name.startsWith("E2E "));
  await page.goto(stable ? `/?project=${stable.id}` : "/");
  const menu = page.getByRole("button", { name: /^Project:/ });
  await expect(menu).toBeVisible();
  const previous = new URL(page.url()).searchParams.get("project");
  await menu.click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  if (study === "blank")
    await page.getByRole("button", { name: "Choose Blank architecture" }).click();
  else {
    await page.getByRole("button", { name: "Choose Architecture study" }).click();
    if (study) await page.getByLabel("Study", { exact: true }).selectOption({ label: study });
  }
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  const project = () => new URL(page.url()).searchParams.get("project");
  await expect.poll(project).not.toBe(previous);
  await ready(page);
  const id = project();
  if (!id) throw new Error("No project in the URL.");
  if (view === "Simple") await showView(page, "Simple");
  return id;
}

export const tiles = (page: Page) => page.locator(".board .react-flow__node");
export const lines = (page: Page) => page.locator(".board .react-flow__edge");
export const dashedLines = (page: Page) => page.locator(".board .react-flow__edge-path.is-dashed");
/** A tile by its accessible name (the tile or action name, or "User" for the actor). */
export const tile = (page: Page, name: string): Locator =>
  page.locator(".board").getByRole("group", { name, exact: true });

/**
 * A screen point on a visible, exposed stretch of this route, where the mouse hits that line. The
 * route is read once it has stopped moving: `ready` holds as soon as ELK lands, while the layout
 * still animates for 200ms, so a point read then can be paper by the time it is used.
 */
export async function linePoint(page: Page, id: string) {
  const path = page.locator(`.board .react-flow__edge[data-id="${id}"] .react-flow__edge-path`);
  const camera = page.locator(".board .react-flow__viewport");
  let last = "";
  for (let i = 0, still = 0; still < 2; i += 1) {
    const now = `${await path.getAttribute("d")} ${await camera.getAttribute("style")}`;
    still = now === last ? still + 1 : 0;
    if (i >= 60) throw new Error("The line never stops moving.");
    last = now;
    await page.waitForTimeout(60);
  }
  return path.evaluate((element) => {
    const path = element as SVGPathElement;
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("The line is not drawn.");
    const edge = path.closest(".react-flow__edge");
    for (let i = 1; i < 100; i++) {
      const at = path.getPointAtLength((path.getTotalLength() * i) / 100);
      const screen = new DOMPoint(at.x, at.y).matrixTransform(matrix);
      if (document.elementFromPoint(screen.x, screen.y)?.closest(".react-flow__edge") === edge)
        return { x: screen.x, y: screen.y };
    }
    throw new Error("No visible stretch of this line can be clicked.");
  });
}

/** A screen point on empty paper in the canvas: the pane itself is under it, not a tile, line or
 * control. */
export async function paperPoint(page: Page) {
  return page.locator(".lane-canvas .board").evaluate((board) => {
    const box = board.getBoundingClientRect();
    for (let fy = 0.15; fy < 0.9; fy += 0.05)
      for (let fx = 0.15; fx < 0.9; fx += 0.05) {
        const x = box.left + box.width * fx;
        const y = box.top + box.height * fy;
        if (document.elementFromPoint(x, y)?.classList.contains("react-flow__pane"))
          return { x, y };
      }
    throw new Error("No empty paper in the canvas.");
  });
}

/** Drags empty paper by mouse, which pans the camera. */
export async function dragPaper(page: Page, by = { x: -160, y: 60 }) {
  const at = await paperPoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + by.x, at.y + by.y, { steps: 6 });
  await page.mouse.up();
}

/** Click a visible, exposed stretch of this route, using the same hit target as the mouse. */
export async function clickLine(page: Page, id: string) {
  const point = await linePoint(page, id);
  await page.mouse.click(point.x, point.y);
  const chooser = page.getByRole("dialog", { name: "Choose relationship" });
  if (await chooser.isVisible()) await chooser.locator(`[data-line-id="${id}"]`).click();
  await expect(page.locator(`.board .react-flow__edge[data-id="${id}"]`)).toHaveClass(/selected/);
}

/** The element's box once the camera and layout have stopped moving it. */
export async function settledBox(target: Locator) {
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    const box = await target.boundingBox();
    const key = JSON.stringify(box);
    if (box && key === last) return box;
    last = key;
    await target.page().waitForTimeout(50);
  }
  throw new Error("The element is not drawn, or never stops moving.");
}

/** The open fan's items (every kind, in its slot), opened by a click or a pull. */
export const fan = (page: Page) => page.locator(".board-pull [data-fan-item]");
/** An item of the open fan, by its name. */
export const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });

/**
 * Clicks one of the selected tile's tabs (by its accessible name, such as "Add linked tile"), which
 * opens its fan until the next click.
 */
export async function openFan(page: Page, name: string, tab: string) {
  const handle = tile(page, name).getByRole("button", { name: tab, exact: true });
  await settledBox(handle);
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(fan(page).first()).toBeVisible();
}

/** Clicks the selected tile's tab, then the fan's item `item`, by mouse. */
export async function pickFrom(page: Page, name: string, tab: string, item: string) {
  await openFan(page, name, tab);
  await fanItem(page, item).click();
  await expect(fan(page)).toHaveCount(0);
}

/** The open module menu (a tile's `+`, on the board or in the inspector). */
export const moduleMenu = (page: Page) => page.getByRole("menu", { name: /^Add module to / });

/**
 * Clicks the `+` in `scope` (a tile on the board, or the inspector), then the menu's `kind`, by
 * mouse; the new module's page opens with its name focused.
 */
export async function addModuleFrom(page: Page, scope: Locator, kind: string) {
  const plus = scope.getByRole("button", { name: "Add module", exact: true });
  await settledBox(plus);
  await plus.click();
  await expect(moduleMenu(page)).toBeVisible();
  await moduleMenu(page).getByRole("menuitem", { name: kind, exact: true }).click();
  await expect(moduleMenu(page)).toHaveCount(0);
}

/**
 * Presses one of the selected tile's tabs (by its accessible name, such as "Add linked tile")
 * and pulls it past the 36px threshold, so the fan opens. The mouse stays down.
 */
export async function pull(page: Page, name: string, tab: string, by = { x: 60, y: 12 }) {
  const handle = await settledBox(tile(page, name).getByRole("button", { name: tab, exact: true }));
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + by.x, y + by.y, { steps: 6 });
}

/**
 * Presses the mouse on the middle of tile `from` (or any element) and drags it onto `to` in small
 * steps (Connect mode draws a line). The mouse stays down.
 */
export async function dragOnto(page: Page, from: Locator, to: Locator) {
  const box = await settledBox(from);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await moveOnto(page, to);
}

/** Moves the pressed mouse to the middle of `target` in small steps. */
export async function moveOnto(page: Page, target: Locator) {
  const box = await settledBox(target);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
}

export async function design(page: Page, id: string) {
  const res = await page.request.get(`/api/projects/${id}/design`);
  expect(res.ok(), `${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()).design as {
    revision: number;
    elements: { id: string; name: string }[];
    connections: {
      id: string;
      kind: string;
      from: { element: string };
      to: { element: string };
      planned: { label: string; interaction: string };
    }[];
    architecture: {
      studio: {
        elements: { element: string; settings: Record<string, unknown> }[];
        components: { name: string; settings: Record<string, unknown> }[];
        entries: { id: string; lane: string; element: string }[];
        actions?: { lane: string; name: string }[];
      };
    };
  };
}

/**
 * `tinyurl` is the ID of a new TinyURL project, open in `page` in Detailed (a test written for
 * the Simple view starts with `showView`) and deleted after the test. The test also fails on any
 * uncaught page error.
 */
export const test = base.extend<{ tinyurl: string }>({
  tinyurl: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    // These existing graph/settings tests deliberately exercise the extended schema2 study.
    // The new foundation's default and complete v3 seed are covered in foundation.spec.ts.
    const id = await createStudy(
      page,
      "E2E TinyURL extended",
      "TinyURL · extended study (design only)",
    );
    await use(id);
    await page.request.delete(`/api/projects/${id}`);
    expect(errors).toEqual([]);
  },
});
export { expect };

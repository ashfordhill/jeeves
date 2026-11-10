/** Shared steps for the studio smoke specs. Each spec works on its own new TinyURL project. */
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** The lane canvas has laid out and taken its camera. */
export const ready = (page: Page) =>
  expect(page.locator('.board[data-layout="ready"][data-board="ready"]')).toBeVisible({
    timeout: 20_000,
  });

/**
 * Creates a study project through the project menu (the default study unless `study`
 * names another by its label, or is "blank" for a blank architecture) and returns its ID.
 */
export async function createStudy(
  page: Page,
  name = "E2E TinyURL",
  study?: string,
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
  return id;
}

export const tiles = (page: Page) => page.locator(".board .react-flow__node");
export const lines = (page: Page) => page.locator(".board .react-flow__edge");
export const dashedLines = (page: Page) => page.locator(".board .react-flow__edge-path.is-dashed");
/** A tile by its accessible name (the tile or action name, or "User" for the actor). */
export const tile = (page: Page, name: string): Locator =>
  page.locator(".board").getByRole("group", { name, exact: true });

/**
 * Click a visible, exposed stretch of this route, using the same hit target as the mouse. The
 * route is read once it has stopped moving: `ready` holds as soon as ELK lands, while the layout
 * still animates for 200ms, so a point read then can be paper by the time it is clicked.
 */
export async function clickLine(page: Page, id: string) {
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
  const point = await path.evaluate((element) => {
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
  await page.mouse.click(point.x, point.y);
  const chooser = page.getByRole("dialog", { name: "Choose relationship" });
  if (await chooser.isVisible()) await chooser.locator(`[data-line-id="${id}"]`).click();
  await expect(page.locator(`.board .react-flow__edge[data-id="${id}"]`)).toHaveClass(/selected/);
}

/** The element's box once the camera and layout have stopped moving it. */
async function settledBox(target: Locator) {
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

/**
 * Presses one of the selected tile's pull tabs (by its accessible name, such as "Add after")
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
 * `tinyurl` is the ID of a new TinyURL project, open in `page` and deleted after the test. The
 * test also fails on any uncaught page error.
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

/** Shared steps for the studio smoke specs. Each spec works on its own new TinyURL project. */
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** The lane canvas has laid out and taken its camera. */
export const ready = (page: Page) =>
  expect(page.locator('.board[data-layout="ready"][data-board="ready"]')).toBeVisible({
    timeout: 20_000,
  });

/** Creates a TinyURL study project through the project menu and returns its ID. */
async function createTinyUrl(page: Page, name = "E2E TinyURL"): Promise<string> {
  await page.goto("/");
  // The app first opens the most recent project, which may be another test's.
  const menu = page.getByRole("button", { name: /^Project:/ });
  await expect(menu).toBeVisible();
  const previous = new URL(page.url()).searchParams.get("project");
  await menu.click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await page.getByRole("button", { name: "Choose Architecture study" }).click();
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
/** A tile by its accessible name (the tile name, or "User" for the actor). */
export const tile = (page: Page, name: string): Locator =>
  page.locator(".board").getByRole("group", { name, exact: true });

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
 * Presses one of the selected tile's pull tabs (by its accessible name, such as "Request after")
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
    const id = await createTinyUrl(page);
    await use(id);
    await page.request.delete(`/api/projects/${id}`);
    expect(errors).toEqual([]);
  },
});
export { expect };

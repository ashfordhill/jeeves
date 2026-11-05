/** Shared steps for the studio smoke specs. Each spec works on its own new TinyURL project. */
import { test as base, expect, type Locator, type Page } from "@playwright/test";

export const ready = (page: Page) =>
  expect(page.locator('.studio-graph[data-layout="ready"]')).toBeVisible({ timeout: 20_000 });

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

export async function level(page: Page, name: "C1" | "C2" | "C3") {
  await page
    .getByRole("navigation", { name: "Architecture depth" })
    .getByRole("button", { name, exact: true })
    .click();
  await ready(page);
}

export const boxes = (page: Page) => page.locator(".react-flow__node");
export const lines = (page: Page) => page.locator(".react-flow__edge");
export const box = (page: Page, name: string): Locator =>
  boxes(page)
    .filter({ has: page.locator(`strong:text-is("${name}")`) })
    .last();

export async function design(page: Page, id: string) {
  const res = await page.request.get(`/api/projects/${id}/design`);
  expect(res.ok(), `${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()).design as {
    revision: number;
    elements: { id: string; name: string }[];
    architecture: {
      studio: { components: { name: string; settings: Record<string, unknown> }[] };
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

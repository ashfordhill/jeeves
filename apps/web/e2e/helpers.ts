/** Shared e2e helpers. Each test gets its own project so tests can run in parallel. */
import { type APIRequestContext, expect, type Page } from "@playwright/test";

export async function openNewProject(page: Page, request: APIRequestContext, name: string) {
  const res = await request.post("/api/projects", { data: { name } });
  expect(res.status()).toBe(201);
  const { project } = (await res.json()) as { project: { id: string } };
  await page.goto(`/?project=${project.id}#/draw`);
  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
  return project.id;
}

export async function designOf(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/projects/${id}/design`);
  return (await res.json()) as {
    design: {
      revision: number;
      elements: {
        id: string;
        name: string;
        config: Record<string, unknown>;
        notes: string;
        attachments: { id: string }[];
      }[];
      connections: { kind: string }[];
    };
  };
}

export async function layoutOf(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/projects/${id}/layout`);
  return ((await res.json()) as { layout: { items: Record<string, { x: number; y: number }> } })
    .layout;
}

export const card = (page: Page, name: string) => page.getByRole("article", { name });

export async function editorAction(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name: "Editor actions", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
export async function diagramAction(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name: "Diagram options", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
/** Off-screen objects remain mouse-reachable through the compact find dialog. */
export async function inspectObject(page: Page, id: string) {
  await editorAction(page, "Find object");
  await page
    .getByRole("dialog", { name: "Find object" })
    .getByLabel("Inspect an object")
    .selectOption(id);
}
export async function reviewRelease(page: Page, element: string, name: string, release: string) {
  await page.locator(`[data-element-id="${element}"] .element-card-name`).click();
  const card = page.getByRole("complementary", { name: "Architecture details" });
  const details = card.locator(".subtype-implementation");
  if (!(await details.getAttribute("open"))) {
    // An empty open attribute is still open.
    if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
      await details.locator("summary").click();
  }
  await card.getByLabel(`Template release of ${name}`, { exact: true }).selectOption(release);
}

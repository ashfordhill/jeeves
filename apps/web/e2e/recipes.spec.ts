import { expect, test } from "./browser-test.ts";
import { designOf, openNewProject } from "./helpers.ts";

test("creates a separate configured recipe diagram by mouse and keeps the original project", async ({
  page,
  request,
}) => {
  const originalName = `Original recipe-flow ${crypto.randomUUID().slice(0, 8)}`;
  const original = await openNewProject(page, request, originalName);
  await page.getByRole("button", { name: `Project: ${originalName}` }).click();
  await page.getByRole("menuitem", { name: "New from recipe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New from recipe" });
  await expect(dialog.getByText("QR Studio", { exact: true })).toBeVisible();
  await dialog.getByLabel("Project and product name").fill("Independent Studio");
  await dialog.getByLabel("Product tagline").fill("Built from a diagram");
  await dialog.getByLabel("Default analytics range").selectOption("7");
  await page.screenshot({ animations: "disabled", path: "test-results/p19-recipe-dialog.png" });
  await dialog.getByRole("button", { name: "Create diagram" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Project: Independent Studio" })).toBeVisible();
  await expect(page.locator("[data-element-id]")).toHaveCount(3);
  const id = new URL(page.url()).searchParams.get("project");
  expect(id).toBeTruthy();
  expect(id).not.toBe(original);
  const state = await (await request.get(`/api/projects/${id}/design`)).json();
  expect(state.design.recipe).toEqual({
    id: "qr-studio",
    version: "0.1.0",
    config: { tagline: "Built from a diagram", analyticsDays: 7 },
  });
  expect(state.findings).toEqual([]);
  expect((await designOf(request, original)).design.elements).toEqual([]);
  await page.screenshot({ animations: "disabled", path: "test-results/p19-recipe-diagram.png" });
  await page.getByRole("button", { name: "Project: Independent Studio" }).click();
  await page.getByRole("menuitem", { name: originalName, exact: true }).click();
  await expect(page.locator("[data-element-id]")).toHaveCount(0);
  await request.delete(`/api/projects/${id}`);
  await request.delete(`/api/projects/${original}`);
});

import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject, openNewProject } from "./helpers.ts";

test("creates an editable starter by mouse, keeps the previous diagram and reaches C4, resource editing and generation", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const original = await openNewProject(page, request, "Keep my diagram");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Use an implemented starter or recipe", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog.getByLabel("Workspace preset")).toBeVisible();
  await dialog.getByRole("button", { name: "Choose QR Studio", exact: true }).click();
  await expect(dialog.getByLabel("Default analytics range")).toBeVisible();
  await expect(
    dialog.getByText(/core resource definitions and implementation stay protected/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("project")).toBe(original);
  await page.getByRole("button", { name: "Project: Keep my diagram" }).click();
  await page.getByRole("menuitem", { name: "New project", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Create a project" });
  await dialog.getByLabel("Project and product name").fill("Fieldwork from a diagram");
  await dialog.getByLabel("Workspace preset").selectOption("paper");
  await dialog.getByLabel("Records per page").selectOption("25");
  await dialog.getByLabel("Workspace tagline").fill("A place for every record.");
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await dialog.getByRole("button", { name: "Choose Resource workspace" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/p26-project-chooser.png", animations: "disabled" });
  await page.setViewportSize({ width: 650, height: 850 });
  await expect(
    dialog.getByRole("button", { name: "Create project", exact: true }),
  ).toBeInViewport();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: "test-results/p26-project-chooser-narrow.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editorAction(page, "Show inspector");
  const id = new URL(page.url()).searchParams.get("project");
  expect(id).not.toBe(original);
  expect(id).toBeTruthy();
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  let design = await read();
  expect(design.recipe).toBeUndefined();
  expect(design.startedFrom).toMatchObject({ id: "resource-workspace", version: "0.1.0" });
  await expect(page.getByRole("navigation", { name: "Architecture levels" })).toBeVisible();
  await page.screenshot({ path: "test-results/p26-starter-board.png", animations: "disabled" });
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Inspect Workspace member", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/p26-starter-context.png", animations: "disabled" });
  await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
  await inspectObject(page, "container:inventory");
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure resources" });
  await dialog.getByLabel("Field 1 name", { exact: true }).fill("displayName");
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  design = await read();
  expect(design.elements[0].attachments[0].config.model.resources[0].fields[0].name).toBe(
    "displayName",
  );
  await inspectObject(page, "container:inventory-web");
  await page.getByRole("button", { name: "Configure resource workspace", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure resource workspace" });
  await expect(dialog.getByLabel("Visual preset")).toHaveValue("paper");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const generate = page.getByRole("region", { name: "Generate", exact: true });
  const dir = mkdtempSync(join(tmpdir(), "jeeves-starter-browser-"));
  try {
    await generate.getByLabel("Output folder").fill(dir);
    await generate.getByLabel(/Run the baseline check/).uncheck();
    await generate.getByRole("button", { name: "Generate project", exact: true }).click();
    await expect(generate.getByRole("status")).toContainText("Written, baseline not run", {
      timeout: 45_000,
    });
    const descriptor = JSON.parse(
      readFileSync(join(dir, "frontends/inventory-web/src/workspace.generated.json"), "utf8"),
    );
    expect(descriptor).toMatchObject({ preset: "paper", pageSize: 25 });
    expect(descriptor.collections[0].primaryField).toBe("displayName");
    expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  expect(
    (await (await request.get(`/api/projects/${original}/design`)).json()).design.elements,
  ).toEqual([]);
  await request.delete(`/api/projects/${id}`);
  await request.delete(`/api/projects/${original}`);
});

test("recovers a scoped catalog failure and creates a blank project without conflating it with a starter", async ({
  page,
  request,
  browserProblems,
}) => {
  const original = await openNewProject(page, request, "Catalog recovery");
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  const expected = browserProblems.expectHttp({
    scenario: "catalog unavailable",
    method: "GET",
    url: new URL("/api/starters", page.url()).href,
    resourceType: "fetch",
    status: 503,
  });
  await page.route(
    "**/api/starters",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Catalog unavailable for this fixture" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Use an implemented starter or recipe", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(
    dialog.getByText("Starting architectures could not load", { exact: true }),
  ).toBeVisible();
  expected.finish();
  await dialog.getByRole("button", { name: "Retry catalog" }).click();
  await expect(dialog.getByLabel("Workspace preset")).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: "test-results/p26-project-chooser-dark.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Choose Blank canvas", exact: true }).click();
  await dialog.getByLabel("Project and product name").fill("A blank idea");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const id = new URL(page.url()).searchParams.get("project");
  const design = (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  expect(design.elements).toEqual([]);
  expect(design.startedFrom).toBeUndefined();
  expect(design.recipe).toBeUndefined();
  await request.delete(`/api/projects/${id}`);
  await request.delete(`/api/projects/${original}`);
});

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type DesignDocument, designSchema, workspaceConfigSchema } from "@jeeves/spec";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

const fixture = designSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/generated-workspace.json", import.meta.url),
      "utf8",
    ),
  ),
);
test("configures generated resource screens by mouse with actual C4 binding, undo, reload and narrow accessibility", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "Inventory workspace configuration");
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...fixture.elements.map((element: unknown) => ({ op: "addElement", element })),
            ...fixture.connections.map((connection: unknown) => ({ op: "connect", connection })),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const configOf = (design: DesignDocument) =>
    workspaceConfigSchema.parse(
      design.elements
        .find((element) => element.id === "inventory-web")!
        .attachments.find((attachment) => attachment.id === "inventory-workspace")!.config,
    );
  const before = configOf(await read());
  await page.reload();
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  const architecture = page.getByRole("region", { name: "Architecture workspace", exact: true });
  await architecture
    .getByRole("navigation", { name: "Architecture levels" })
    .getByRole("button", { name: /Containers/ })
    .click();
  const details = architecture.getByRole("complementary", { name: "Architecture details" });
  await details.getByLabel("Inspect an object").selectOption("container:inventory-web");
  await details.getByRole("button", { name: "Open components" }).click();
  await details
    .getByLabel("Inspect an object")
    .selectOption("component:inventory-web:inventory-workspace");
  await expect(details.getByText(/Accounts, owner-record forms/)).toBeVisible();
  await expect(
    architecture.getByRole("button", { name: "Inspect Inventory API", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/p25-components.png", animations: "disabled" });
  await details.getByText("Technical details", { exact: true }).click();
  await details.getByRole("button", { name: "Open in C2" }).click();
  await page.getByRole("button", { name: "Configure resource workspace", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Configure resource workspace" });
  await dialog.getByLabel("Visual preset").selectOption("paper");
  await dialog.getByRole("checkbox", { name: "Warehouse", exact: true }).uncheck();
  await expect(dialog.getByText(/also select its required parent warehouse/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save workspace configuration" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(configOf(await read())).toEqual(before);
  await page.getByRole("button", { name: "Configure resource workspace", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure resource workspace" });
  await dialog.getByLabel("Visual preset").selectOption("paper");
  await dialog.getByLabel("Records per page").selectOption("25");
  await dialog.getByLabel("Workspace tagline").fill("Every record has a place.");
  await dialog.getByLabel("Edit display for").selectOption("stock-item");
  await dialog.getByLabel("Collection label", { exact: true }).fill("Inventory items");
  await dialog.getByLabel("Record title field").selectOption("title");
  await dialog
    .getByRole("group", { name: /Table columns/ })
    .getByRole("checkbox", { name: "Notes", exact: true })
    .check();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await dialog.getByLabel("Resource API connection").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/p25-workspace-editor.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Save workspace configuration" }).click();
  await expect(dialog).not.toBeVisible();
  const changed = configOf(await read());
  expect(changed).toMatchObject({
    preset: "paper",
    pageSize: 25,
    tagline: "Every record has a place.",
  });
  expect(changed.collections[1]).toMatchObject({
    resource: "stock-item",
    label: "Inventory items",
    columns: ["title", "quantity", "state", "$createdAt", "notes"],
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => configOf(await read())).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => configOf(await read())).toEqual(changed);
  await page.reload();
  await page.locator('[data-element-id="inventory-web"]').click();
  await page.getByRole("button", { name: "Configure resource workspace", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure resource workspace" });
  await expect(dialog.getByLabel("Visual preset")).toHaveValue("paper");
  await page.setViewportSize({ width: 650, height: 850 });
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Save workspace configuration" }),
  ).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: "test-results/p25-workspace-editor-narrow.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("a new workspace can select its API and preserves a draft when a concurrent design revision refuses it", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "Workspace draft boundaries");
  const initial = structuredClone(fixture);
  initial.elements[2]!.attachments = initial.elements[2]!.attachments.filter(
    (attachment) => attachment.template.id !== "resource-workspace",
  );
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...initial.elements.map((element: unknown) => ({ op: "addElement", element })),
            ...initial.connections.map((connection: unknown) => ({ op: "connect", connection })),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.locator('[data-element-id="inventory-web"]').click();
  await page.getByRole("button", { name: "Add attachment", exact: true }).click();
  await page.getByRole("menuitem", { name: "Resource workspace", exact: true }).click();
  await page.getByRole("button", { name: "Configure resource workspace", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure resource workspace" });
  await expect(dialog.getByRole("button", { name: "Save workspace configuration" })).toBeDisabled();
  await dialog.getByLabel("Resource API connection").selectOption("inventory-call");
  await dialog.getByRole("checkbox", { name: "Warehouse", exact: true }).check();
  await dialog.getByLabel("Collection label", { exact: true }).fill("Warehouses");
  await dialog.getByRole("checkbox", { name: "Stock Item", exact: true }).check();
  await dialog.getByLabel("Collection label", { exact: true }).fill("Stock items");
  await expect(dialog.getByRole("button", { name: "Save workspace configuration" })).toBeEnabled();
  const current = (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: current.revision,
          ops: [{ op: "updateElement", id: "inventory", name: "Renamed inventory API" }],
        },
      })
    ).status(),
  ).toBe(200);
  const expected = browserProblems.expectHttp({
    scenario: "stale workspace draft",
    method: "POST",
    url: new URL(`/api/projects/${id}/operations`, page.url()).href,
    resourceType: "fetch",
    status: 409,
  });
  await dialog.getByRole("button", { name: "Save workspace configuration" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Could not save" })).toBeVisible();
  expected.finish();
  await expect(dialog.getByLabel("Collection label", { exact: true })).toHaveValue("Stock items");
  await dialog.getByRole("button", { name: "Save workspace configuration" }).click();
  await expect(dialog.getByText(/design changed while this draft was open/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

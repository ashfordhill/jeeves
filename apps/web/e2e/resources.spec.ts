import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { DesignDocument, ResourceConfig } from "@jeeves/spec";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

const fixture = {
  elements: [
    {
      id: "inventory",
      name: "Inventory service",
      template: { id: "http-service", version: "0.2.0" },
      config: {},
      notes: "",
      attachments: [
        {
          id: "inventory-api",
          template: { id: "rest-api-server", version: "0.1.0" },
          config: {},
          notes: "",
        },
      ],
    },
    {
      id: "inventory-db",
      name: "Inventory database",
      template: { id: "postgres", version: "0.1.0" },
      config: {},
      notes: "",
      attachments: [],
    },
  ],
  connections: [
    {
      id: "inventory-store",
      kind: "uses-database",
      from: { element: "inventory" },
      to: { element: "inventory-db" },
      config: {},
    },
  ],
};

test("authors owner and related internal resources by mouse, preserves IDs and generates the selected contract", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "Inventory resources");
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...fixture.elements.map((element) => ({ op: "addElement", element })),
            ...fixture.connections.map((connection) => ({ op: "connect", connection })),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const modelOf = (design: DesignDocument) =>
    design.elements[0]!.attachments[0]!.config.model as ResourceConfig;
  const before = await read();
  await page.reload();
  await page.locator('[data-element-id="inventory"]').click();
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure resources" });
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  await dialog.getByLabel("Resource name", { exact: true }).fill("discarded");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await read()).toEqual(before);
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  await dialog.getByLabel("Resource database", { exact: true }).selectOption("inventory-store");
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  await dialog.getByLabel("Resource name", { exact: true }).fill("inventoryItem");
  await dialog.getByRole("button", { name: "Add field", exact: true }).click();
  await dialog.getByLabel("Field 1 name", { exact: true }).fill("id");
  await expect(dialog.getByRole("button", { name: "Save resources" })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("is reserved");
  await dialog.getByLabel("Field 1 name", { exact: true }).fill("label");
  await dialog.getByLabel("Field 1 required", { exact: true }).check();
  await dialog.getByRole("button", { name: "Add field", exact: true }).click();
  await dialog.getByLabel("Field 2 name", { exact: true }).fill("quantity");
  await dialog.getByLabel("Field 2 type", { exact: true }).selectOption("integer");
  await dialog.getByLabel("Field 2 maximum", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: "Add field", exact: true }).click();
  await dialog.getByLabel("Field 3 name", { exact: true }).fill("status");
  await dialog.getByLabel("Field 3 type", { exact: true }).selectOption("enum");
  await dialog.getByLabel("Field 3 choices", { exact: true }).fill("available\nreserved");
  await dialog.getByLabel("Enable update", { exact: true }).uncheck();
  await expect(dialog.getByText("POST /api/inventoryItem", { exact: true })).toBeVisible();
  await expect(dialog.getByText("PATCH /api/inventoryItem/{id}", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Resource name", { exact: true }).scrollIntoViewIfNeeded();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: "test-results/p23-resource-editor.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  await dialog.getByLabel("Resource name", { exact: true }).fill("movement");
  await dialog.getByLabel("Access scope", { exact: true }).selectOption("internal");
  await dialog.getByRole("button", { name: "Add field", exact: true }).click();
  await dialog.getByLabel("Field 1 name", { exact: true }).fill("recordedAt");
  await dialog.getByLabel("Field 1 type", { exact: true }).selectOption("timestamp");
  await dialog.getByRole("button", { name: "Add relationship", exact: true }).click();
  await expect(dialog.getByLabel("Parent resource 1", { exact: true })).toHaveValue("resource-1");
  await expect(
    dialog.getByText("No CRUD routes are exposed for this resource.", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 700, height: 760 });
  await expect(dialog.getByRole("button", { name: "Save resources" })).toBeInViewport();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: "test-results/p23-resource-editor-narrow.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const changed = await read();
  expect(changed.revision).toBe(before.revision + 1);
  expect(changed.elements[0]!.attachments[0]!.config).toMatchObject({
    auth: "session",
    basePath: "/api",
  });
  expect(modelOf(changed).resources).toMatchObject([
    {
      id: "resource-1",
      name: "inventoryItem",
      operations: ["create", "read", "list"],
      fields: [
        { id: "field-1", name: "label", required: true },
        { id: "field-2", type: "integer", maximum: 1000 },
        { id: "field-3", type: "enum", values: ["available", "reserved"] },
      ],
    },
    {
      id: "resource-2",
      name: "movement",
      access: "internal",
      operations: [],
      belongsTo: [{ id: "relation-1", resource: "resource-1", required: true }],
    },
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await read()).elements[0]!.attachments[0]!.config)
    .toEqual(before.elements[0]!.attachments[0]!.config);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await page.locator('[data-element-id="inventory"]').click();
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  await expect(dialog.getByLabel("Field 1 name", { exact: true })).toHaveValue("label");
  await dialog.getByLabel("Resource name", { exact: true }).fill("stockItem");
  await dialog.getByLabel("Field 1 name", { exact: true }).fill("title");
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const model = modelOf(await read());
  expect(model.resources[0]).toMatchObject({
    id: "resource-1",
    name: "stockItem",
    fields: [{ id: "field-1", name: "title" }, { id: "field-2" }, { id: "field-3" }],
  });
  expect(model.resources[1]!.belongsTo[0]!.resource).toBe("resource-1");

  const root = mkdtempSync(join(tmpdir(), "jeeves-p23-resource-"));
  try {
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const drawer = page.getByRole("region", { name: "Generate", exact: true });
    const output = join(root, "inventory");
    await drawer.getByRole("textbox", { name: "Output folder" }).fill(output);
    await drawer.getByRole("checkbox", { name: /Run the baseline check/ }).uncheck();
    await drawer.getByRole("button", { name: "Generate project" }).click();
    await expect(drawer.getByRole("status")).toHaveText(/Written, baseline not run/, {
      timeout: 60_000,
    });
    const contract = readFileSync(join(output, "contracts/inventory.openapi.yaml"), "utf8");
    for (const operation of ["createStockItem", "readStockItem", "listStockItem"])
      expect(contract).toContain(`operationId: ${operation}`);
    expect(contract).not.toContain("operationId: updateStockItem");
    expect(contract).not.toContain("/api/movement");
    const lock = JSON.parse(readFileSync(join(output, "jeeves/lock.json"), "utf8"));
    expect(lock.resourceModels.inventory).toEqual(model);
    expect(lock.files["contracts/inventory.openapi.yaml"]).toBe(
      `sha256-${createHash("sha256").update(contract).digest("hex")}`,
    );
    expect(
      readFileSync(join(output, "services/inventory/resource-migrations/0001.sql"), "utf8"),
    ).toContain("REFERENCES app_user(id)");
  } finally {
    rmSync(root, { recursive: true, force: true });
    await request.delete(`/api/projects/${id}`);
  }
});

test("preserves existing domain contracts and protects recipe resources while allowing separate data", async ({
  page,
  request,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("../../../fixtures/designs/qrwty-studio.json", import.meta.url), "utf8"),
  ) as DesignDocument;
  const id = await openNewProject(page, request, "Preserved domain contracts");
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...fixture.elements.map((element) => ({ op: "addElement", element })),
            ...fixture.connections.map((connection) => ({ op: "connect", connection })),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.locator('[data-element-id="qrwty"]').click();
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure resources" });
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  await dialog.getByLabel("Resource name", { exact: true }).fill("campaign");
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const after = (await (await request.get(`/api/projects/${id}/design`)).json())
    .design as DesignDocument;
  const originalModel = fixture.elements[0]!.attachments[0]!.config.model as ResourceConfig;
  const changed = after.elements[0]!.attachments[0]!.config.model as ResourceConfig;
  expect(changed.extensions).toEqual(originalModel.extensions);
  expect(changed.acceptanceCases).toEqual(originalModel.acceptanceCases);
  expect(changed.resources.slice(0, -1)).toEqual(originalModel.resources);
  // C1 navigation flushes the board's pending layout before removing this test project.
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await expect(page.getByRole("button", { name: "C1 Context", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await request.delete(`/api/projects/${id}`);

  const created = await request.post("/api/projects/from-recipe", {
    data: { name: "Recipe resource boundaries", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  expect(created.status()).toBe(201);
  const { project } = await created.json();
  const before = (await (await request.get(`/api/projects/${project.id}/design`)).json())
    .design as DesignDocument;
  await page.goto(`/?project=${project.id}#/draw`);
  await page.locator('[data-element-id="qrwty"]').click();
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  await expect(dialog.getByText("qr-studio@0.1.0", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Resource name", { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Field 1 name", { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Resource database", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Remove selected resource" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/p23-recipe-resources.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  await dialog.getByLabel("Resource name", { exact: true }).fill("campaign");
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = await (await request.get(`/api/projects/${project.id}/design`)).json();
  expect(saved.findings.filter((item: { severity: string }) => item.severity === "error")).toEqual(
    [],
  );
  const priorModel = before.elements[0]!.attachments[0]!.config.model as ResourceConfig;
  const currentModel = saved.design.elements[0].attachments[0].config.model as ResourceConfig;
  expect(currentModel).toEqual({
    ...priorModel,
    resources: [...priorModel.resources, expect.objectContaining({ name: "campaign" })],
  });
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await expect(page.getByRole("button", { name: "C1 Context", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await request.delete(`/api/projects/${project.id}`);
});

test("refuses a stale resource draft without overwriting another editor", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "Stale resource draft");
  await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      ops: fixture.elements.map((element) => ({ op: "addElement", element })),
    },
  });
  await page.reload();
  await page.locator('[data-element-id="inventory"]').click();
  await page.getByRole("button", { name: "Configure resources", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure resources" });
  await expect(dialog.getByText(/Saving the draft does not create wiring/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
  // Another editor changes semantic state while this draft remains open.
  const external = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 1,
      ops: [{ op: "updateElement", id: "inventory", name: "Changed elsewhere" }],
    },
  });
  expect(external.status()).toBe(200);
  const expected = browserProblems.expectHttp({
    scenario: "stale resource draft",
    method: "POST",
    url: new URL(`/api/projects/${id}/operations`, page.url()).href,
    resourceType: "fetch",
    status: 409,
  });
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog.getByRole("alert").last()).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save resources", exact: true })).toBeEnabled();
  expected.finish();
  const state = (await (await request.get(`/api/projects/${id}/design`)).json())
    .design as DesignDocument;
  expect(state.elements[0]!.name).toBe("Changed elsewhere");
  expect(state.elements[0]!.attachments[0]!.config.model).toBeUndefined();
  await dialog.getByRole("button", { name: "Save resources", exact: true }).click();
  await expect(dialog.getByRole("alert").last()).toContainText("Close and reopen");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await request.delete(`/api/projects/${id}`);
});

import AxeBuilder from "@axe-core/playwright";
import { architectureExample, type DesignDocument } from "@jeeves/spec";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { diagramAction, editorAction } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

async function target(page: Page, request: APIRequestContext) {
  const response = await request.post("/api/projects", { data: { name: "P45 scenarios" } });
  const id = (await response.json()).project.id;
  const example = architectureExample("qrwty-target");
  const saved = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      ops: [
        ...example.design.elements.map((element) => ({ op: "addElement", element })),
        ...example.design.connections.map((connection) => ({ op: "connect", connection })),
        { op: "setArchitecture", architecture: example.design.architecture },
      ],
    },
  });
  expect(saved.ok()).toBe(true);
  expect((await request.put(`/api/projects/${id}/layout`, { data: example.layout })).ok()).toBe(
    true,
  );
  await page.goto(`/?project=${id}#/draw`);
  await expect(page.getByRole("toolbar", { name: "Drawing tools", exact: true })).toBeVisible();
  return id as string;
}
async function capture(page: Page, name: string) {
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: `test-results/p45-${name}.png`, animations: "disabled" });
}

test("C2 scenarios add, reorder, remove and persist as one undo step, with numbered reused arrows", async ({
  page,
  request,
}) => {
  const id = await target(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const panel = page.getByRole("complementary", { name: "Scenario steps", exact: true });
  const dialog = page.getByRole("dialog", { name: "Edit scenario", exact: true });
  try {
    const initial = await read();
    await editorAction(page, "Visitor follows a QR");
    await expect(panel.getByRole("listitem")).toHaveCount(5);
    await expect(page.locator(".scenario-numbers")).toHaveCount(5);
    await capture(page, "visitor-light");
    await editorAction(page, "Owner creates a link");
    await expect(
      page.locator(".connection-chip .scenario-numbers", { hasText: "1, 3" }),
    ).toHaveCount(1);
    await capture(page, "owner-light");
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByLabel("Scenario name").fill("Discarded");
    await dialog.getByRole("button", { name: "Remove step 2", exact: true }).click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(initial);
    await editorAction(page, "Add scenario");
    await expect(dialog.getByRole("button", { name: "Save scenario", exact: true })).toBeDisabled();
    await dialog.getByLabel("Scenario name").fill("Review a link");
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await dialog
      .getByLabel("Step 1 relationship", { exact: true })
      .selectOption("connection:web-api");
    await dialog.getByLabel("Step 1 text").fill("Owner requests the saved link.");
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await dialog
      .getByLabel("Step 2 relationship", { exact: true })
      .selectOption("connection:api-db");
    await dialog.getByLabel("Step 2 text").fill("Read the owner's stored record.");
    await dialog.getByRole("button", { name: "Move step 2 up", exact: true }).click();
    await expect(dialog.getByLabel("Step 1 text")).toHaveValue("Read the owner's stored record.");
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await dialog.getByLabel("Step 3 text").fill("Remove this temporary step.");
    await dialog.getByRole("button", { name: "Remove step 3", exact: true }).click();
    await dialog.getByRole("button", { name: "Save scenario", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const saved = await read();
    expect(saved.revision).toBe(initial.revision + 1);
    const added = saved.architecture!.scenarios!.find(
      (scenario) => scenario.name === "Review a link",
    )!;
    expect(added.steps.map((step) => step.relationship.id)).toEqual(["api-db", "web-api"]);
    expect(saved.connections).toEqual(initial.connections);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(initial.architecture?.scenarios);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(saved.architecture?.scenarios);
    await page.reload();
    await editorAction(page, "Review a link");
    await expect(panel.getByRole("listitem")).toHaveText([
      "Read the owner's stored record.",
      "Owner requests the saved link.",
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await editorAction(page, "Visitor follows a QR");
    await capture(page, "visitor-dark");
    await editorAction(page, "Owner creates a link");
    await capture(page, "owner-dark");
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: "test-results/p45-editor-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await editorAction(page, "Review a link");
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByRole("button", { name: "Remove scenario", exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(initial.architecture?.scenarios);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(saved.architecture?.scenarios);
    // C1 never shows scenario overlays or protocol labels.
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.locator(".scenario-numbers")).toHaveCount(0);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("C3 scenarios use only local relationships, protect missing wiring and retain conflicted drafts", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await target(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const dialog = page.getByRole("dialog", { name: "Edit scenario", exact: true });
  const panel = page.getByRole("complementary", { name: "Scenario steps", exact: true });
  try {
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("api");
    await expect(
      page.getByRole("region", { name: "components diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await diagramAction(page, "Add scenario");
    await dialog.getByLabel("Scenario name").fill("Resolve organization access");
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(
      dialog.getByLabel("Step 1 relationship").locator('option[value="connection:redirect-db"]'),
    ).toHaveCount(0);
    await dialog
      .getByLabel("Step 1 relationship")
      .selectOption("componentRelationship:organizations-accounts");
    await dialog
      .getByLabel("Step 1 text")
      .fill("Resolve the member's session before applying team access.");
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await dialog.getByLabel("Step 2 relationship").selectOption("connection:api-db");
    await dialog.getByLabel("Step 2 text").fill("Read the account and membership records.");
    await dialog.getByRole("button", { name: "Save scenario", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(2);
    await expect(
      page.locator('[data-relation-id="declared:organizations-accounts"] .scenario-numbers'),
    ).toHaveText("1");
    await capture(page, "components-light");
    const saved = await read();
    const missing = structuredClone(saved.architecture!);
    missing.componentRelationships = missing.componentRelationships!.filter(
      (relationship) => relationship.id !== "organizations-accounts",
    );
    const rejected = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: saved.revision,
        ops: [{ op: "setArchitecture", architecture: missing }],
      },
    });
    expect(rejected.status()).toBe(422);
    expect(await read()).toEqual(saved);
    await page.getByLabel("Component container").selectOption("worker");
    await expect(panel).not.toBeVisible();
    await page.getByLabel("Component container").selectOption("api");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByLabel("Scenario name").fill("Keep my conflicted draft");
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: saved.revision,
            ops: [
              {
                op: "setArchitecture",
                architecture: {
                  ...saved.architecture,
                  system: { ...saved.architecture!.system, description: "Changed elsewhere" },
                },
              },
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    const conflict = browserProblems.expectHttp({
      scenario: "scenario draft revision conflict",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save scenario", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    conflict.finish();
    await expect(dialog.getByLabel("Scenario name")).toHaveValue("Keep my conflicted draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("api");
    await expect(
      page.getByRole("region", { name: "components diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await diagramAction(page, "Resolve organization access");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await capture(page, "components-dark");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { designSchema } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });
const fixture = (name: string) =>
  designSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../../fixtures/designs/${name}.json`, import.meta.url), "utf8"),
    ),
  );
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function leaveEditor(page: Page) {
  if (page.isClosed()) return;
  const modal = page.getByRole("dialog");
  if (await modal.count())
    await modal
      .getByRole("button", { name: /^Close / })
      .first()
      .click();
  await page.getByRole("tab", { name: "Runs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Plan a run", exact: true })).toBeVisible();
  // Draw unmount flushes layout. Finish that request before deleting its active project.
  await page.waitForLoadState("networkidle");
}
async function create(page: Page, name: string) {
  await page.getByRole("button", { name: /^Project:/ }).click();
  await page.getByRole("menuitem", { name: "Create target from this design", exact: true }).click();
  await dialog(page, "Create target from this design").getByLabel("Target name").fill(name);
}

test("P52 copies a legacy topology by mouse, compares target changes and source drift, reloads and retains a deleted source baseline", async ({
  page,
  request,
}) => {
  const source = await openNewProject(page, request, "P52 legacy source");
  let target: string | undefined;
  const read = async (id: string) =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture("link-shortener");
    expect(
      (
        await request.post(`/api/projects/${source}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await create(page, "P52 legacy target");
    await accessible(page);
    await page.screenshot({ path: "test-results/p52-create-light.png", animations: "disabled" });
    await dialog(page, "Create target from this design")
      .getByRole("button", { name: "Create target", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Project: P52 legacy target", exact: true }),
    ).toBeVisible();
    target = new URL(page.url()).searchParams.get("project")!;
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Current baseline", exact: true }).click();
    const compare = dialog(page, "Current and target design");
    await expect(compare).toContainText("Source still matches");
    await expect(compare).toContainText("Saved topology · 3 containers");
    await accessible(page);
    await page.screenshot({ path: "test-results/p52-baseline-light.png", animations: "disabled" });
    await compare.getByRole("button", { name: "Edit proposed target" }).click();
    await inspectObject(page, "container:links");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Proposed management API");
    await page.getByRole("button", { name: "Changes", exact: true }).click();
    await expect
      .poll(async () => (await read(target!)).elements[0].name)
      .toBe("Proposed management API");
    await expect(compare).toContainText("changed · elements/links");
    await compare.getByRole("button", { name: "Edit proposed target" }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read(target!)).elements[0].name).toBe("Links service");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read(target!)).elements[0].name)
      .toBe("Proposed management API");
    await page.reload();
    await page.getByRole("button", { name: "Changes", exact: true }).click();
    expect(
      (
        await request.post(`/api/projects/${source}/operations`, {
          data: {
            baseRevision: 1,
            ops: [{ op: "updateElement", id: "links", name: "Source management API" }],
          },
        })
      ).status(),
    ).toBe(200);
    await compare.getByRole("button", { name: "Check source drift" }).click();
    await expect(compare).toContainText("Source drift: 1 semantic changes");
    await accessible(page);
    await page.screenshot({ path: "test-results/p52-changes-light.png", animations: "disabled" });
    await compare.getByRole("button", { name: "Edit proposed target" }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Changes", exact: true }).click();
    await accessible(page);
    await page.screenshot({ path: "test-results/p52-changes-dark.png", animations: "disabled" });
    await request.delete(`/api/projects/${source}`);
    await compare.getByRole("button", { name: "Check source drift" }).click();
    await expect(compare).toContainText("Source deleted. The frozen baseline is retained.");
    await compare.getByRole("tab", { name: "Current baseline", exact: true }).click();
    await expect(compare).toContainText("Links service");
  } finally {
    await leaveEditor(page);
    if (target) await request.delete(`/api/projects/${target}`);
    await request.delete(`/api/projects/${source}`);
  }
});

test("P52 previews editable sourced responsibility annotations in a planning copy with mouse undo/reload", async ({
  page,
  request,
}) => {
  const source = await openNewProject(page, request, "P52 annotation source");
  let target: string | undefined;
  try {
    const base = fixture("generated-workspace");
    expect(
      (
        await request.post(`/api/projects/${source}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await create(page, "P52 annotation target");
    await dialog(page, "Create target from this design")
      .getByRole("button", { name: "Create target", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Project: P52 annotation target", exact: true }),
    ).toBeVisible();
    target = new URL(page.url()).searchParams.get("project")!;
    await editorAction(page, "Suggest responsibility annotations");
    const draft = dialog(page, "Suggest responsibility annotations");
    await draft.getByLabel("Suggested actor name").fill("Inventory owner");
    await draft.getByLabel("Responsibility name").first().fill("Identity and access");
    await expect(draft).toContainText("inventory/inventory-api/accounts");
    await accessible(page);
    await page.screenshot({
      path: "test-results/p52-annotations-light.png",
      animations: "disabled",
    });
    await draft.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await editorAction(page, "Suggest responsibility annotations");
    await draft.getByLabel("Suggested actor name").fill("Inventory owner");
    await draft.getByLabel("Responsibility name").first().fill("Identity and access");
    await accessible(page);
    await page.screenshot({
      path: "test-results/p52-annotations-dark.png",
      animations: "disabled",
    });
    await draft.getByRole("button", { name: "Save annotations", exact: true }).click();
    await expect(draft).toHaveCount(0);
    const read = async () =>
      (await (await request.get(`/api/projects/${target}/design`)).json()).design;
    expect((await read()).architecture.components[0]).toMatchObject({
      name: "Identity and access",
      annotationOrigin: { revision: 0 },
    });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture).toBeUndefined();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.nodes[0]?.name)
      .toBe("Inventory owner");
    await page.reload();
    await page.getByRole("button", { name: "Changes", exact: true }).click();
    await expect(dialog(page, "Current and target design")).toContainText(
      "architecture/components/suggested-inventory-accounts",
    );
    expect(
      (await (await request.get(`/api/projects/${source}/design`)).json()).design.architecture,
    ).toBeUndefined();
  } finally {
    await leaveEditor(page);
    if (target) await request.delete(`/api/projects/${target}`);
    await request.delete(`/api/projects/${source}`);
  }
});

test("P52 requires an explicit recipe replacement choice and retains a stale creation draft", async ({
  page,
  request,
  browserProblems,
}) => {
  const made = await request.post("/api/projects/from-recipe", {
    data: { name: "P52 recipe source", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  expect(made.status()).toBe(201);
  const source = (await made.json()).project.id;
  let target: string | undefined;
  try {
    await page.goto(`/?project=${source}#/draw`);
    await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
    await create(page, "P52 recipe target");
    const creation = dialog(page, "Create target from this design");
    await creation.getByLabel("Recipe handling").selectOption("conceptual-replacement");
    await expect(
      creation.getByRole("button", { name: "Create target", exact: true }),
    ).toBeDisabled();
    await creation
      .getByLabel("Replacement reason")
      .fill("Explore an independently scalable redirect boundary.");
    await accessible(page);
    await page.screenshot({
      path: "test-results/p52-replacement-light.png",
      animations: "disabled",
    });
    expect(
      (
        await request.post(`/api/projects/${source}/operations`, {
          data: {
            baseRevision: 0,
            ops: [{ op: "setNotes", id: "qrwty", notes: "Concurrent source note" }],
          },
        })
      ).status(),
    ).toBe(200);
    const expected = browserProblems.expectHttp({
      scenario: "P52 target creation revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${source}/targets`, page.url()).href,
      status: 409,
    });
    await creation.getByRole("button", { name: "Create target", exact: true }).click();
    await expect(creation).toContainText("The design changed");
    await expect(creation.getByLabel("Replacement reason")).toHaveValue(
      "Explore an independently scalable redirect boundary.",
    );
    expected.finish();
    await creation.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await create(page, "P52 recipe target");
    await creation.getByLabel("Recipe handling").selectOption("conceptual-replacement");
    await creation
      .getByLabel("Replacement reason")
      .fill("Explore an independently scalable redirect boundary.");
    await creation.getByRole("button", { name: "Create target", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Project: P52 recipe target", exact: true }),
    ).toBeVisible();
    target = new URL(page.url()).searchParams.get("project")!;
    await page.getByRole("button", { name: "Current baseline", exact: true }).click();
    await expect(dialog(page, "Current and target design")).toContainText(
      "Original recipe retained in the baseline.",
    );
  } finally {
    await leaveEditor(page);
    if (target) await request.delete(`/api/projects/${target}`);
    await request.delete(`/api/projects/${source}`);
  }
});

import AxeBuilder from "@axe-core/playwright";
import { builtinRegistry } from "@jeeves/registry";
import {
  type ArchitectureLibraryEntry,
  applyOperations,
  type DesignDocument,
  designSchema,
  previewArchitecturePattern,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

const dialog = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title, exact: true });
async function openLibrary(page: Page) {
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Saved architecture templates", exact: true }).click();
  await expect(dialog(page, "Saved architecture templates")).toBeVisible();
}
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
function source() {
  let design = designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "Source API", template: null, planned: "application-api" },
      { id: "worker", name: "Source worker", template: null, planned: "background-worker" },
      { id: "store", name: "Source store", template: null, planned: "relational-store" },
    ],
  });
  for (const [pattern, prefix, variant] of [
    ["tenant-workspace-access", "tenant", "standard"],
    ["asynchronous-work-delivery", "delivery", "transactional-outbox"],
  ]) {
    const preview = previewArchitecturePattern(
      design,
      {
        pattern: pattern!,
        version: "1.0.0",
        instanceId: prefix!,
        variant: variant as "standard",
        baseRevision: design.revision,
        config: { name: prefix! },
        roles: {
          api: { mode: "reuse", id: "api" },
          store: { mode: "reuse", id: "store" },
          ...(prefix === "delivery" ? { worker: { mode: "reuse" as const, id: "worker" } } : {}),
        },
      },
      builtinRegistry(),
    );
    const result = applyOperations(design, preview.ops, builtinRegistry(), {
      baseRevision: design.revision,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    design = result.design;
  }
  return design;
}

test("P55 saves, publishes, reuses and retires local architecture versions with independent instances and mouse history", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const sourceId = await openNewProject(page, request, "P55 source library");
  const ids = [sourceId];
  const read = async (id: string): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const seed = source();
    const seeded = await request.post(`/api/projects/${sourceId}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...seed.elements.map((element) => ({ op: "addElement", element })),
          ...seed.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: seed.architecture },
        ],
      },
    });
    expect(seeded.status()).toBe(200);
    await page.reload();
    for (const [id, name, options] of [
      ["p55-access", "Tenant access copy", ["Component: tenant: Tenant access checks"]],
      ["p55-delivery", "Durable delivery copy", seed.elements.map((e) => `Container: ${e.name}`)],
    ] as const) {
      await openLibrary(page);
      await page
        .getByRole("button", { name: "Save as architecture template", exact: true })
        .click();
      const save = dialog(page, "Save as architecture template");
      await save.getByLabel("Library identity", { exact: true }).fill(id);
      await save.getByLabel("Template name", { exact: true }).fill(name);
      await save
        .getByLabel("Purpose", { exact: true })
        .fill("Reusable design intent with exact contracts and explicit dependencies");
      for (const option of options) {
        await save.getByLabel("Containers and components to copy", { exact: true }).click();
        await page.getByRole("option", { name: option, exact: true }).click();
      }
      await save
        .getByRole("heading", { name: "Save as architecture template", exact: true })
        .click();
      await save.getByRole("button", { name: "Save draft", exact: true }).click();
      const review = dialog(page, "Review architecture template");
      await expect(review).toContainText("Compatible hosts and required roles");
      await accessible(page);
      await page.screenshot({
        path: `test-results/p55-${id}-draft-light.png`,
        animations: "disabled",
      });
      await review.getByRole("button", { name: "Publish version", exact: true }).click();
      await expect(
        review.getByRole("button", { name: "Preview insertion", exact: true }),
      ).toBeVisible();
      await review
        .getByRole("button", { name: "Close review architecture template", exact: true })
        .click();
    }
    const targetId = await openNewProject(page, request, "P55 target reuse");
    ids.push(targetId);
    // A separate design supplies the required host and exact workspace-access interface.
    const tenant = source();
    const targetSeed = await request.post(`/api/projects/${targetId}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...tenant.elements.map((element) => ({ op: "addElement", element })),
          ...tenant.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: tenant.architecture },
        ],
      },
    });
    expect(targetSeed.status()).toBe(200);
    await page.reload();
    for (const name of ["Tenant access copy", "Durable delivery copy"]) {
      await openLibrary(page);
      await page
        .getByRole("button")
        .filter({ has: page.getByText(`${name} · v1.0.0`, { exact: true }) })
        .click();
      await page.getByRole("button", { name: "Preview insertion", exact: true }).click();
      const insertion = dialog(page, "Insert architecture template");
      await insertion.getByLabel("Composition name", { exact: true }).fill("");
      await expect(
        insertion.getByRole("button", { name: "Insert template", exact: true }),
      ).toBeDisabled();
      await insertion.getByLabel("Composition name", { exact: true }).fill(name);
      if (name === "Tenant access copy")
        await expect(
          insertion.getByLabel("tenant: Workspace membership", { exact: true }),
        ).toHaveValue("tenant-workspace");
      await accessible(page);
      await page.screenshot({
        path: `test-results/p55-${name.startsWith("Tenant") ? "access" : "delivery"}-preview-light.png`,
        animations: "disabled",
      });
      await expect(
        insertion.getByRole("button", { name: "Insert template", exact: true }),
      ).toBeEnabled();
      await insertion.getByRole("button", { name: "Insert template", exact: true }).click();
      await expect(insertion).not.toBeVisible();
    }
    const beforeUndo = await read(targetId);
    const pinned = beforeUndo.architecture!.patternInstances!.filter((p) => p.libraryContentHash);
    expect(pinned).toHaveLength(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read(targetId)).architecture!.patternInstances!.filter((p) => p.libraryContentHash)
            .length,
      )
      .toBe(1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read(targetId)).architecture!.patternInstances!.filter((p) => p.libraryContentHash)
            .length,
      )
      .toBe(2);
    await page.reload();
    expect((await read(targetId)).architecture).toEqual(beforeUndo.architecture);
    // Customize one instance without changing its source; publish v2 independently.
    const current = await read(targetId);
    const architecture = structuredClone(current.architecture!);
    architecture.components!.at(-1)!.responsibility = "Target-only customization";
    expect(
      (
        await request.post(`/api/projects/${targetId}/operations`, {
          data: { baseRevision: current.revision, ops: [{ op: "setArchitecture", architecture }] },
        })
      ).status(),
    ).toBe(200);
    await openLibrary(page);
    await page
      .getByRole("button")
      .filter({ has: page.getByText("Durable delivery copy · v1.0.0", { exact: true }) })
      .click();
    await page.getByRole("button", { name: "Create new draft version", exact: true }).click();
    await page.getByLabel("Template name", { exact: true }).fill("Durable delivery second edition");
    await page.getByRole("button", { name: "Publish version", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Preview insertion", exact: true }),
    ).toBeVisible();
    const entries: ArchitectureLibraryEntry[] = (
      await (await request.get("/api/architecture-library")).json()
    ).entries;
    expect(
      entries
        .find((e) => e.id === "p55-delivery" && e.version === "1.0.0")!
        .fragment.architecture.components!.some(
          (c) => c.responsibility === "Target-only customization",
        ),
    ).toBe(false);
    expect(
      (await read(targetId)).architecture!.patternInstances!.filter((p) => p.libraryContentHash),
    ).toEqual(pinned);
    await page
      .getByRole("button", { name: "Close review architecture template", exact: true })
      .click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openLibrary(page);
    await page
      .getByRole("button")
      .filter({ has: page.getByText("Durable delivery second edition · v2.0.0", { exact: true }) })
      .click();
    await accessible(page);
    await page.screenshot({
      path: "test-results/p55-published-v2-dark-narrow.png",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Retire version", exact: true }).click();
    await expect(page.getByRole("button", { name: "Preview insertion", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("dialog")).toContainText("retired");
  } finally {
    for (const id of ids) await request.delete(`/api/projects/${id}`);
  }
});

test("P55 retains an insertion draft without overwriting a concurrent design revision", async ({
  page,
  request,
}) => {
  const sourceId = await openNewProject(page, request, "P55 conflict source");
  const ids = [sourceId];
  try {
    const seed = source();
    expect(
      (
        await request.post(`/api/projects/${sourceId}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...seed.elements.map((element) => ({ op: "addElement", element })),
              ...seed.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: seed.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    const exported = await request.post("/api/architecture-library", {
      data: {
        id: "p55-conflict",
        version: "1.0.0",
        name: "Revision-bound delivery",
        purpose: "Keep concurrent design work",
        projectId: sourceId,
        baseRevision: 1,
        selection: { elements: seed.elements.map((e) => e.id) },
      },
    });
    expect(exported.status()).toBe(201);
    const entry = (await exported.json()).entry as ArchitectureLibraryEntry;
    expect(
      (
        await request.post(`/api/architecture-library/${entry.id}/${entry.version}/change`, {
          data: { action: "publish", draftRevision: entry.draftRevision },
        })
      ).status(),
    ).toBe(200);
    const targetId = await openNewProject(page, request, "P55 conflict target");
    ids.push(targetId);
    await openLibrary(page);
    await page
      .getByRole("button")
      .filter({ has: page.getByText("Revision-bound delivery · v1.0.0", { exact: true }) })
      .click();
    await page.getByRole("button", { name: "Preview insertion", exact: true }).click();
    const insertion = dialog(page, "Insert architecture template");
    expect(
      (
        await request.post(`/api/projects/${targetId}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              {
                op: "setArchitecture",
                architecture: {
                  system: { name: "Concurrent user design", description: "Retain this context" },
                  nodes: [],
                  relationships: [],
                },
              },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await insertion.getByRole("button", { name: "Insert template", exact: true }).click();
    await expect(
      insertion.getByRole("alert").filter({ hasText: "draft has been retained" }),
    ).toContainText("draft has been retained");
    await accessible(page);
    await page.screenshot({ path: "test-results/p55-conflict-light.png", animations: "disabled" });
    const current = (await (await request.get(`/api/projects/${targetId}/design`)).json())
      .design as DesignDocument;
    expect(current.revision).toBe(1);
    expect(current.elements).toEqual([]);
    expect(current.architecture!.system.name).toBe("Concurrent user design");
    await insertion.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    for (const id of ids) await request.delete(`/api/projects/${id}`);
  }
});

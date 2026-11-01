import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import {
  architectureExample,
  type DesignDocument,
  designSchema,
  scenarioReview,
} from "@jeeves/spec";
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

const journeyFixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-scenarios.json", import.meta.url),
        "utf8",
      ),
    ),
  );
async function p54Target(page: Page, request: APIRequestContext) {
  const response = await request.post("/api/projects", { data: { name: "P54 scenario journeys" } });
  const id: string = (await response.json()).project.id;
  const base = journeyFixture();
  const architecture = {
    ...base.architecture!,
    scenarios: base.architecture!.scenarios!.filter((s) => s.id !== "owner-journey"),
  };
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...base.elements.map((element) => ({ op: "addElement", element })),
            ...base.connections.map((connection) => ({ op: "connect", connection })),
            { op: "setArchitecture", architecture },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/?project=${id}#/draw`);
  await expect(page.getByRole("toolbar", { name: "Drawing tools", exact: true })).toBeVisible();
  return id;
}
async function p54Capture(page: Page, name: string, dialog = false) {
  expect(
    (
      await new AxeBuilder({ page })
        .include(dialog ? '[role="dialog"]' : ".integrated-editor")
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/p54-${name}.png`, animations: "disabled" });
}
async function p54Leave(page: Page) {
  if (await page.getByRole("dialog").count())
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("tab", { name: "Runs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Plan a run", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("P54 authors a client journey with alternatives, expectations, review freshness and mouse history", async ({
  page,
  request,
}) => {
  const id = await p54Target(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const panel = page.getByRole("complementary", { name: "Scenario steps", exact: true });
  const dialog = page.getByRole("dialog", { name: "Edit scenario", exact: true });
  try {
    const before = await read();
    await editorAction(page, "Redirect with cache and channel alternatives");
    await panel.getByLabel("Scenario path").selectOption("cache-miss");
    await expect(panel).toContainText("Read authoritative link state within 150 milliseconds.");
    await panel.getByText("Acceptance expectations", { exact: false }).click();
    await p54Capture(page, "cache-miss-light");
    await panel.getByLabel("Scenario path").selectOption("channel-failure");
    await expect(panel).toContainText("Analytics loss is bounded");
    await p54Capture(page, "queue-failure-light");
    await editorAction(page, "Billing duplicate delivery");
    await panel.getByLabel("Scenario path").selectOption("duplicate-delivery");
    await expect(panel).toContainText("without applying the entitlement change again");
    await p54Capture(page, "billing-duplicate-light");
    await editorAction(page, "Add scenario");
    await dialog.getByLabel("Scenario name").fill("Owner updates a link");
    await dialog.getByLabel("Scenario actor").selectOption("owner");
    await dialog.getByLabel("Start condition").fill("A signed-in owner edits a link in Library.");
    await dialog.getByText("Expected outcomes and invariants", { exact: false }).click();
    for (const [i, text, invariant] of [
      [1, "Owner sees a saved confirmation.", "Only the authorized tenant link changes."],
      [2, "Owner sees a permission denial.", "A denied command changes no link."],
    ] as const) {
      await dialog.getByRole("button", { name: "Add expected outcome", exact: true }).click();
      await dialog.getByLabel(`Outcome ${i} expectation`).fill(text);
      await dialog.getByLabel(`Outcome ${i} invariants`).fill(invariant);
    }
    await dialog.getByLabel("Outcome 1 requirements").click();
    await page.getByRole("option", { name: "Tenant management access", exact: true }).click();
    await dialog.getByLabel("Scenario name").click();
    await dialog.getByLabel("Path expected outcomes").click();
    await page
      .getByRole("option", { name: "1. Owner sees a saved confirmation.", exact: true })
      .click();
    await dialog.getByLabel("Scenario name").click();
    const addStep = async (index: number, relationship: string, text: string, state?: string) => {
      await dialog.getByRole("button", { name: "Add step", exact: true }).click();
      await dialog
        .getByLabel(`Step ${index} relationship`, { exact: true })
        .selectOption(relationship);
      await dialog.getByLabel(`Step ${index} text`).fill(text);
      if (state) {
        const field = dialog
          .locator(".scenario-step-editor")
          .filter({ has: page.getByLabel(`Step ${index} text`) });
        await field.getByText("Operation and client state", { exact: true }).click();
        await dialog
          .getByLabel(`Step ${index} binding`, { exact: true })
          .selectOption("owner-update-binding");
        await dialog
          .getByLabel(`Step ${index} phase`, { exact: true })
          .selectOption(state === "loading" ? "request" : "response");
        await dialog
          .getByLabel(`Step ${index} client feature`, { exact: true })
          .selectOption("library-feature");
        await dialog.getByLabel(`Step ${index} visible state`, { exact: true }).selectOption(state);
      }
    };
    await addStep(1, "contextRelationship:owner-entry", "Owner submits a destination change.");
    await addStep(2, "connection:web-management", "Library shows the pending request.", "loading");
    await addStep(
      3,
      "connection:web-management",
      "Library confirms the saved destination.",
      "success",
    );
    await dialog.getByRole("button", { name: "Move step 3 up", exact: true }).click();
    await expect(dialog.getByLabel("Step 2 text")).toHaveValue(
      "Library confirms the saved destination.",
    );
    await dialog.getByRole("button", { name: "Move step 2 down", exact: true }).click();
    await dialog.getByRole("button", { name: "Add alternative path", exact: true }).click();
    await dialog.getByLabel("Path name").fill("Permission denied");
    await dialog.getByLabel("Path kind").selectOption("failure");
    await dialog
      .getByLabel("Path condition")
      .fill("The actor has no permission for the tenant link.");
    const branch = await dialog
      .getByLabel("Branches after main step")
      .locator("option")
      .nth(1)
      .getAttribute("value");
    await dialog.getByLabel("Branches after main step").selectOption(branch!);
    await dialog.getByLabel("Path expected outcomes").click();
    await page
      .getByRole("option", { name: "2. Owner sees a permission denial.", exact: true })
      .click();
    await dialog.getByLabel("Path name").click();
    await addStep(
      1,
      "connection:web-management",
      "Library shows permission denied and preserves the edit.",
      "denied",
    );
    await addStep(2, "connection:web-management", "Temporary step");
    await dialog.getByRole("button", { name: "Move step 2 up", exact: true }).click();
    await dialog.getByRole("button", { name: "Remove step 1", exact: true }).click();
    await dialog.getByRole("button", { name: "Record expectation review", exact: true }).click();
    await expect(dialog).toContainText("Expectation review: Reviewed");
    await dialog.getByRole("button", { name: "Save scenario", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const saved = await read();
    const owner = saved.architecture!.scenarios!.find((s) => s.name === "Owner updates a link")!;
    expect(owner.alternatives![0]!.steps).toHaveLength(1);
    expect(owner.alternatives![0]!.steps[0]!.client?.state).toBe("denied");
    expect(scenarioReview(saved, owner).status).toBe("Reviewed");
    expect(saved.connections).toEqual(before.connections);
    expect(saved.revision).toBe(before.revision + 1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(before.architecture?.scenarios);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.scenarios)
      .toEqual(saved.architecture?.scenarios);
    await page.reload();
    await editorAction(page, "Owner updates a link");
    await panel.getByText("Acceptance expectations", { exact: false }).click();
    await p54Capture(page, "owner-success-light");
    const current = await read();
    const changed = structuredClone(current.architecture!);
    const nextContract = structuredClone(changed.contracts!.find((c) => c.id === "update-link")!);
    nextContract.version = "v2";
    nextContract.shape!.operations[0]!.description = "Changed operation expectation";
    changed.contracts!.push(nextContract);
    for (const i of changed.interfaces!)
      if (i.contract.id === "update-link") i.contract.version = "v2";
    changed.bindings!.find((b) => b.id === "owner-update-binding")!.contract.version = "v2";
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "setArchitecture", architecture: changed }],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await editorAction(page, "Owner updates a link");
    await expect(panel).toContainText("Acceptance expectations · Stale");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await panel.getByLabel("Scenario path").selectOption(owner.alternatives![0]!.id);
    await panel.getByText("Acceptance expectations", { exact: false }).click();
    await p54Capture(page, "owner-denial-dark");
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByLabel("Editing path").selectOption(owner.alternatives![0]!.id);
    await p54Capture(page, "editor-dark", true);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("web");
    await expect(
      page.getByRole("region", { name: "components diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Inspect Library feature", exact: true }).click();
    await page.getByText("Client journey expectations", { exact: true }).click();
    await expect(page.locator(".component-details")).toContainText("success");
    await expect(page.locator(".component-details")).toContainText("denied");
    await p54Capture(page, "client-inspector-dark");
  } finally {
    await p54Leave(page);
    await request.delete(`/api/projects/${id}`);
  }
});

test("P54 retains invalid and conflicted alternative drafts without replacing saved scenario inputs", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await p54Target(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const panel = page.getByRole("complementary", { name: "Scenario steps", exact: true });
  const dialog = page.getByRole("dialog", { name: "Edit scenario", exact: true });
  try {
    await editorAction(page, "Redirect with cache and channel alternatives");
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByRole("button", { name: "Remove step 2", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save scenario", exact: true })).toBeDisabled();
    await expect(dialog).toContainText("branch after an existing main-path step");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const before = await read();
    await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
    await dialog.getByLabel("Editing path").selectOption("channel-failure");
    await dialog.getByLabel("Path condition").fill("Keep this locally edited failure condition.");
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: before.revision,
            ops: [{ op: "setNotes", id: "redirect", notes: "Concurrent notes" }],
          },
        })
      ).ok(),
    ).toBe(true);
    const conflict = browserProblems.expectHttp({
      scenario: "P54 rich scenario draft revision conflict",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save scenario", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    conflict.finish();
    await expect(dialog.getByLabel("Path condition")).toHaveValue(
      "Keep this locally edited failure condition.",
    );
    expect((await read()).architecture?.scenarios).toEqual(before.architecture?.scenarios);
    await p54Capture(page, "conflict-light", true);
  } finally {
    await p54Leave(page);
    await request.delete(`/api/projects/${id}`);
  }
});

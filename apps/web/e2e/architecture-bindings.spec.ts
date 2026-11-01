import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { DesignDocument } from "@jeeves/spec";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Relationship contracts and policies", exact: true });
const dataDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Data responsibilities and objectives", exact: true });
async function seed(page: Page, request: APIRequestContext, removeCache = false) {
  const design = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/relationship-policies.json", import.meta.url),
      "utf8",
    ),
  ) as DesignDocument;
  if (removeCache)
    design.architecture!.bindings = design.architecture!.bindings!.filter(
      (item) => item.relationship.id !== "lookup-cache",
    );
  const id = await openNewProject(page, request, "P48 relationship policies");
  const saved = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      ops: [
        ...design.elements.map((element) => ({ op: "addElement", element })),
        ...design.connections.map((connection) => ({ op: "connect", connection })),
        { op: "setArchitecture", architecture: design.architecture },
      ],
    },
  });
  expect(await saved.json()).toHaveProperty("design");
  expect(saved.status()).toBe(200);
  await page.reload();
  return id;
}
async function openConnection(page: Page, id: string) {
  await inspectObject(page, `connection:${id}`);
  await page.getByRole("button", { name: "Manage relationship contracts", exact: true }).click();
}
async function save(page: Page) {
  await dialog(page)
    .getByRole("button", { name: "Save contracts and policies", exact: true })
    .click();
  await expect(dialog(page)).not.toBeVisible();
}
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("P48 mouse binds cache-aside contracts with scoped policies, C3 traceability, history and reload", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await seed(page, request, true);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const before = await read();
    await openConnection(page, "lookup-cache");
    const modal = dialog(page);
    await modal.getByRole("button", { name: "Add binding", exact: true }).click();
    await modal.getByLabel("Binding name", { exact: true }).fill("Cached destination lookup");
    await modal.getByLabel("Provided interface", { exact: true }).selectOption("cache-data");
    await modal.getByLabel("Required interface", { exact: true }).selectOption("lookup-cache-use");
    await modal.getByLabel("Interaction role", { exact: true }).selectOption("read");
    await modal.getByLabel("Declared transport", { exact: true }).fill("Redis protocol");
    await modal.getByLabel("Business synchrony", { exact: true }).selectOption("Synchronous");
    await modal.getByLabel("Binding name", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p48-binding-light.png", animations: "disabled" });
    await modal
      .getByRole("button", { name: "Add identity and tenant scope policy", exact: true })
      .click();
    await modal.getByLabel("Caller identity", { exact: true }).selectOption("Service");
    await modal.getByLabel("Tenant scope", { exact: true }).selectOption("Tenant scoped");
    await modal.getByLabel("Network reachability", { exact: true }).selectOption("Private");
    await modal
      .getByRole("button", { name: "Add timeout and failure policy", exact: true })
      .click();
    await modal.getByLabel("Timeout (milliseconds)", { exact: true }).fill("25");
    await modal.getByLabel("Failure outcome", { exact: true }).selectOption("Source fallback");
    await modal
      .getByLabel("Failure boundary and outcome detail", { exact: true })
      .fill(
        "Redirect lookup falls back to authoritative records; analytics is outside the response boundary.",
      );
    await modal
      .getByRole("button", { name: "Add freshness and invalidation policy", exact: true })
      .click();
    await modal.getByLabel("Maximum stale age (seconds)", { exact: true }).fill("30");
    await modal.getByLabel("Invalidation", { exact: true }).selectOption("On write");
    await modal
      .getByLabel("Invalidation responsibility and boundary", { exact: true })
      .fill("Link management invalidates changed and disabled destinations.");
    await modal
      .getByRole("region", { name: "Freshness and invalidation", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p48-cache-light.png", animations: "disabled" });
    await accessible(page);
    await save(page);
    const saved = await read();
    expect(saved.revision).toBe(before.revision + 1);
    expect(saved.connections).toEqual(before.connections);
    expect(saved.architecture!.bindings!.at(-1)!.policies!.failure!.outcome).toBe(
      "Source fallback",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.bindings!.length).toBe(7);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.bindings!.length).toBe(8);
    await page.reload();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("redirect");
    await inspectObject(page, "use:lookup:lookup-cache");
    await page.getByRole("button", { name: "Manage relationship contracts", exact: true }).click();
    await expect(modal).toContainText("C2 connection: lookup-cache");
    await expect(modal.getByLabel("Binding name", { exact: true })).toHaveValue(
      "Cached destination lookup",
    );
    await modal.getByLabel("Binding name", { exact: true }).fill("Discarded name");
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await read()).architecture!.bindings!.at(-1)!.name).toBe("Cached destination lookup");
    await page.getByLabel("Component container").selectOption("management");
    await inspectObject(page, "declared:check-entitlement");
    await page.getByRole("button", { name: "Manage relationship contracts", exact: true }).click();
    await expect(modal).toContainText("Local C3 relationship: check-entitlement");
    await modal.getByLabel("Binding name", { exact: true }).fill("Entitlement before update");
    await save(page);
    expect(
      (await read()).architecture!.bindings!.find(
        (item) => item.id === "check-entitlement-binding",
      )!.name,
    ).toBe("Entitlement before update");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P48 signed callback and bounded-loss visit policies stay independent, with retained conflicts and exact-version findings", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(90_000);
  const id = await seed(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await openConnection(page, "payment-callback");
    const modal = dialog(page);
    await expect(modal.getByLabel("Business synchrony", { exact: true })).toHaveValue(
      "Asynchronous",
    );
    await expect(modal.getByLabel("Declared transport", { exact: true })).toHaveValue("HTTPS");
    await expect(modal.getByLabel("Caller identity", { exact: true })).toHaveValue(
      "Signed callback",
    );
    await expect(modal.getByLabel("Acknowledgement", { exact: true })).toHaveValue("Persisted");
    await modal
      .getByRole("region", { name: "Identity and tenant scope", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/p48-callback-identity-light.png",
      animations: "disabled",
    });
    await modal.getByLabel("Maximum attempts (including first)", { exact: true }).fill("5");
    await modal
      .getByRole("region", { name: "Retry and idempotency", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p48-callback-light.png", animations: "disabled" });
    await save(page);
    await openConnection(page, "publish-visits");
    await expect(modal.getByLabel("Maximum loss window (seconds)", { exact: true })).toHaveValue(
      "60",
    );
    await modal.getByLabel("Maximum loss window (seconds)", { exact: true }).fill("45");
    await save(page);
    await openConnection(page, "lookup-cache");
    await modal.getByLabel("Caller identity", { exact: true }).selectOption("Public");
    await expect(
      modal.getByRole("region", { name: "Relationship design review", exact: true }),
    ).toContainText("public identity cannot establish it");
    await save(page);
    await openConnection(page, "lookup-cache");
    const current = await read();
    const architecture = structuredClone(current.architecture!);
    architecture.contracts!.push({ ...architecture.contracts![0]!, version: "v2" });
    architecture.interfaces!.find((item) => item.id === "lookup-cache-use")!.contract.version =
      "v2";
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: { baseRevision: current.revision, ops: [{ op: "setArchitecture", architecture }] },
        })
      ).status(),
    ).toBe(200);
    await modal.getByLabel("Binding name", { exact: true }).fill("Retained lookup draft");
    const conflict = browserProblems.expectHttp({
      scenario: "P48 binding draft revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await modal.getByRole("button", { name: "Save contracts and policies", exact: true }).click();
    await expect(modal.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
    conflict.finish();
    await expect(modal.getByLabel("Binding name", { exact: true })).toHaveValue(
      "Retained lookup draft",
    );
    const concurrent = await read();
    await modal.getByRole("button", { name: "Save contracts and policies", exact: true }).click();
    await expect(modal).toContainText("Your draft has been retained");
    expect(await read()).toEqual(concurrent);
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await openConnection(page, "lookup-cache");
    await expect(modal).toContainText("Exact versions must agree");
    await modal
      .getByRole("region", { name: "Relationship design review", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p48-review-light.png", animations: "disabled" });
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openConnection(page, "publish-visits");
    await modal
      .getByRole("region", { name: "Event delivery", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(modal.getByLabel("Maximum loss window (seconds)", { exact: true })).toHaveValue(
      "45",
    );
    await accessible(page);
    await page.screenshot({ path: "test-results/p48-visits-dark.png", animations: "disabled" });
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P48 mouse edits dataset authority and scoped objectives with Save/Cancel, history and narrow inspection", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await seed(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await editorAction(page, "Data responsibilities and objectives");
    const modal = dataDialog(page);
    await expect(modal.getByLabel("Authoritative store", { exact: true })).toHaveValue("records");
    await modal.getByLabel("Retention (days)", { exact: true }).fill("90");
    await modal.getByLabel("Dataset name", { exact: true }).fill("Link destination authority");
    await modal.getByLabel("Authoritative owners", { exact: true }).click();
    await page
      .getByRole("listbox", { name: "Authoritative owners", exact: true })
      .getByRole("option", { name: "Billing policy · component", exact: true })
      .click();
    await modal.getByLabel("Shared ownership decision", { exact: true }).click();
    await expect(
      modal.getByRole("button", { name: "Save data and objectives", exact: true }),
    ).toBeDisabled();
    await modal
      .getByLabel("Shared ownership decision", { exact: true })
      .fill(
        "Link management owns destinations; billing policy owns entitlement state; all destination writes go through Link management.",
      );
    await page.screenshot({ path: "test-results/p48-data-light.png", animations: "disabled" });
    await modal.getByLabel("Objective", { exact: true }).selectOption("analytics-lag");
    await modal.getByLabel("Target value", { exact: true }).fill("45");
    await modal
      .getByLabel("Measurement window", { exact: true })
      .fill("10 minutes at declared peak workload");
    await accessible(page);
    const before = await read();
    await modal.getByRole("button", { name: "Save data and objectives", exact: true }).click();
    await expect(modal).not.toBeVisible();
    expect((await read()).revision).toBe(before.revision + 1);
    expect((await read()).architecture!.datasets![0]!.owners).toHaveLength(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture!.datasets![0]!.retentionDays)
      .toBe(365);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture!.datasets![0]!.retentionDays)
      .toBe(90);
    await page.reload();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await editorAction(page, "Data responsibilities and objectives");
    await modal.getByLabel("Objective", { exact: true }).selectOption("analytics-lag");
    await expect(modal.getByLabel("Target value", { exact: true })).toHaveValue("45");
    await modal.getByLabel("Measurement window", { exact: true }).scrollIntoViewIfNeeded();
    await accessible(page);
    await page.screenshot({ path: "test-results/p48-objectives-dark.png", animations: "disabled" });
    await modal.getByLabel("Objective name", { exact: true }).fill("Discard objective rename");
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await read()).architecture!.objectives!.find((item) => item.id === "analytics-lag")!.name,
    ).toBe("Visit analytics lag");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

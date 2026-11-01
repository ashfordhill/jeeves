import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  designSchema,
  type PatternRequestInput,
  previewArchitecturePattern,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });
const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/pattern-composition.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Compose architecture pattern", exact: true });
async function openPattern(page: Page, name: string) {
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Patterns", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await expect(modal(page)).toBeVisible();
}
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("P50 composes four patterns, keeps visit and billing channels distinct, and preserves mouse history and reload", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "P50 pattern composition");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              { op: "setArchitecture", architecture: base.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    for (const [name, title] of [
      ["Tenant workspace and access", "Personal workspace"],
      ["Billing and entitlements", "Billing policy"],
      ["Cached public lookup", "Public redirect"],
      ["Asynchronous work delivery", "Visit analytics"],
    ]) {
      const before = await read();
      await openPattern(page, name!);
      const dialog = modal(page);
      await dialog.getByLabel("Composition name", { exact: true }).fill(title!);
      await dialog.getByLabel("Application API", { exact: true }).selectOption("api");
      await expect(dialog.getByLabel("Authoritative store", { exact: true })).toHaveValue("store");
      if (name === "Asynchronous work delivery") {
        await dialog.getByLabel("Delivery host", { exact: true }).selectOption("worker");
        await dialog.getByLabel("Logical channel name", { exact: true }).fill("Visit events");
      }
      if (name === "Cached public lookup")
        await dialog.getByLabel("Maximum stale age (seconds)", { exact: true }).fill("15");
      await expect(
        dialog.getByRole("button", { name: "Apply pattern", exact: true }),
      ).toBeEnabled();
      if (name === "Tenant workspace and access" || name === "Cached public lookup") {
        await accessible(page);
        await page.screenshot({
          path: `test-results/p50-${name === "Cached public lookup" ? "cache" : "tenant"}-light.png`,
          animations: "disabled",
        });
      }
      await dialog.getByRole("button", { name: "Apply pattern", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      const after = await read();
      expect(after.revision).toBe(before.revision + 1);
      const instance = after.architecture!.patternInstances!.at(-1)!;
      const req: PatternRequestInput = {
        pattern: instance.pattern,
        version: "1.0.0",
        variant: instance.variant,
        instanceId: instance.id,
        baseRevision: before.revision,
        config: instance.config,
        roles: {
          api: { mode: "reuse", id: "api" },
          store: { mode: "reuse", id: "store" },
          ...(instance.pattern === "asynchronous-work-delivery"
            ? { worker: { mode: "reuse" as const, id: "worker" } }
            : {}),
        },
      };
      const expected = applyOperations(
        before,
        previewArchitecturePattern(before, req, builtinRegistry()).ops,
        builtinRegistry(),
      );
      expect(expected.ok).toBe(true);
      if (expected.ok) expect(after).toEqual(expected.design);
    }
    const beforeOutbox = await read();
    await openPattern(page, "Asynchronous work delivery");
    const dialog = modal(page);
    await dialog
      .getByLabel("Delivery variant", { exact: true })
      .selectOption("transactional-outbox");
    await dialog.getByLabel("Composition name", { exact: true }).fill("Billing delivery");
    await dialog.getByLabel("Logical channel name", { exact: true }).fill("Billing jobs");
    await dialog.getByLabel("Application API", { exact: true }).selectOption("api");
    await dialog.getByLabel("Delivery host", { exact: true }).selectOption("worker");
    await expect(dialog.getByLabel("Billing jobs", { exact: true }).locator("option")).toHaveCount(
      2,
    );
    await dialog
      .getByRole("region", { name: "Required pattern guarantees", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(dialog).toContainText("one atomic transaction");
    await accessible(page);
    await page.screenshot({ path: "test-results/p50-outbox-light.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Apply pattern", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const saved = await read();
    expect(saved.elements.filter((e) => e.planned === "job-queue").map((e) => e.name)).toEqual([
      "Visit analytics: Visit events",
      "Billing delivery: Billing jobs",
    ]);
    expect(saved.elements.slice(0, 3)).toEqual(beforeOutbox.elements.slice(0, 3));
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.patternInstances!.length).toBe(4);
    expect((await read()).architecture).toEqual(beforeOutbox.architecture);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.patternInstances!.length).toBe(5);
    await page.reload();
    expect((await read()).architecture).toEqual(saved.architecture);
    await openPattern(page, "Tenant workspace and access");
    const tenantInstance = saved.architecture!.patternInstances![0]!;
    await dialog.getByLabel("Application API", { exact: true }).selectOption("api");
    await dialog
      .getByLabel("Workspace membership", { exact: true })
      .selectOption(tenantInstance.identities.workspace!);
    await dialog
      .getByLabel("Tenant access checks", { exact: true })
      .selectOption(tenantInstance.identities.access!);
    await dialog
      .getByRole("region", { name: "Pattern role bindings", exact: true })
      .scrollIntoViewIfNeeded();
    await accessible(page);
    await page.screenshot({ path: "test-results/p50-reuse-light.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Apply pattern", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await read()).architecture!.components!.length).toBe(
      saved.architecture!.components!.length,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.patternInstances!.length).toBe(5);
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("worker");
    await expect(
      page.getByRole("region", { name: "components diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page.screenshot({
      path: "test-results/p50-delivery-c3-light.png",
      animations: "disabled",
    });
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P50 exposes ambiguous roles, cancels without changes and retains a revision-conflict draft in narrow dark", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "P50 conflict draft");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture();
    base.elements.push({ ...base.elements[2]!, id: "other-store", name: "Other store" });
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              { op: "setArchitecture", architecture: base.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    const before = await read();
    await openPattern(page, "Tenant workspace and access");
    const dialog = modal(page);
    await expect(dialog).toContainText("Unfilled required roles");
    await expect(dialog.getByRole("button", { name: "Apply pattern", exact: true })).toBeDisabled();
    await dialog.getByLabel("Authoritative store", { exact: true }).selectOption("other-store");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(before);
    await page.getByRole("button", { name: "Close architecture library", exact: true }).click();
    await openPattern(page, "Cached public lookup");
    await dialog.getByLabel("Composition name", { exact: true }).fill("Retained lookup draft");
    await dialog.getByLabel("Application API", { exact: true }).selectOption("api");
    await dialog.getByLabel("Authoritative store", { exact: true }).selectOption("store");
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: before.revision,
            ops: [{ op: "setNotes", id: "api", notes: "Concurrent custom brief" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "P50 pattern revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await dialog.getByRole("button", { name: "Apply pattern", exact: true }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
    conflict.finish();
    const concurrent = await read();
    await dialog.getByRole("button", { name: "Apply pattern", exact: true }).click();
    await expect(dialog).toContainText("Your draft has been retained");
    expect(await read()).toEqual(concurrent);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Close architecture library", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openPattern(page, "Asynchronous work delivery");
    await dialog
      .getByLabel("Delivery variant", { exact: true })
      .selectOption("transactional-outbox");
    await dialog.getByLabel("Application API", { exact: true }).selectOption("api");
    await dialog.getByLabel("Authoritative store", { exact: true }).selectOption("store");
    await dialog.getByLabel("Delivery host", { exact: true }).selectOption("worker");
    await dialog
      .getByRole("region", { name: "Pattern role bindings", exact: true })
      .scrollIntoViewIfNeeded();
    await accessible(page);
    await page.screenshot({ path: "test-results/p50-roles-dark.png", animations: "disabled" });
    await dialog
      .getByRole("region", { name: "Required pattern guarantees", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p50-outbox-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(concurrent);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

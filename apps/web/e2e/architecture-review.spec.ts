import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type DesignDocument, designSchema, reviewArchitecture } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });
const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Architecture review and decisions", exact: true });
async function openReview(page: Page) {
  await page.getByRole("button", { name: "Editor actions", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Architecture review/ }).click();
  await expect(modal(page)).toBeVisible();
}
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("P51 authors selected requirements and scoped decisions with mouse history, reload, acknowledgement expiry and linked editors", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "P51 architecture review");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture();
    base.architecture!.reviewRequirements = [];
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: base.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await openReview(page);
    const dialog = modal(page);
    await expect(dialog).toContainText("Design review complete");
    for (const kind of ["cache", "access", "delivery", "failure"]) {
      await dialog.getByRole("tab", { name: "Requirements", exact: true }).click();
      await dialog.getByRole("button", { name: "Add requirement", exact: true }).click();
      await dialog.getByLabel("Requirement kind", { exact: true }).selectOption(kind);
      await dialog
        .getByRole("textbox", { name: "Requirement name", exact: true })
        .fill(`${kind} policy`);
      if (kind === "cache") {
        await dialog
          .getByLabel("Required interaction", { exact: true })
          .selectOption("lookup-cache-binding");
        await dialog
          .getByLabel("Application source fallback", { exact: true })
          .selectOption("lookup-store-binding");
      } else if (kind === "access") {
        await dialog
          .getByLabel("Required interaction", { exact: true })
          .selectOption("update-store-binding");
        await dialog.getByLabel("Required identity", { exact: true }).selectOption("Service");
        await dialog
          .getByLabel("Required tenant boundary", { exact: true })
          .selectOption("Tenant scoped");
      } else if (kind === "delivery") {
        await dialog.getByLabel("Delivery trigger", { exact: true }).selectOption("Channel");
        await dialog
          .getByLabel("Delivery responsibility", { exact: true })
          .selectOption("component:visit-processor");
        await dialog.getByLabel("Logical channel", { exact: true }).selectOption("visits");
        await dialog
          .getByLabel("Channel consume binding", { exact: true })
          .selectOption("consume-visits-binding");
      } else {
        await dialog
          .getByLabel("Required interaction", { exact: true })
          .selectOption("publish-visits-binding");
        await dialog
          .getByLabel("Required failure outcome", { exact: true })
          .selectOption("Bounded loss");
      }
      await dialog.getByRole("button", { name: "Save review", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await openReview(page);
    }
    await expect(dialog).toContainText("CACHE_UPDATE_MISSING");
    await accessible(page);
    await page.screenshot({ path: "test-results/p51-review-light.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Preview relevant pattern", exact: true }).click();
    const pattern = page.getByRole("dialog", { name: "Compose architecture pattern", exact: true });
    await expect(pattern).toContainText("Cached public lookup");
    await pattern.getByRole("button", { name: "Cancel", exact: true }).click();
    await openReview(page);
    await dialog.getByRole("button", { name: "Record tradeoff", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Decision title", exact: true })
      .fill("Defer cache propagation during exploration");
    await dialog
      .getByRole("textbox", { name: "Decision and reason", exact: true })
      .fill("Accept this gap while comparing cache policies.");
    await dialog
      .getByRole("textbox", { name: "Consequence", exact: true })
      .fill("Implement bounded disable propagation before product handoff.");
    await dialog.getByLabel("Decision status", { exact: true }).selectOption("Accepted");
    await accessible(page);
    await page.screenshot({ path: "test-results/p51-decision-light.png", animations: "disabled" });
    const beforeDecision = await read();
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const saved = await read();
    expect(saved.revision).toBe(beforeDecision.revision + 1);
    expect(reviewArchitecture(saved).complete).toBe(true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.decisions?.length ?? 0).toBe(0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.decisions?.length ?? 0).toBe(1);
    await page.reload();
    await openReview(page);
    await expect(dialog).toContainText("Accepted scoped tradeoff");
    await expect(dialog).toContainText("Accept this gap while comparing cache policies.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const current = await read();
    const architecture = structuredClone(current.architecture!);
    architecture.bindings!.find((b) => b.id === "lookup-cache-binding")!.policies!
      .freshness!.maxAgeSeconds = 20;
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: { baseRevision: current.revision, ops: [{ op: "setArchitecture", architecture }] },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await openReview(page);
    await expect(dialog).toContainText("Previous acknowledgement expired");
    await expect(dialog).toContainText("Design review incomplete");
    await page.screenshot({ path: "test-results/p51-expired-light.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Open relevant editor", exact: true }).click();
    await expect(dialog.getByRole("tab", { name: "Requirements", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog.getByRole("button", { name: "Edit interaction policies", exact: true }).click();
    const policies = page.getByRole("dialog", {
      name: "Relationship contracts and policies",
      exact: true,
    });
    await expect(policies).toBeVisible();
    await expect(policies).toContainText("Lookup Cache");
    await policies.getByRole("button", { name: "Cancel", exact: true }).click();
    const api = await (await request.get(`/api/projects/${id}/architecture`)).json();
    expect(api.review).toEqual(reviewArchitecture(await read()));
    expect(api.review.findings[0].acceptedBy).toBeUndefined();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P51 preserves conflicting decision drafts, supports Cancel, and shows narrow dark review and decision controls", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "P51 conflict draft");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture();
    const cache = base.architecture!.reviewRequirements!.find((r) => r.kind === "cache")!;
    if (cache.kind === "cache") delete cache.update;
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: base.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openReview(page);
    const dialog = modal(page);
    await accessible(page);
    await page.screenshot({ path: "test-results/p51-review-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Record tradeoff", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Decision title", exact: true })
      .fill("Retained policy draft");
    await dialog
      .getByRole("textbox", { name: "Decision and reason", exact: true })
      .fill("Explore a bounded alternative first.");
    await dialog
      .getByRole("textbox", { name: "Consequence", exact: true })
      .fill("Revisit before implementation.");
    await accessible(page);
    await page.screenshot({ path: "test-results/p51-decision-dark.png", animations: "disabled" });
    const before = await read();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: before.revision,
            ops: [{ op: "setNotes", id: "management", notes: "Concurrent context" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "P51 decision revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
    conflict.finish();
    await dialog.getByRole("button", { name: "Save review", exact: true }).click();
    await expect(dialog).toContainText("Your draft has been retained");
    await expect(dialog.getByRole("textbox", { name: "Decision title", exact: true })).toHaveValue(
      "Retained policy draft",
    );
    expect((await read()).architecture!.decisions).toBeUndefined();
    const concurrent = await read();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(concurrent);
    await openReview(page);
    await dialog.getByRole("tab", { name: "Requirements", exact: true }).click();
    await dialog
      .getByLabel("Selected requirement", { exact: true })
      .selectOption("cache-requirement");
    await accessible(page);
    await page.screenshot({
      path: "test-results/p51-requirements-dark.png",
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P51 contract contradictions remain review conflicts and link to the exact relationship editor", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P51 contract conflict");
  try {
    const base = fixture();
    base.architecture!.contracts!.push({ ...base.architecture!.contracts![0]!, version: "v2" });
    base.architecture!.interfaces!.find((i) => i.id === "lookup-cache-use")!.contract.version =
      "v2";
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...base.elements.map((element) => ({ op: "addElement", element })),
              ...base.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: base.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await openReview(page);
    const dialog = modal(page);
    const mismatch = dialog.getByRole("article", { name: "CONTRACT_MISMATCH", exact: true });
    await expect(mismatch).toContainText("Conflict");
    await expect(
      mismatch.getByRole("button", { name: "Record tradeoff", exact: true }),
    ).toHaveCount(0);
    await accessible(page);
    await page.screenshot({
      path: "test-results/p51-contract-conflict-light.png",
      animations: "disabled",
    });
    await mismatch.getByRole("button", { name: "Open relevant editor", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Relationship contracts and policies", exact: true }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

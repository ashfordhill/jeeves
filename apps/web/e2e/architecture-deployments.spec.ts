import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type DesignDocument, designSchema } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-deployments.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const modal = (page: Page) => page.getByRole("dialog", { name: "Deployment plans", exact: true });
async function open(page: Page) {
  await editorAction(page, "Deployment plans");
}
async function accessibility(page: Page) {
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function leave(page: Page) {
  if (page.isClosed()) return;
  if (await page.getByRole("dialog").count())
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Close / })
      .first()
      .click();
  await page.getByRole("tab", { name: "Runs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Plan a run", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("P53 composes hosted placement by mouse, preserves logical identities, and saves history and independent diagram layout", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P53 mouse deployment");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const base = fixture();
    const architecture = { ...base.architecture!, deployments: undefined };
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
      ).status(),
    ).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await open(page);
    const dialog = modal(page);
    await dialog.getByRole("button", { name: "Add environment", exact: true }).click();
    await dialog.getByLabel("Environment name").fill("Hosted reference");
    await dialog
      .getByLabel("Environment responsibility")
      .fill("Illustrative hosted deployment; managed operation with no measured capacity.");
    const envId = await dialog.getByLabel("Planning environment").inputValue();
    const node = async (name: string, parent?: string, infrastructure = false) => {
      await dialog
        .getByRole("button", {
          name: infrastructure ? "Add infrastructure" : "Add placement",
          exact: true,
        })
        .click();
      await dialog.getByLabel("Placement name").fill(name);
      if (parent) await dialog.getByLabel("Parent placement").selectOption(parent);
      await dialog
        .getByLabel("Placement responsibility")
        .fill(
          infrastructure
            ? "Platform operates shared broker; application owns channel policies."
            : "Application host failure domain, declared only.",
        );
      await dialog.getByLabel("Service operation").selectOption("Externally operated");
      return (await dialog.getByLabel("Plan object").inputValue()).slice(5);
    };
    const hosting = await node("Hosted platform");
    await dialog.getByLabel("Region", { exact: true }).fill("Example region");
    const zone = await node("Zone A", hosting);
    await dialog.getByLabel("Zone / failure domain").fill("Example zone A");
    const broker = await node("Shared broker", hosting, true);
    await dialog.getByLabel("Technology", { exact: true }).fill("AMQP broker");
    await dialog.getByLabel("Infrastructure replica count").fill("2");
    const edge = await node("CDN and TLS edge", hosting, true);
    await dialog.getByLabel("Reviewed legacy C2 mapping").selectOption("edge");
    await expect(
      dialog.getByRole("button", { name: "Save deployment plan", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByLabel("Mapping review reason")
      .fill("Reviewed routing responsibility; keep C2 identity and request direction.");
    await accessibility(page);
    await page.screenshot({ path: "test-results/p53-mapping-light.png", animations: "disabled" });
    const instance = async (element: string, placement: string, replicas = 1) => {
      await dialog.getByRole("button", { name: "Add instance", exact: true }).click();
      await dialog.getByLabel("Logical C2 identity").selectOption(element);
      await dialog.getByLabel("Instance placement").selectOption(placement);
      await dialog.getByLabel("Replica count", { exact: true }).fill(String(replicas));
      return await dialog.getByLabel("Plan object").inputValue();
    };
    const redirect = await instance("redirect", zone, 3);
    const visits = await instance("visits", broker);
    await instance("billing", broker);
    const worker = await instance("worker", zone);
    await dialog.getByRole("button", { name: "Add external", exact: true }).click();
    await dialog.getByLabel("External product").selectOption("element:email");
    const email = await dialog.getByLabel("Plan object").inputValue();
    const interaction = async (from: string, to: string, relationship: string) => {
      await dialog.getByRole("button", { name: "Add interaction", exact: true }).click();
      await dialog.getByLabel("Interaction meaning").selectOption("logical");
      await dialog.getByLabel("Interaction from", { exact: true }).selectOption(from);
      await dialog.getByLabel("Interaction to", { exact: true }).selectOption(to);
      await dialog.getByLabel("Logical relationship").selectOption(`connection:${relationship}`);
    };
    await interaction(redirect, visits, "publish-visits");
    await interaction(worker, email, "send-email");
    await interaction(`node:${edge}`, redirect, "edge-redirect");
    await dialog.getByRole("button", { name: "Add interaction", exact: true }).click();
    await dialog.getByLabel("Interaction from", { exact: true }).selectOption(`node:${edge}`);
    await dialog.getByLabel("Interaction to", { exact: true }).selectOption(`node:${broker}`);
    await dialog
      .getByLabel("Infrastructure interaction purpose")
      .fill("Monitors broker reachability");
    await dialog.getByRole("button", { name: "Save deployment plan", exact: true }).click();
    await expect(dialog.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await accessibility(page);
    await page.screenshot({ path: "test-results/p53-hosted-light.png", animations: "disabled" });
    await dialog
      .getByText("Placement responsibilities and logical references", { exact: true })
      .click();
    await dialog
      .getByRole("region", { name: "Nested deployment placements", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/p53-placements-light.png",
      animations: "disabled",
    });
    await dialog
      .getByText("Placement responsibilities and logical references", { exact: true })
      .click();
    const saved = await read();
    expect(saved.revision).toBe(2);
    expect(saved.elements).toEqual(base.elements);
    expect(saved.connections).toEqual(base.connections);
    expect(
      saved.architecture!.deployments![0]!.instances.filter((i) => i.element === "redirect"),
    ).toHaveLength(1);
    await dialog.getByRole("button", { name: "Add environment", exact: true }).click();
    await dialog.getByLabel("Environment name").fill("Optional private delivery");
    await dialog.getByLabel("Delivery alternative").selectOption("Private");
    await dialog.getByRole("button", { name: "Save deployment plan", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Edit deployment plan", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.deployments!.length).toBe(1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture!.deployments!.length).toBe(2);
    await page.reload();
    await open(page);
    await dialog.getByLabel("Planning environment").selectOption(envId);
    await expect(dialog.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    // Use the shared diagram options on a concrete replica; layout changes never edit C2.
    const replicaId = `deployment:${envId}:${redirect.slice(9)}:1`;
    await dialog.getByLabel("Inspect deployment object").selectOption(replicaId);
    const options = async (name: string) => {
      await dialog.getByRole("button", { name: "Diagram options", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    };
    const revision = (await read()).revision;
    const readPosition = async () =>
      (await (await request.get(`/api/projects/${id}/layout`)).json()).layout.architecture?.[
        `deployment:${envId}`
      ]?.positions?.[replicaId];
    await expect.poll(readPosition).toBeDefined();
    const beforePosition = await readPosition();
    await options("Nudge right");
    await options("Undo layout");
    await options("Redo layout");
    await options("Focus selected object");
    await expect.poll(async () => (await readPosition())?.x).toBe(beforePosition.x + 24);
    await expect.poll(async () => (await read()).revision).toBe(revision);
    await page.screenshot({
      path: "test-results/p53-instance-focus-light.png",
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await open(page);
    await expect(dialog.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await accessibility(page);
    await page.screenshot({ path: "test-results/p53-hosted-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Edit deployment plan", exact: true }).click();
    await dialog.getByLabel("Plan object").selectOption(`node:${broker}`);
    await accessibility(page);
    await page.screenshot({ path: "test-results/p53-broker-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel changes", exact: true }).click();
    expect((await read()).elements).toEqual(base.elements);
  } finally {
    await leave(page);
    await request.delete(`/api/projects/${id}`);
  }
});

test("P53 retains invalid and conflicted drafts and never invents executable connections", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "P53 deployment conflict");
  try {
    const base = fixture();
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
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await open(page);
    const dialog = modal(page);
    await dialog.getByRole("button", { name: "Edit deployment plan", exact: true }).click();
    await dialog.getByLabel("Plan object").selectOption("node:hosting");
    await dialog.getByLabel("Parent placement").selectOption("zone-a");
    await expect(dialog).toContainText("Deployment nesting must be acyclic");
    await expect(
      dialog.getByRole("button", { name: "Save deployment plan", exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel("Parent placement").selectOption("");
    await dialog.getByLabel("Placement name").fill("Reviewed host placement");
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 1,
            ops: [{ op: "setNotes", id: "redirect", notes: "Concurrent note" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "Deployment plan stale save",
      method: "POST",
      url: `http://127.0.0.1:4301/api/projects/${id}/operations`,
      resourceType: "fetch",
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save deployment plan", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    conflict.finish();
    await expect(dialog.getByLabel("Placement name")).toHaveValue("Reviewed host placement");
    await accessibility(page);
    await page.screenshot({ path: "test-results/p53-conflict-light.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel changes", exact: true }).click();
    const actual = (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    expect(actual.architecture.deployments[0].nodes[0].name).toBe("Hosted platform");
    expect(actual.elements[0].notes).toBe("Concurrent note");
    expect(actual.connections).toEqual(base.connections);
  } finally {
    await leave(page);
    await request.delete(`/api/projects/${id}`);
  }
});

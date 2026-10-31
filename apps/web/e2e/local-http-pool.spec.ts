import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { inspectObject, layoutOf, reviewRelease } from "./helpers.ts";

test("a reviewed starter authors a local pool by mouse, preserves application identity, and refuses a stale draft", async ({
  page,
  request,
  browserProblems,
}) => {
  const created = await request.post("/api/projects/from-starter", {
    data: { name: "Pooled Fieldwork", starter: { id: "resource-workspace", version: "0.1.0" } },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).project.id;
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await page.goto(`/?project=${id}#/draw`);
    const card = page.locator('[data-element-id="inventory"]');
    await card.locator(".element-card-head").click();
    const original = await read(),
      layout = await layoutOf(request, id);
    await reviewRelease(page, "inventory", "Inventory API", "http-service@0.4.0");
    const review = page.getByRole("dialog", { name: "Review template upgrade" });
    await expect(review.getByText("Local HTTP pool", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Upgrade template", exact: true }).click();
    await expect(review).not.toBeVisible();
    const add = async (name: string) => {
      await page.getByRole("button", { name: "Add attachment", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    };
    await add("Local HTTP pool");
    await expect(
      page.getByRole("button", { name: "Configure local HTTP pool", exact: true }),
    ).toBeVisible();
    const before = await read();
    const configure = page.getByRole("button", { name: "Configure local HTTP pool", exact: true });
    const dialog = page.getByRole("dialog", { name: "Configure local HTTP pool", exact: true });
    await configure.click();
    await expect(dialog.getByText(/Add and configure a local execution policy/)).toBeVisible();
    await dialog.getByLabel("Pool size").selectOption("3");
    await expect(dialog.getByRole("status")).toContainText("15 application connections");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(before);
    await configure.click();
    await dialog.getByLabel("Pool size").selectOption("3");
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Save local HTTP pool", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const poolConfig = async () =>
      (await read()).elements[0].attachments.find(
        (item: { template: { id: string } }) => item.template.id === "local-http-pool",
      ).config;
    await expect.poll(poolConfig).toEqual({ replicas: 3 });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(poolConfig)
      .toEqual(
        before.elements[0].attachments.find(
          (item: { template: { id: string } }) => item.template.id === "local-http-pool",
        ).config,
      );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(poolConfig).toEqual({ replicas: 3 });
    await add("Local execution policy");
    await page.getByRole("button", { name: "Configure local execution", exact: true }).click();
    const execution = page.getByRole("dialog", { name: "Configure local execution" });
    await execution.getByRole("button", { name: "Save local execution", exact: true }).click();
    await expect(execution).not.toBeVisible();
    await page.reload();
    await card.locator(".element-card-head").click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await configure.click();
    await expect(dialog.getByLabel("Pool size")).toHaveValue("3");
    await expect(dialog.getByText("Complete before generation", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 700, height: 760 });
    await expect(dialog.getByRole("button", { name: "Save local HTTP pool" })).toBeInViewport();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p32-pool-narrow-dark.png",
      animations: "disabled",
    });
    const current = await read();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "updateElement", id: "inventory", name: "Shared Inventory API" }],
          },
        })
      ).status(),
    ).toBe(200);
    const stale = browserProblems.expectHttp({
      scenario: "stale local pool draft",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save local HTTP pool" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
    stale.finish();
    await dialog.getByRole("button", { name: "Save local HTTP pool" }).click();
    await expect(dialog.getByText(/design changed while this draft was open/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const changed = await read();
    expect(changed.connections).toEqual(original.connections);
    expect(changed.startedFrom).toEqual(original.startedFrom);
    expect((await layoutOf(request, id)).items).toEqual(layout.items);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
    await workspace
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: /Containers/ })
      .click();
    await expect(page.locator(".draw-board")).toBeVisible();
    await inspectObject(page, "container:inventory");
    await expect(page.locator("[data-element-id]")).toHaveCount(3);
    const summary = workspace.getByRole("region", { name: "Local HTTP pool", exact: true });
    await expect(summary).toContainText("One application · 3 local instances");
    await expect(summary).toContainText("15 application connections");
    await page.screenshot({ path: "test-results/p32-pool-c4.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
    await workspace.getByRole("button", { name: "Open components", exact: true }).click();
    await expect(page.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Inspect Accounts and sessions", exact: true }).click();
    await expect(summary).toContainText("3 local instances");
    const architecture = await (await request.get(`/api/projects/${id}/architecture`)).json();
    expect(
      architecture.views.components
        .find((scope: { container: string }) => scope.container === "inventory")
        .nodes.some(
          (node: { binding?: { attachment?: string } }) =>
            node.binding?.attachment ===
            changed.elements[0].attachments.find(
              (item: { template: { id: string } }) => item.template.id === "local-http-pool",
            ).id,
        ),
    ).toBe(false);
    expect(await read()).toEqual(changed);
  } finally {
    if (!page.isClosed()) await request.delete(`/api/projects/${id}`);
  }
});

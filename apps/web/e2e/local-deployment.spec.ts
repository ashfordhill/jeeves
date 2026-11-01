import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject } from "./helpers.ts";

test("declared deployment stays separate from C4, exposes real budgets and preserves the design while inspecting", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/projects/from-starter", {
    data: { name: "Deployment Fieldwork", starter: { id: "resource-workspace", version: "0.1.0" } },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).project.id;
  const read = async (path: string) => (await request.get(`/api/projects/${id}/${path}`)).json();
  try {
    let design = (await read("design")).design;
    const upgrade = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: design.revision,
        ops: [
          {
            op: "upgradeTemplate",
            id: "inventory",
            from: { id: "http-service", version: "0.2.0" },
            to: { id: "http-service", version: "0.4.0" },
            revision: design.revision,
          },
        ],
      },
    });
    expect(upgrade.status()).toBe(200);
    design = (await read("design")).design;
    const configured = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: design.revision,
        ops: [
          {
            op: "addAttachment",
            element: "inventory",
            attachment: {
              id: "pool",
              template: { id: "local-http-pool", version: "0.1.0" },
              config: { replicas: 3 },
            },
          },
          {
            op: "addAttachment",
            element: "inventory",
            attachment: {
              id: "execution",
              template: { id: "local-execution", version: "0.1.0" },
              config: { preset: "balanced" },
            },
          },
          {
            op: "addElement",
            element: {
              id: "audit",
              name: "Audit API",
              template: { id: "http-service", version: "0.4.0" },
              config: { replicas: 4 },
            },
          },
        ],
      },
    });
    expect(configured.status()).toBe(200);
    const before = await read("design"),
      layout = await read("layout");
    await page.goto(`/?project=${id}#/draw`);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
    await workspace
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: /Containers/ })
      .click();
    await expect(page.locator(".draw-board")).toBeVisible();
    await inspectObject(page, "container:inventory");
    await expect(page.locator("[data-element-id]")).toHaveCount(4);
    await workspace.getByRole("button", { name: "Open components", exact: true }).click();
    await expect(page.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await workspace.getByRole("button", { name: "Editor actions", exact: true }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Show technical components", exact: true })
      .check();
    await expect(page.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await inspectObject(page, "component:inventory:inventory-api:boundary");
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    const viewport = page.locator(".architecture-graph .react-flow__viewport"),
      camera = await viewport.getAttribute("style");
    // P49 persists diagram layout and camera independently; inspect from its settled snapshot.
    await expect
      .poll(
        async () =>
          (await read("layout")).layout.architecture?.["components:inventory"]?.viewport?.zoom,
      )
      .toBeCloseTo(Number(camera?.match(/scale\(([^)]+)\)/)?.[1]), 6);
    const inspectionLayout = await read("layout");
    const open = () => editorAction(page, "Local deployment");
    await open();
    const dialog = page.getByRole("dialog", { name: "Local deployment", exact: true });
    await expect(dialog.getByLabel("Application deployment")).toHaveValue("inventory");
    await expect(
      dialog.getByRole("region", { name: "Application instances" }).getByRole("article"),
    ).toHaveCount(3);
    await expect(dialog.getByRole("article", { name: "Local proxy" })).toContainText(
      "inventory:8080",
    );
    await expect(dialog.getByRole("region", { name: "Declared callers" })).toContainText(
      "Inventory workspace",
    );
    await expect(dialog.getByText("2304 MiB", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/up to 15 application connections/)).toBeVisible();
    await expect(
      dialog.getByText(/Running containers and their health are not inspected/),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p33-deployment-desktop.png",
      animations: "disabled",
    });
    await dialog.getByLabel("Application deployment").selectOption("audit");
    await expect(
      dialog.getByRole("region", { name: "Application instances" }).getByRole("article"),
    ).toHaveCount(1);
    await expect(dialog.getByRole("article", { name: "Local proxy" })).toHaveCount(0);
    await expect(dialog.getByText(/Legacy replica hint 4 does not create instances/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close deployment", exact: true }).click();
    await expect(workspace).toHaveAttribute(
      "data-selection",
      "component:inventory:inventory-api:boundary",
    );
    await expect(viewport).toHaveAttribute("style", camera ?? "");
    expect(await read("design")).toEqual(before);
    expect(await read("layout")).toEqual(inspectionLayout);
    expect(inspectionLayout.layout.items).toEqual(layout.layout.items);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 520, height: 820 });
    await open();
    await expect(
      dialog.getByRole("button", { name: "Configure application", exact: true }),
    ).toBeInViewport();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p33-deployment-narrow-dark.png",
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Recorded evidence", exact: true }).click();
    const evidence = page.getByRole("dialog", { name: "Architecture evidence", exact: true });
    await expect(evidence).toBeVisible();
    await expect(evidence.getByText("No generation recorded", { exact: true })).toBeVisible();
    await evidence.getByRole("button", { name: "Close evidence", exact: true }).click();
    await open();
    await dialog.getByLabel("Application deployment").selectOption("audit");
    await dialog.getByRole("button", { name: "Configure application", exact: true }).click();
    await expect(
      workspace.getByRole("button", { name: "C2 Containers", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('.react-flow__node.selected [data-element-id="audit"]'),
    ).toBeVisible();
    expect((await read("design")).design).toEqual(before.design);
    // An incomplete policy must show the real prerequisite, never an apparent running trio.
    const current = (await read("design")).design;
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "removeAttachment", id: "execution" }],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await open();
    await expect(
      dialog.getByText("Complete configuration before generation", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText(/Add and configure a local execution policy/)).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Declared physical arrangement" })).toHaveCount(
      0,
    );
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { diagramAction, editorAction, inspectObject } from "./helpers.ts";

test("C4 navigation preserves the board and context/product edits save, cancel, undo and reload", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/projects/from-recipe", {
    data: {
      name: `Architecture ${crypto.randomUUID().slice(0, 8)}`,
      recipe: { id: "qr-studio", version: "0.1.0" },
    },
  });
  expect(response.status()).toBe(201);
  const { project } = await response.json();
  const design = async () =>
    (await (await request.get(`/api/projects/${project.id}/design`)).json()).design;
  const layout = async () =>
    (await (await request.get(`/api/projects/${project.id}/layout`)).json()).layout;
  await page.goto(`/?project=${project.id}#/draw`);
  await expect(page.locator("[data-element-id]")).toHaveCount(3);
  await editorAction(page, "Show inspector");
  const before = await design();
  let beforeLayout = await layout();
  // A delayed layout save must not let an earlier tab click replace the latest choice.
  let releaseLayout!: () => void;
  let layoutStarted!: () => void;
  const heldLayout = new Promise<void>((resolve) => {
    releaseLayout = resolve;
  });
  const startedLayout = new Promise<void>((resolve) => {
    layoutStarted = resolve;
  });
  const layoutUrl = `**/api/projects/${project.id}/layout`;
  await page.route(layoutUrl, async (route) => {
    if (route.request().method() === "PUT") {
      layoutStarted();
      await heldLayout;
    }
    await route.continue();
  });
  const board = await page.locator(".react-flow__pane").boundingBox();
  if (!board) throw new Error("Board not visible");
  await page.mouse.move(board.x + 40, board.y + board.height - 80);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(board.x + 100, board.y + board.height - 110, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await startedLayout;
  await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
  const savedLayout = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/projects/${project.id}/layout`) &&
      response.request().method() === "PUT",
  );
  releaseLayout();
  await savedLayout;
  await page.unroute(layoutUrl);
  beforeLayout = await layout();
  await inspectObject(page, "container:qrwty");
  await expect(page.getByRole("button", { name: "C2 Containers", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
  const levels = workspace.getByRole("navigation", { name: "Architecture levels" });
  const details = workspace.getByRole("complementary", { name: "Architecture details" });
  await expect(
    workspace.getByRole("button", { name: "Inspect Link owner", exact: true }),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", {
      name: "Inspect relationship: Browser follows the destination URL",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/p20-context.png", animations: "disabled" });
  await levels.getByRole("button", { name: /Containers/ }).click();
  await inspectObject(page, "container:qrwty");
  await details.getByRole("button", { name: "Open components" }).click();
  await inspectObject(page, "component:qrwty:qrwty-api:accounts");
  await expect(details.getByRole("heading", { name: "Accounts and sessions" })).toBeVisible();
  await inspectObject(page, "component:qrwty:qrwty-api:extension:owner-analytics");
  await expect(details.getByText("qr-studio@0.1.0", { exact: true })).not.toBeVisible();
  await expect(details.getByText("QR-15, QR-16", { exact: true })).toHaveCount(0);
  await expect(details.locator(".endpoint-line")).toContainText("GET /api/analytics");
  await expect(
    workspace.getByRole("region", { name: "components diagram", exact: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page.screenshot({ path: "test-results/p20-components.png", animations: "disabled" });
  await diagramAction(page, "Focus selected object");
  await expect(
    workspace.getByRole("button", { name: "Inspect Owner analytics", exact: true }),
  ).toBeInViewport();
  expect(
    (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
  ).toEqual([]);
  await details.getByText("Technical details", { exact: true }).click();
  await details.getByRole("button", { name: "Open in C2" }).click();
  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
  expect(await design()).toEqual(before);
  expect(await layout()).toEqual(beforeLayout);

  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await editorAction(page, "Edit context");
  const context = page.getByRole("dialog", { name: "Edit system context" });
  await context
    .getByLabel("System responsibility")
    .fill("A reusable QR product configured from an intentional architecture.");
  await context.getByRole("button", { name: "Save context" }).click();
  await expect(context).not.toBeVisible();
  await inspectObject(page, "context:system");
  await expect(details.getByLabel("Responsibility", { exact: true })).toHaveValue(
    "A reusable QR product configured from an intentional architecture.",
  );
  expect((await design()).revision).toBe(before.revision + 1);

  await editorAction(page, "Product configuration");
  let config = page.getByRole("dialog", { name: "Product configuration" });
  await config.getByLabel("Product tagline").fill("Discard this draft");
  await config.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await design()).recipe.config.tagline).toBe(before.recipe.config.tagline);
  await editorAction(page, "Product configuration");
  config = page.getByRole("dialog", { name: "Product configuration" });
  await config
    .getByRole("textbox", { name: "Product name", exact: true })
    .fill("Configured Studio");
  await config.getByLabel("Product tagline").fill("An intentional product");
  await config.getByLabel("Default analytics range").selectOption("90");
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: "test-results/p20-configuration.png", animations: "disabled" });
  await config.getByRole("button", { name: "Save configuration" }).click();
  await expect(config).not.toBeVisible();
  const configured = await design();
  expect(configured.revision).toBe(before.revision + 2);
  expect(configured.recipe.config).toEqual({
    tagline: "An intentional product",
    analyticsDays: 90,
  });
  expect(
    configured.elements.find((element: { id: string }) => element.id === "qrwty-web").config.title,
  ).toBe("Configured Studio");
  await workspace.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await design()).recipe.config).toEqual(before.recipe.config);
  expect(
    (await design()).elements.find((element: { id: string }) => element.id === "qrwty-web").config
      .title,
  ).toBe(
    before.elements.find((element: { id: string }) => element.id === "qrwty-web").config.title,
  );
  await page.reload();
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await inspectObject(page, "context:system");
  await expect(details.getByLabel("Responsibility", { exact: true })).toHaveValue(
    "A reusable QR product configured from an intentional architecture.",
  );
  expect(await layout()).toEqual(beforeLayout);
  await request.delete(`/api/projects/${project.id}`);
});

test("a narrower context editor keeps unbound architectural intent visible without inventing templates", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1000, height: 850 });
  const created = await request.post("/api/projects/from-recipe", {
    data: {
      name: `Narrow architecture ${crypto.randomUUID().slice(0, 8)}`,
      recipe: { id: "qr-studio", version: "0.1.0" },
    },
  });
  const { project } = await created.json();
  await page.goto(`/?project=${project.id}#/draw`);
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  await editorAction(page, "Edit context");
  const dialog = page.getByRole("dialog", { name: "Edit system context" });
  await dialog.getByLabel("Interaction 1 container", { exact: true }).selectOption("");
  await dialog.getByRole("button", { name: "Save context" }).click();
  await expect(dialog).not.toBeVisible();
  await editorAction(page, /^Findings/);
  await expect(page.getByText(/has no container binding. It describes intent only/)).toBeVisible();
  await page
    .getByRole("dialog", { name: "Findings", exact: true })
    .getByRole("button", { name: "Close findings" })
    .click();
  const state = await (await request.get(`/api/projects/${project.id}/design`)).json();
  expect(state.findings.map((finding: { code: string }) => finding.code)).toEqual([
    "ARCHITECTURE_UNBOUND",
  ]);
  expect(state.design.elements).toHaveLength(3);
  const graph = page.getByRole("region", { name: "context diagram", exact: true });
  // The narrow default view should contain every context card, not just a tiny/cropped center.
  await expect(graph).toHaveAttribute("aria-busy", "false");
  await expect(graph.locator(".architecture-card")).toHaveCount(4);
  const bounds = await graph.boundingBox();
  for (const card of await graph.locator(".architecture-card").all()) {
    await expect(card).toBeInViewport();
    const box = await card.boundingBox();
    expect(box && bounds && box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width).toBe(
      true,
    );
  }
  await page.screenshot({ path: "test-results/p20-narrow.png", animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
  ).toEqual([]);
  await request.delete(`/api/projects/${project.id}`);
});

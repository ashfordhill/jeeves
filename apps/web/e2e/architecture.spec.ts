import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";

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
  const before = await design(),
    beforeLayout = await layout();
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
  const levels = workspace.getByRole("navigation", { name: "Architecture levels" });
  const details = workspace.getByRole("complementary", { name: "Architecture details" });
  await expect(
    workspace.getByRole("button", { name: "Inspect Link owner", exact: true }),
  ).toBeVisible();
  await expect(
    details.getByText("Browser follows the destination URL", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/p20-context.png", animations: "disabled" });
  await levels.getByRole("button", { name: /Containers/ }).click();
  await details.getByLabel("Inspect an object").selectOption("container:qrwty");
  await details.getByRole("button", { name: "Open components" }).click();
  await details.getByLabel("Inspect an object").selectOption("component:qrwty:qrwty-api:accounts");
  await expect(details.getByRole("heading", { name: "Accounts and sessions" })).toBeVisible();
  await details
    .getByLabel("Inspect an object")
    .selectOption("component:qrwty:qrwty-api:extension:owner-analytics");
  await expect(details.getByText("qr-studio@0.1.0", { exact: true })).toBeVisible();
  await expect(details.getByText("QR-15, QR-16", { exact: true })).toBeVisible();
  await expect(
    workspace.getByRole("region", { name: "components diagram", exact: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page.screenshot({ path: "test-results/p20-components.png", animations: "disabled" });
  await workspace.getByRole("button", { name: "Focus selected object" }).click();
  await expect(
    workspace.getByRole("button", { name: "Inspect Owner analytics", exact: true }),
  ).toBeInViewport();
  expect(
    (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
  ).toEqual([]);
  await details.getByRole("button", { name: "Edit on board" }).click();
  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
  expect(await design()).toEqual(before);
  expect(await layout()).toEqual(beforeLayout);

  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  await workspace.getByRole("button", { name: "Edit context", exact: true }).click();
  const context = page.getByRole("dialog", { name: "Edit system context" });
  await context
    .getByLabel("System responsibility")
    .fill("A reusable QR product configured from an intentional architecture.");
  await context.getByRole("button", { name: "Save context" }).click();
  await expect(context).not.toBeVisible();
  await expect(
    details
      .getByText("A reusable QR product configured from an intentional architecture.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  expect((await design()).revision).toBe(before.revision + 1);

  await workspace.getByRole("button", { name: "Product configuration", exact: true }).click();
  let config = page.getByRole("dialog", { name: "Product configuration" });
  await config.getByLabel("Product tagline").fill("Discard this draft");
  await config.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await design()).recipe.config.tagline).toBe(before.recipe.config.tagline);
  await workspace.getByRole("button", { name: "Product configuration", exact: true }).click();
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
  await workspace.getByRole("button", { name: "Undo latest change" }).click();
  await expect.poll(async () => (await design()).recipe.config).toEqual(before.recipe.config);
  expect(
    (await design()).elements.find((element: { id: string }) => element.id === "qrwty-web").config
      .title,
  ).toBe(
    before.elements.find((element: { id: string }) => element.id === "qrwty-web").config.title,
  );
  await page.reload();
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  await expect(
    details
      .getByText("A reusable QR product configured from an intentional architecture.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  await page.getByRole("button", { name: "Edit context", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit system context" });
  await dialog.getByLabel("Interaction 1 container", { exact: true }).selectOption("");
  await dialog.getByRole("button", { name: "Save context" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("1 context interaction has no container binding.", { exact: false }),
  ).toBeVisible();
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

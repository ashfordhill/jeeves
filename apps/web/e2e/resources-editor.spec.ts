import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";

test.use({ viewport: { width: 1600, height: 1000 } });

import { designOf, layoutOf, openNewProject } from "./helpers.ts";

test("production Service hierarchy, reviewed subtype loss and layout-only resize work with mouse controls", async ({
  page,
  request,
}) => {
  const project = await openNewProject(page, request, "P3 service editing");
  const pane = page.locator(".react-flow__pane");
  await page.getByRole("button", { name: "Service", exact: true }).click();
  await pane.click({ position: { x: 310, y: 330 } });
  const service = page.locator('[data-element-id="service"]');
  await expect(service).toBeVisible();
  await service
    .getByRole("combobox", { name: "Subtype of Service" })
    .selectOption("http-service@0.1.0");
  await service.locator(".element-card-head").click();
  await service.getByRole("button", { name: "Add REST API server", exact: true }).click();
  await expect(service.locator("[data-attachment-id]")).toHaveCount(1);
  await expect(service.locator(".react-flow__handle")).toHaveCount(2);
  await expect(service.locator("li .react-flow__handle")).toHaveCount(0);
  await page.getByRole("button", { name: "Elements", exact: true }).click();
  await page.getByRole("button", { name: /^PostgreSQL/ }).click();
  await pane.click({ position: { x: 770, y: 330 } });
  const db = page.locator(".database-card");
  await expect(db).toBeVisible();
  await page.getByRole("button", { name: "Connector", exact: true }).click();
  await service.locator(".element-card-head").click();
  await db.click();
  await expect
    .poll(async () => (await designOf(request, project)).design.connections.length)
    .toBe(1);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await service.locator(".element-card-head").click();
  const before = (await designOf(request, project)).design;
  await service.getByRole("combobox", { name: "Subtype of Service" }).selectOption("web-app@0.1.0");
  const review = page.getByRole("dialog", { name: "Change service subtype?" });
  await expect(review).toContainText("component: service-rest-api-server");
  await expect(review).toContainText("connection:");
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await designOf(request, project)).design).toEqual(before);
  await expect(page.locator(".mantine-Modal-overlay")).toHaveCount(0);
  const corner = service.locator(".react-flow__resize-control.bottom.right.handle");
  const box = await corner.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 100, box!.y + 65, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await layoutOf(request, project)).items.service)
    .toHaveProperty("width");
  expect((await designOf(request, project)).design.revision).toBe(before.revision);
  await service.getByRole("combobox", { name: "Subtype of Service" }).selectOption("web-app@0.1.0");
  await review.getByRole("button", { name: "Discard and change subtype" }).click();
  await expect(service).toContainText("Web app");
  await expect
    .poll(async () => (await designOf(request, project)).design.elements[0]?.attachments.length)
    .toBe(0);
  expect((await designOf(request, project)).design.connections).toHaveLength(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(service.locator("[data-attachment-id]")).toHaveCount(1);
  await page.reload();
  await expect(service).toBeVisible();
  expect((await designOf(request, project)).design.connections).toHaveLength(1);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("outer connections infer a single pair, expose ambiguity, and validate native reconnection", async ({
  page,
  request,
}) => {
  const project = await openNewProject(page, request, "P3 connections");
  const pane = page.locator(".react-flow__pane");
  for (const [index, [x, y, subtype]] of (
    [
      [270, 280, "web-app"],
      [730, 280, "http-service"],
      [730, 600, "http-service"],
    ] as const
  ).entries()) {
    await page.getByRole("button", { name: "Service", exact: true }).click();
    await pane.click({ position: { x, y } });
    await expect(page.locator("[data-element-id]")).toHaveCount(index + 1);
    const service = page.locator("[data-element-id]").nth(index);
    await service.getByRole("combobox").selectOption(subtype + "@0.1.0");
    await service.locator(".element-card-head").click();
    await service
      .getByRole("button", {
        name: subtype === "web-app" ? "Add REST API client" : "Add REST API server",
        exact: true,
      })
      .click();
  }
  const services = page.locator("[data-element-id]");
  const source = services.nth(0);
  const target = services.nth(1);
  const peer = services.nth(2);
  const drag = async (
    from: ReturnType<typeof page.locator>,
    to: ReturnType<typeof page.locator>,
  ) => {
    const a = await from.boundingBox(),
      b = await to.boundingBox();
    expect(a && b).toBeTruthy();
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
    await page.mouse.down();
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 12 });
    await page.mouse.up();
  };
  await drag(source.locator('[data-handleid="out"]'), target.locator('[data-handleid="in"]'));
  await expect
    .poll(async () => (await designOf(request, project)).design.connections.length)
    .toBe(1);
  const saved = (await request.get("/api/projects/" + project + "/design")).json();
  const state = await saved;
  expect(state.design.schemaVersion).toBe(2);
  expect(state.design.connections[0].from).toEqual({ element: "service" });
  expect(state.design.connections[0].config.fromCapability).toBeTruthy();
  // Native React Flow reconnection, validated by the same connection planner.
  {
    const edge = page.locator(".react-flow__edge-interaction");
    const point = await edge.evaluate((node) => {
      const path = node as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const screen = p.matrixTransform(path.getScreenCTM()!);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
  }
  await drag(page.locator(".react-flow__edgeupdater-target"), peer.locator('[data-handleid="in"]'));
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/projects/" + project + "/design")).json()).design
          .connections[0].to.element,
    )
    .toBe(await peer.getAttribute("data-element-id"));
  // The API can commit before the editor receives its response. Wait for the actual reconnected
  // edge to render before calculating its click position; otherwise we click the old path.
  await expect(
    page.getByRole("group", {
      name: `Edge from ${await source.getAttribute("data-element-id")} to ${await peer.getAttribute("data-element-id")}`,
      exact: true,
    }),
  ).toBeVisible();
  {
    const edge = page.locator(".react-flow__edge-interaction");
    const point = await edge.evaluate((node) => {
      const path = node as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const screen = p.matrixTransform(path.getScreenCTM()!);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(point.x, point.y);
  }
  await page.getByRole("button", { name: "Delete connection", exact: true }).click();
  await source.locator(".element-card-head").click();
  await source.getByRole("button", { name: "Add REST API client", exact: true }).click();
  await drag(source.locator('[data-handleid="out"]'), target.locator('[data-handleid="in"]'));
  const choices = page.getByRole("region", { name: "Connection choices" });
  await expect(choices.getByRole("button")).toHaveCount(2);
  await choices.getByRole("button").nth(1).click();
  await expect
    .poll(async () => (await designOf(request, project)).design.connections.length)
    .toBe(1);
});

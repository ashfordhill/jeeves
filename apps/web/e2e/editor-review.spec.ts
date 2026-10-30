/** Architecture spike: actual engines, mouse gestures, no model or project state. */
import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

async function drag(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error("missing drag endpoints");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("React Flow service hierarchy, outer connections, resize and reconnect", async ({ page }) => {
  await page.goto("/editor-review.html");
  const inspector = page.locator("aside");
  const service = page.locator('.react-flow__node[data-id="service"]');
  const web = page.locator('.react-flow__node[data-id="web"]');
  const database = page.locator('.react-flow__node[data-id="database"]');
  await service.getByLabel("Service subtype").selectOption("http-service");
  await inspector.getByLabel("REST server", { exact: true }).check();
  await expect(service.getByText("REST server", { exact: true })).toBeVisible();
  // Components have no handles; the outer service has the only pair.
  await expect(service.locator(".react-flow__handle")).toHaveCount(2);
  await expect(service.locator("li .react-flow__handle")).toHaveCount(0);
  await inspector.getByLabel("Service subtype").selectOption("web-app");
  await page.getByRole("button", { name: "Keep subtype" }).click();
  await expect(inspector.getByLabel("Service subtype")).toHaveValue("http-service");
  await expect(service.getByText("REST server", { exact: true })).toBeVisible();
  await drag(page, web.locator('[data-handleid="out"]'), service.locator('[data-handleid="in"]'));
  await expect(page.locator('.react-flow__edge[data-id="connection-1"]')).toBeVisible();

  // Native resize follows the mouse and keeps the edge attached to the outer shape.
  await service.locator("strong").click();
  const before = await service.boundingBox();
  const corner = service.locator(".react-flow__resize-control.bottom.right.handle");
  const box = await corner.boundingBox();
  if (!box || !before) throw new Error("missing resize control");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 55, box.y + 45, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await service.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width + 20);

  // Add another compatible HTTP service for reconnection.
  await page.getByRole("button", { name: "Add Service rectangle" }).click();
  await inspector.getByLabel("Service subtype").selectOption("http-service");
  await inspector.getByLabel("REST server", { exact: true }).check();
  const peer = page.locator('.react-flow__node[data-id="service-3"]');
  // React Flow exposes native reconnection handles when the edge is selected.
  const edge = page.locator('.react-flow__edge[data-id="connection-1"]');
  await edge.locator(".react-flow__edge-interaction").click({ force: true });
  await drag(
    page,
    edge.locator(".react-flow__edgeupdater-target"),
    peer.locator('[data-handleid="in"]'),
  );
  await page.getByText("Geometry and connections", { exact: true }).click();
  await expect(page.getByLabel("Review state")).toContainText('"target": "service-3"');
  await expect(database.locator(".database")).toBeVisible();

  await page.getByRole("button", { name: "Add Service rectangle" }).click();
  await expect(inspector.getByLabel("Service subtype")).toHaveValue("unselected");
  await inspector.getByLabel("Service subtype").selectOption("web-app");
  await inspector.getByLabel("REST client", { exact: true }).check();
  await inspector.getByLabel("Service subtype").selectOption("http-service");
  await page.getByRole("button", { name: "Discard and change" }).click();
  await expect(inspector.getByLabel("REST client", { exact: true })).not.toBeChecked();
});

test("Excalidraw renders grouped service components with an external subtype inspector", async ({
  page,
}) => {
  await page.goto("/editor-review.html");
  await page.getByLabel("Engine", { exact: true }).selectOption("excalidraw");
  await expect(page.locator(".excalidraw canvas").first()).toBeVisible();
  const inspector = page.locator("aside");
  await inspector.getByLabel("Service subtype").selectOption("http-service");
  await inspector.getByLabel("REST server", { exact: true }).check();
  await expect(inspector.getByLabel("REST server", { exact: true })).toBeChecked();
  await page.screenshot({ path: "test-results/editor-review-excalidraw.png" });
  // Native canvas hit testing selects a grouped service and drives our separate inspector.
  await inspector.getByLabel("Selection", { exact: true }).selectOption("web");
  await page.mouse.click(100, 260);
  await expect(inspector.getByLabel("Selection", { exact: true })).toHaveValue("service");

  // Native arrow gestures expose the actual shape IDs chosen by Excalidraw's binding logic.
  await page.getByRole("radio", { name: "Arrow", exact: true }).locator("..").click();
  await page.mouse.move(365, 400);
  await page.mouse.down();
  await page.mouse.move(645, 400, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByLabel("Native arrow bindings")).toContainText("service → database");
  // Click the selection tool, select the arrow, then move its endpoint to the web service.
  await page.getByRole("radio", { name: "Selection", exact: true }).locator("..").click();
  await page.mouse.click(500, 400);
  await page.mouse.move(645, 400);
  await page.mouse.down();
  await page.mouse.move(365, 640, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByLabel("Native arrow bindings")).toContainText("service → web");

  // Grouping alone does not enforce Jeeves's outer-only endpoint rule.
  await page.getByRole("radio", { name: "Arrow", exact: true }).locator("..").click();
  await page.mouse.move(345, 353);
  await page.mouse.down();
  await page.mouse.move(645, 500, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByLabel("Native arrow bindings")).toContainText("service-component-0");
  await page.getByRole("radio", { name: "Selection", exact: true }).locator("..").click();

  await page.getByText("Native geometry", { exact: true }).click();
  const nativeState = page.getByRole("img", { name: "Native geometry" });

  // Resize the grouped service using Excalidraw's native corner control.
  await page.mouse.click(359, 260);
  await page.mouse.move(364, 444);
  await page.mouse.down();
  await page.mouse.move(410, 480, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const elements = JSON.parse(await nativeState.innerText()) as { id: string; width: number }[];
      return elements.find((element) => element.id === "service")?.width ?? 0;
    })
    .toBeGreaterThan(300);
  await page.screenshot({ path: "test-results/editor-review-excalidraw.png" });
});

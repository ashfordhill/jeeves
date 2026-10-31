import { expect, test } from "./browser-test.ts";
import { designOf, layoutOf, openNewProject } from "./helpers.ts";

test.use({ viewport: { width: 1600, height: 1000 }, actionTimeout: 10_000 });

test("creation over an existing subtype cannot add, edit, or move that card", async ({
  page,
  request,
}) => {
  const project = await openNewProject(page, request, "P13 placement");
  const pane = page.locator(".react-flow__pane");
  await page.getByRole("button", { name: "Service", exact: true }).click();
  await pane.click({ position: { x: 180, y: 330 } });
  const service = page.locator('[data-element-id="service"]');
  const subtype = service.getByRole("combobox");
  await subtype.selectOption("web-app@0.1.0");
  await service.locator(".element-card-head").click();
  await service.getByRole("button", { name: "Add REST API client", exact: true }).click();
  await expect(service.locator("[data-attachment-id]")).toHaveCount(1);
  await expect.poll(async () => (await layoutOf(request, project)).items.service).toBeTruthy();
  const before = (await designOf(request, project)).design;
  const position = (await layoutOf(request, project)).items.service;

  await page.getByRole("button", { name: "Service", exact: true }).click();
  await expect(subtype).toBeDisabled();
  await expect(service.locator(".react-flow__resize-control")).toHaveCount(0);
  const box = await subtype.boundingBox();
  if (!box) throw new Error("Subtype control is missing");
  // Real pointer events reproduce the GIF, including clicking over the disabled control.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByText("Click empty board space to place the new item.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-element-id]")).toHaveCount(1);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Cancel tool", exact: true }).click();
  expect((await designOf(request, project)).design).toEqual(before);
  expect((await layoutOf(request, project)).items.service).toEqual(position);

  await subtype.selectOption("http-service@0.1.0");
  const review = page.getByRole("dialog", { name: "Change service subtype?" });
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await designOf(request, project)).design).toEqual(before);
  await expect(review).not.toBeVisible();

  await page.getByRole("button", { name: "Elements", exact: true }).click();
  await page
    .getByRole("button", { name: /^PostgreSQL/ })
    .dragTo(service, { targetPosition: { x: 15, y: 15 } });
  await expect(
    page.getByText("Drop the new item onto empty board space.", { exact: true }),
  ).toBeVisible();
  expect((await designOf(request, project)).design).toEqual(before);

  await page.getByRole("button", { name: "Service", exact: true }).click();
  await pane.click({ position: { x: 780, y: 330 } });
  await expect(page.locator("[data-element-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-element-id]")).toHaveCount(1);
  expect((await designOf(request, project)).design.elements).toEqual(before.elements);
});

test("selection keeps card geometry stable and opening the inspector fits the board", async ({
  page,
  request,
}) => {
  const project = await openNewProject(page, request, "P13 camera");
  await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
  const pane = page.locator(".react-flow__pane");
  for (const x of [300, 1200]) {
    await page.getByRole("button", { name: "Elements", exact: true }).click();
    await page.getByRole("button", { name: /^HTTP service/ }).click();
    await pane.click({ position: { x, y: 330 } });
  }
  const cards = page.locator("[data-element-id]");
  await expect(cards).toHaveCount(2);
  const first = cards.first();
  const unselected = await first.boundingBox();
  await first.locator(".element-card-head").click();
  await expect(first.getByRole("group", { name: "Compatible components" })).toBeVisible();
  expect(await first.boundingBox()).toEqual(unselected);
  await first.getByRole("button", { name: "Add REST API server", exact: true }).click();
  await expect(first.locator("[data-attachment-id]")).toHaveCount(1);
  const selected = await first.boundingBox();
  await pane.click({ position: { x: 500, y: 700 } });
  expect(await first.boundingBox()).toEqual(selected);
  await expect
    .poll(async () => Object.keys((await layoutOf(request, project)).items).length)
    .toBe(2);
  const before = (await designOf(request, project)).design;
  const positions = (await layoutOf(request, project)).items;

  await page.getByRole("button", { name: "Show inspector", exact: true }).click();
  await expect
    .poll(async () => {
      const canvas = await page.locator(".draw-board").boundingBox();
      if (!canvas) return false;
      for (const card of await cards.all()) {
        const bounds = await card.boundingBox();
        if (
          !bounds ||
          bounds.x < canvas.x ||
          bounds.y < canvas.y ||
          bounds.x + bounds.width > canvas.x + canvas.width ||
          bounds.y + bounds.height > canvas.y + canvas.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
  expect((await designOf(request, project)).design).toEqual(before);
  expect((await layoutOf(request, project)).items).toEqual(positions);
});

test("placement keeps annotation controls inert and permits a service inside a frame", async ({
  page,
  request,
}) => {
  const project = await openNewProject(page, request, "P13 annotations");
  const pane = page.locator(".react-flow__pane");
  await page.getByRole("button", { name: "Frame", exact: true }).click();
  await pane.click({ position: { x: 300, y: 260 } });
  const frame = page.getByRole("article", { name: "Frame", exact: true });
  await page.getByRole("button", { name: "Service", exact: true }).click();
  await frame.click({ position: { x: 240, y: 130 } });
  await expect(page.locator("[data-element-id]")).toHaveCount(1);

  await page.getByRole("button", { name: "Sticky note", exact: true }).click();
  await pane.click({ position: { x: 900, y: 350 } });
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const note = page.getByRole("article", { name: "Sticky note", exact: true });
  await note.click();
  await expect(note.locator(".react-flow__resize-control.handle")).toHaveCount(4);
  const before = (await designOf(request, project)).design;
  await page.getByRole("button", { name: "Service", exact: true }).click();
  await expect(note.locator(".react-flow__resize-control")).toHaveCount(0);
  await note.dblclick();
  await expect(note.getByRole("textbox")).toHaveCount(0);
  await expect(page.locator("[data-element-id]")).toHaveCount(1);
  expect((await designOf(request, project)).design).toEqual(before);
  await page.getByRole("button", { name: "Cancel tool", exact: true }).click();
  await expect(note.locator(".react-flow__resize-control.handle")).toHaveCount(4);
});

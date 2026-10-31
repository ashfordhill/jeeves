import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { card, designOf, layoutOf, openNewProject } from "./helpers.ts";

test("builds a service + REST server + Postgres board that survives a reload", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E board");
  const pane = page.locator(".react-flow__pane");

  // Click-to-place: pick the template, then click the board.
  await page.getByRole("button", { name: "Elements" }).click();
  await page.getByRole("button", { name: /^HTTP service/ }).click();
  await pane.click({ position: { x: 420, y: 480 } });
  const service = card(page, "HTTP service, HTTP service");
  await expect(service).toBeVisible();
  // Establish the selected-card camera before beginning a native drag.
  await service.locator(".element-card-name").click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();

  // Drag-to-attach: drop the REST server attachment onto the service card.
  await page.getByRole("button", { name: "Attachments" }).click();
  await page
    .getByRole("button", { name: /^REST API server/ })
    .dragTo(service, { targetPosition: { x: 15, y: 15 } });
  await expect(service.getByRole("listitem", { name: "REST API server" })).toBeVisible();

  // Drag-to-place: drop Postgres onto empty board.
  await page.getByRole("button", { name: "Elements" }).click();
  await page
    .getByRole("button", { name: /^PostgreSQL/ })
    .dragTo(pane, { targetPosition: { x: 900, y: 480 } });
  const db = card(page, "PostgreSQL, PostgreSQL");
  await expect(db).toBeVisible();

  // Connector tool: click the service, then the database.
  await page.getByRole("button", { name: "Connector" }).click();
  await service.click();
  await db.click();
  await expect(page.locator(".connection-chip", { hasText: "Reads and writes" })).toBeVisible();

  const saved = await designOf(request, id);
  expect(saved.design.elements.map((e) => e.id)).toEqual(["http-service", "postgresql"]);
  expect(saved.design.elements[0]?.attachments).toHaveLength(1);
  expect(saved.design.connections).toEqual([expect.objectContaining({ kind: "uses-database" })]);

  const transformOf = (name: string) =>
    page.locator(".react-flow__node", { has: card(page, name) }).getAttribute("style");
  const serviceStyle = await transformOf("HTTP service, HTTP service");
  await expect
    .poll(async () => Object.keys((await layoutOf(request, id)).items).sort())
    .toEqual(["http-service", "postgresql"]);

  await page.reload();
  await expect(service).toBeVisible();
  await expect(db).toBeVisible();
  await expect(service.getByRole("listitem", { name: "REST API server" })).toBeVisible();
  await expect(page.locator(".connection-chip", { hasText: "Reads and writes" })).toBeVisible();
  expect(await transformOf("HTTP service, HTTP service")).toBe(serviceStyle);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("refuses an incompatible connection with an explanation", async ({ page, request }) => {
  const id = await openNewProject(page, request, "E2E refusal");
  const pane = page.locator(".react-flow__pane");

  for (const [name, x] of [
    ["HTTP service", 420],
    ["PostgreSQL", 900],
  ] as const) {
    await page.getByRole("button", { name: "Elements" }).click();
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await pane.click({ position: { x, y: 320 } });
  }
  const service = card(page, "HTTP service, HTTP service");
  const db = card(page, "PostgreSQL, PostgreSQL");
  await expect(db).toBeVisible();
  const before = (await designOf(request, id)).design.revision;

  // Database → service runs against the uses-database port's direction.
  await page.getByRole("button", { name: "Connector" }).click();
  await db.click();
  await service.click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText(`"PostgreSQL" can't start a "uses-database" connection`);
  await expect(page.locator(".connection-chip")).toHaveCount(0);
  expect((await designOf(request, id)).design.revision).toBe(before);

  // The suggested fix connects the right way round.
  await alert.getByRole("button", { name: /Connect from "HTTP service"/ }).click();
  await expect(page.locator(".connection-chip", { hasText: "Reads and writes" })).toBeVisible();
  expect((await designOf(request, id)).design.revision).toBe(before + 1);
});

test("dragging a node saves layout without changing the semantic revision", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E drag");
  await page
    .getByRole("button", { name: "Sticky note" })
    .dragTo(page.locator(".react-flow__pane"), {
      targetPosition: { x: 300, y: 300 },
    });
  await expect(page.locator(".note-annotation")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.getByRole("button", { name: "Elements" }).click();
  await page.getByRole("button", { name: /^HTTP service/ }).click();
  await page.locator(".react-flow__pane").click({ position: { x: 750, y: 150 } });
  const service = card(page, "HTTP service, HTTP service");
  await expect(service).toBeVisible();
  await expect.poll(async () => (await layoutOf(request, id)).items["http-service"]).toBeTruthy();

  const revision = (await designOf(request, id)).design.revision;
  const start = (await layoutOf(request, id)).items["http-service"];
  const box = await service.boundingBox();
  if (!box || !start) throw new Error("service card not laid out");

  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/projects/${id}/layout`) && r.request().method() === "PUT",
  );
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140, { steps: 8 });
  await page.mouse.up();
  await saved;

  const moved = (await layoutOf(request, id)).items["http-service"];
  expect(moved?.x).not.toBe(start.x);
  expect(moved?.y).not.toBe(start.y);
  expect((await designOf(request, id)).design.revision).toBe(revision);
});

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { inspectObject, openNewProject } from "./helpers.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/designs/event-orders.json", import.meta.url), "utf8"),
);
test("durable event contracts edit by mouse with validation, cancel, undo and real C4 binding", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "Event configuration proof");
  const response = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      ops: [
        ...fixture.elements.map((element: unknown) => ({ op: "addElement", element })),
        ...fixture.connections.map((connection: unknown) => ({ op: "connect", connection })),
      ],
    },
  });
  expect(response.status()).toBe(200);
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const before = await read();
  await page.reload();
  await page.getByRole("button", { name: "C1 Context", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
  await workspace
    .getByRole("navigation", { name: "Architecture levels" })
    .getByRole("button", { name: /Containers/ })
    .click();
  const details = workspace.getByRole("complementary", { name: "Architecture details" });
  await inspectObject(page, "container:orders");
  await details.getByRole("button", { name: "Open components" }).click();
  await inspectObject(page, "component:orders:order-delivery");
  await expect(details.getByText(/One worker in this service process/)).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "Inspect Orders database", exact: true }),
  ).toBeVisible();
  await inspectObject(page, "component:orders:order-delivery:event:order-placed");
  await expect(details.getByText("ORDER-01", { exact: true })).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: "test-results/p22-components.png", animations: "disabled" });
  await details.getByText("Technical details", { exact: true }).click();
  await details.getByRole("button", { name: "Open in C2" }).click();
  await page.getByRole("button", { name: "Configure durable events", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Configure durable events" });
  await dialog.getByLabel("Retry preset").selectOption("standard");
  await expect(dialog.getByRole("status")).toContainText("5 attempts");
  await dialog.getByLabel("Event 1 ID", { exact: true }).fill("Invalid ID");
  await expect(dialog.getByRole("button", { name: "Save event configuration" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await read()).toEqual(before);

  await page.getByRole("button", { name: "Configure durable events", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure durable events" });
  await expect(dialog.getByLabel("Event 1 ID", { exact: true })).toHaveValue("order-placed");
  await dialog.getByLabel("Retry preset").selectOption("standard");
  await dialog.getByRole("button", { name: "Add event contract", exact: true }).click();
  await dialog.getByLabel("Event 2 ID", { exact: true }).fill("order-approved");
  await dialog.getByLabel("Event 2 type", { exact: true }).fill("order.approved");
  await dialog.getByLabel("Event 2 field 1 kind", { exact: true }).selectOption("enum");
  await dialog.getByLabel("Field 1 choices for event 2", { exact: true }).fill("manual, automatic");
  await dialog.getByRole("button", { name: "Add field to event 2" }).click();
  await dialog.getByLabel("Event 2 field 2 kind", { exact: true }).selectOption("boolean");
  await dialog.getByText("Verification metadata", { exact: true }).click();
  await dialog.getByLabel("Event 2 acceptance references", { exact: true }).fill("ORDER-02");
  await dialog
    .getByLabel("Event 2 business effect", { exact: true })
    .fill("Record an approved order once.");
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: "test-results/p22-event-editor.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Save event configuration" }).click();
  await expect(dialog).not.toBeVisible();
  const changed = await read();
  expect(changed.revision).toBe(before.revision + 1);
  const config = changed.elements[0].attachments[0].config;
  expect(config.preset).toBe("standard");
  expect(config.events).toHaveLength(2);
  expect(config.events[1].fields[0].choices).toEqual(["manual", "automatic"]);
  expect(config.events[1].fields[1].type).toBe("boolean");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await read()).elements[0].attachments[0].config)
    .toEqual(before.elements[0].attachments[0].config);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await page.locator('[data-element-id="orders"]').click();
  await page.getByRole("button", { name: "Configure durable events", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure durable events" });
  await expect(dialog.getByLabel("Retry preset")).toHaveValue("standard");
  await dialog.getByRole("button", { name: "Edit event 2: order.approved", exact: true }).click();
  await expect(dialog.getByLabel("Event 2 ID", { exact: true })).toHaveValue("order-approved");
  await page.setViewportSize({ width: 900, height: 760 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({
    path: "test-results/p22-event-editor-narrow.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("a new service can add and configure an event attachment before its database is connected", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "New event capability");
  await page.getByRole("button", { name: "Elements", exact: true }).click();
  await page.getByRole("button", { name: /^HTTP service/ }).click();
  await page.locator(".react-flow__pane").click({ position: { x: 350, y: 250 } });
  await page
    .getByRole("article", { name: "HTTP service, HTTP service", exact: true })
    .locator(".element-card-head")
    .click();
  await page.getByRole("button", { name: "Add attachment", exact: true }).click();
  await page.getByRole("menuitem", { name: "Durable events", exact: true }).click();
  await page.getByRole("button", { name: "Configure durable events", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure durable events" });
  await dialog.getByRole("button", { name: "Save event configuration" }).click();
  await expect(dialog).not.toBeVisible();
  const { design } = await (await request.get(`/api/projects/${id}/design`)).json();
  expect(design.elements[0].template.version).toBe("0.4.0");
  expect(design.elements[0].attachments[0].config.events[0].type).toBe("domain.event-1");
  await expect(
    page.getByText("Durable events require one Postgres connection from this service.", {
      exact: true,
    }),
  ).toBeVisible();
});

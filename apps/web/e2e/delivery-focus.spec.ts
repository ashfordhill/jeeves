import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/designs/event-orders.json", import.meta.url), "utf8"),
);

test("focused event and payload drafts survive switching, expose hidden errors and retain stale edits for cancellation", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "Focused delivery authoring");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...fixture.elements.map((element: unknown) => ({ op: "addElement", element })),
              ...fixture.connections.map((connection: unknown) => ({ op: "connect", connection })),
            ],
          },
        })
      ).status(),
    ).toBe(200);
    const before = await read();
    await page.reload();
    await page.locator('[data-element-id="orders"] .element-card-head').click();
    const open = page.getByRole("button", { name: "Configure durable events", exact: true });
    const dialog = page.getByRole("dialog", { name: "Configure durable events", exact: true });
    await open.click();
    await expect(dialog.getByLabel("Event 1 field 1 name", { exact: true })).toHaveValue("orderId");
    await expect(dialog.getByLabel("Event 1 field 2 name", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Add event contract", exact: true }).click();
    await dialog.getByLabel("Event 2 ID", { exact: true }).fill("shipment-sent");
    await dialog.getByLabel("Event 2 type", { exact: true }).fill("shipment.sent");
    await dialog.getByRole("button", { name: "Add field to event 2", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 field 2 name", { exact: true })).toHaveValue("field1");
    await dialog.getByRole("button", { name: "Add field to event 2", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 field 3 name", { exact: true })).toHaveValue("field2");
    await dialog.getByRole("button", { name: "Edit event 2 field 2: field1", exact: true }).click();
    await dialog.getByRole("button", { name: "Remove field 2 from event 2", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 field 2 name", { exact: true })).toHaveValue("field2");
    await dialog.getByRole("button", { name: "Add field to event 2", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 field 3 name", { exact: true })).toHaveValue("field1");
    await dialog.getByRole("button", { name: "Edit event 2 field 2: field2", exact: true }).click();
    const name = dialog.getByLabel("Event 2 field 2 name", { exact: true });
    await name.fill("");
    await name.pressSequentially("deliveryStatus");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("deliveryStatus");
    await dialog.getByLabel("Event 2 field 2 kind", { exact: true }).selectOption("enum");
    await dialog
      .getByLabel("Field 2 choices for event 2", { exact: true })
      .fill("pending, pending");
    await dialog
      .getByRole("button", { name: "Edit event 2 field 1: referenceId", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Edit event 1: order.placed", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Save event configuration", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", {
        name: "Edit event 2: shipment.sent, needs review",
        exact: true,
      }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Review 1 issue", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 field 2 name", { exact: true })).toHaveValue(
      "deliveryStatus",
    );
    await dialog
      .getByLabel("Field 2 choices for event 2", { exact: true })
      .fill("pending, complete");
    await dialog
      .getByLabel("Event 2 business effect", { exact: true })
      .fill("Record one shipment state transition using context.effect.");
    await dialog.getByText("Verification metadata", { exact: true }).click();
    await dialog.getByLabel("Event 2 acceptance references", { exact: true }).fill("SHIPMENT-01");
    await dialog.getByRole("button", { name: "Add event contract", exact: true }).click();
    await expect(dialog.getByLabel("Event 3 ID", { exact: true })).toHaveValue("event-1");
    await dialog.getByRole("button", { name: "Remove contract for event 3", exact: true }).click();
    await expect(dialog.getByLabel("Event 2 ID", { exact: true })).toHaveValue("shipment-sent");
    // Each event remembers the previously inspected payload field within this draft.
    await expect(dialog.getByLabel("Event 2 field 2 name", { exact: true })).toHaveValue(
      "deliveryStatus",
    );
    expect(await read()).toEqual(before);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: "test-results/p34-event-desktop.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Save event configuration", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const saved = await read(),
      config = saved.elements[0].attachments[0].config;
    expect(saved.revision).toBe(before.revision + 1);
    expect(config.events[0]).toEqual(before.elements[0].attachments[0].config.events[0]);
    expect(config.events[1].fields.map((f: { name: string }) => f.name)).toEqual([
      "referenceId",
      "deliveryStatus",
      "field1",
    ]);
    expect(config.events[1].fields[1]).toEqual({
      name: "deliveryStatus",
      type: "enum",
      choices: ["pending", "complete"],
    });
    expect(config.events[1].acceptance).toEqual(["SHIPMENT-01"]);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 520, height: 820 });
    await open.click();
    await dialog.getByRole("button", { name: "Edit event 2: shipment.sent", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Edit event 2 field 2: deliveryStatus", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Save event configuration", exact: true }),
    ).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p34-event-narrow-dark.png",
      animations: "disabled",
    });
    await dialog
      .getByLabel("Event 2 business effect", { exact: true })
      .fill("Retain this unsaved business effect during a stale refusal.");
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: saved.revision,
            ops: [{ op: "updateElement", id: "orders", name: "Orders service" }],
          },
        })
      ).status(),
    ).toBe(200);
    const stale = browserProblems.expectHttp({
      scenario: "stale focused event draft",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await dialog.getByRole("button", { name: "Save event configuration", exact: true }).click();
    await expect(dialog.getByText(/board was reloaded/)).toBeVisible();
    stale.finish();
    await expect(dialog.getByLabel("Event 2 business effect", { exact: true })).toHaveValue(
      "Retain this unsaved business effect during a stale refusal.",
    );
    await dialog.getByRole("button", { name: "Save event configuration", exact: true }).click();
    await expect(dialog.getByText(/design changed while this draft was open/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await read()).elements[0].attachments[0].config).toEqual(config);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

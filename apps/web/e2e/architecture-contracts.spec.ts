import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { DesignDocument } from "@jeeves/spec";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

async function seed(page: Page, request: APIRequestContext) {
  const design = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
      "utf8",
    ),
  ) as DesignDocument;
  const id = await openNewProject(page, request, "P47 contracts");
  const saved = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: 0,
      ops: [
        ...design.elements.map((element) => ({ op: "addElement", element })),
        ...design.connections.map((connection) => ({ op: "connect", connection })),
        { op: "setArchitecture", architecture: design.architecture },
      ],
    },
  });
  expect(saved.status()).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "C3 Components", exact: true }).click();
  await page.getByLabel("Component container").selectOption("qrwty");
  return id;
}
const modal = (page: Page) => page.getByRole("dialog", { name: "Manage interfaces", exact: true });
const details = (page: Page) => page.getByRole("complementary", { name: "Architecture details" });
async function open(page: Page, component: string) {
  await page.getByRole("button", { name: `Inspect ${component}`, exact: true }).click();
  await details(page).getByRole("button", { name: "Manage interfaces", exact: true }).click();
}
async function save(page: Page) {
  await modal(page).getByRole("button", { name: "Save interfaces", exact: true }).click();
  await expect(modal(page)).not.toBeVisible();
}

test("P47 mouse authors reusable commands and events with exact versions, history and explicit consumer updates", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await seed(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const before = await read();
    await open(page, "QR management");
    const dialog = modal(page);
    await dialog.getByRole("button", { name: "New definition", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Contract name", exact: true })
      .fill("UpdateDestination");
    await dialog.getByRole("button", { name: "Add operation", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Operation 1 name", exact: true })
      .fill("UpdateDestination");
    await dialog.getByRole("button", { name: "Add operation 1 input field", exact: true }).click();
    await dialog.getByLabel("Operation 1 input field 1 name", { exact: true }).fill("destination");
    await dialog
      .getByLabel("Operation 1 input field 1 type", { exact: true })
      .selectOption("http-url");
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Interface 1 name", exact: true })
      .fill("Update command");
    await dialog.getByRole("button", { name: "New definition", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Contract name", exact: true }).fill("VisitRecorded");
    await dialog.getByLabel("Contract kind", { exact: true }).selectOption("event");
    await dialog.getByRole("button", { name: "Add payload field", exact: true }).click();
    await dialog.getByLabel("Payload field 1 name", { exact: true }).fill("qrId");
    await dialog.getByLabel("Payload field 1 type", { exact: true }).selectOption("uuid");
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Interface 2 name", exact: true })
      .fill("Visit producer");
    await save(page);
    const authored = await read();
    expect(authored.revision).toBe(before.revision + 1);
    expect(authored.architecture?.contracts?.map((item) => item.name)).toEqual([
      "UpdateDestination",
      "VisitRecorded",
    ]);
    await open(page, "Analytics");
    await dialog
      .getByLabel("Definition", { exact: true })
      .selectOption({ label: "VisitRecorded · v1" });
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Interface 1 name", exact: true })
      .fill("Visit consumer");
    await dialog.getByLabel("Interface 1 direction", { exact: true }).selectOption("required");
    await expect(dialog).toContainText("required interface is unbound");
    await save(page);
    await expect(details(page)).toContainText("Requires: Visit consumer");
    const reused = await read();
    await open(page, "QR management");
    await dialog
      .getByLabel("Definition", { exact: true })
      .selectOption({ label: "VisitRecorded · v1" });
    await expect(dialog.getByLabel("Payload field 1 type", { exact: true })).toBeDisabled();
    await dialog
      .getByRole("textbox", { name: "Contract name", exact: true })
      .fill("Visit recorded");
    await save(page);
    expect((await read()).architecture?.interfaces).toEqual(reused.architecture?.interfaces);
    await open(page, "QR management");
    await dialog
      .getByLabel("Definition", { exact: true })
      .selectOption({ label: "Visit recorded · v1" });
    await dialog.getByRole("button", { name: "Create version", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Exact version", exact: true }).fill("v2");
    await dialog.getByRole("button", { name: "Add payload field", exact: true }).click();
    await dialog.getByLabel("Payload field 2 name", { exact: true }).fill("occurredAt");
    await dialog.getByLabel("Payload field 2 type", { exact: true }).selectOption("timestamp");
    await expect(dialog.getByRole("region", { name: "Consumer update preview" })).toContainText(
      "Visit consumer",
    );
    await dialog.getByLabel("Update selected instances to this version", { exact: true }).click();
    await page
      .getByRole("option", { name: "Visit consumer · analytics · v1", exact: true })
      .click();
    await dialog.getByLabel("Contract description", { exact: true }).click();
    await dialog.getByRole("region", { name: "Consumer update preview" }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/p47-consumer-preview-light.png",
      animations: "disabled",
    });
    await save(page);
    const versioned = await read();
    expect(versioned.architecture?.contracts?.map((item) => item.version)).toEqual([
      "v1",
      "v1",
      "v2",
    ]);
    expect(
      versioned.architecture?.interfaces?.find((item) => item.name === "Visit producer")?.contract
        .version,
    ).toBe("v1");
    expect(
      versioned.architecture?.interfaces?.find((item) => item.name === "Visit consumer")?.contract
        .version,
    ).toBe("v2");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).architecture?.contracts?.length).toBe(2);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("qrwty");
    await open(page, "Analytics");
    await dialog
      .getByLabel("Definition", { exact: true })
      .selectOption({ label: "Visit recorded · v2" });
    await expect(dialog.getByLabel("Interface 1 contract", { exact: true })).toHaveValue(
      `${versioned.architecture?.contracts?.[2]?.id}@v2`,
    );
    await page.screenshot({ path: "test-results/p47-versions-light.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await details(page).getByRole("button", { name: "Manage interfaces", exact: true }).click();
    await dialog
      .getByLabel("Definition", { exact: true })
      .selectOption({ label: "Visit recorded · v2" });
    await dialog
      .getByRole("textbox", { name: "Contract name", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p47-versions-dark.png", animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await dialog.getByLabel("Payload field 2 type", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p47-payload-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P47 source references stay read-only and become stale; Cancel and revision conflicts retain drafts", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(90_000);
  const id = await seed(page, request);
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await open(page, "QR management");
    const dialog = modal(page);
    await dialog.getByRole("button", { name: "New definition", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Contract name", exact: true })
      .fill("Saved update operation");
    await dialog
      .getByLabel("Definition source", { exact: true })
      .selectOption({ label: "qrwty API · update qr" });
    await expect(dialog.getByLabel("Contract kind", { exact: true })).toBeDisabled();
    await dialog.getByText("Current authoritative shape (read-only)", { exact: true }).click();
    await expect(dialog.locator(".contract-source").first()).toContainText("updateQr");
    await expect(dialog.getByRole("button", { name: "Add operation", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    const before = await read();
    await save(page);
    expect((await read()).elements).toEqual(before.elements);
    await open(page, "QR management");
    await dialog.getByRole("textbox", { name: "Contract name", exact: true }).fill("Discard me");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await open(page, "QR management");
    await expect(dialog.getByRole("textbox", { name: "Contract name", exact: true })).toHaveValue(
      "Saved update operation",
    );
    const current = await read();
    const attachment = current.elements[0]!.attachments[0]!;
    const config = structuredClone(attachment.config);
    const model = config.model as { resources: { fields: { maxLength?: number }[] }[] };
    model.resources[0]!.fields[1]!.maxLength = 121;
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "updateAttachment", id: attachment.id, config }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "P47 interface draft revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await dialog
      .getByRole("textbox", { name: "Contract name", exact: true })
      .fill("Retained draft");
    await dialog.getByRole("button", { name: "Save interfaces", exact: true }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Contract name", exact: true })).toHaveValue(
      "Retained draft",
    );
    conflict.finish();
    const concurrentSaved = await read();
    await dialog.getByRole("button", { name: "Save interfaces", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Your draft has been retained");
    expect(await read()).toEqual(concurrentSaved);

    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(details(page)).toContainText("source changed or was removed");
    await open(page, "QR management");
    await expect(dialog).toContainText("compatibility is unverified");
    await page.screenshot({ path: "test-results/p47-source-stale.png", animations: "disabled" });
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P47 container and external interfaces need no fabricated components and logical dataset drafts stay saveable", async ({
  page,
  request,
}) => {
  const id = await seed(page, request);
  try {
    await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
    await page.locator('[data-element-id="qrwty-db"] .element-card-name').click();
    await details(page).getByRole("button", { name: "Manage interfaces", exact: true }).click();
    const dialog = modal(page);
    await dialog.getByRole("button", { name: "New definition", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Contract name", exact: true }).fill("Link records");
    await dialog.getByLabel("Contract kind", { exact: true }).selectOption("data");
    await dialog.getByRole("button", { name: "Add payload field", exact: true }).click();
    await dialog.getByLabel("Payload field 1 name", { exact: true }).fill("tenantId");
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    await expect(dialog).toContainText("unresolved fields");
    await save(page);
    await expect(details(page)).toContainText("Provides: Link records");
    const saved = (await (await request.get(`/api/projects/${id}/design`)).json())
      .design as DesignDocument;
    expect(saved.architecture?.interfaces?.[0]?.owner).toEqual({ kind: "element", id: "qrwty-db" });
    expect(saved.architecture?.components).toHaveLength(5);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Destination website", exact: true }).click();
    await details(page).getByRole("button", { name: "Manage interfaces", exact: true }).click();
    await dialog.getByRole("button", { name: "Add interface", exact: true }).click();
    await dialog.getByLabel("Interface 1 direction", { exact: true }).selectOption("required");
    await dialog.getByLabel("Interface 1 use", { exact: true }).selectOption("optional");
    await save(page);
    const external = (await (await request.get(`/api/projects/${id}/design`)).json())
      .design as DesignDocument;
    expect(external.architecture?.interfaces?.[1]?.owner).toEqual({
      kind: "external-system",
      id: "destination",
    });
    expect(external.architecture?.components).toHaveLength(5);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

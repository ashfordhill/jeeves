import {
  applyOperations,
  buildStudioCommand,
  designGeneration,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { webhookDesign } from "../../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import {
  addModuleFrom,
  createStudy,
  design,
  dragOnto,
  expect,
  ready,
  stillBoard,
  test,
  tile,
} from "./studio.ts";

test("connects a webhook receiver and configures Stripe with blueprint and export parity by mouse", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG17 webhook", "blank");
  try {
    const source = webhookDesign();
    const changed = applyOperations(
      source,
      buildStudioCommand(source, { type: "removeModule", module: "receive-events" }).ops,
    );
    if (!changed.ok) throw Error("Cannot disconnect fixture");
    const generation = designGeneration(changed.design);
    if (!generation) throw Error("Missing generation");
    const ops = studioStudySeedOperations(changed.design);
    ops.push({ op: "setGeneration", generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await addModuleFrom(page, tile(page, "Events API"), "Webhook receiver");
    await ready(page);
    await expect
      .poll(async () =>
        (await design(page, id)).architecture?.studio?.components?.some(
          (c) => c.settings.kind === "webhook-receiver",
        ),
      )
      .toBe(true);
    const added = (
      (await design(page, id)).architecture?.studio?.components as unknown as
        | { id: string; settings: { kind: string } }[]
        | undefined
    )?.find((c) => c.settings.kind === "webhook-receiver");
    if (!added) throw Error("Mouse receiver addition failed");
    const receiverId = added.id;

    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator(
        `.board .lane-container-row[data-module="${receiverId}"] .lane-container-row-dot`,
      ),
      tile(page, "Event state"),
    );
    await page.mouse.up();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"kind":"webhook-receiver","state"');
    await stillBoard(page);
    await page
      .locator(`.board .lane-container-row[data-module="${receiverId}"]`)
      .getByRole("button")
      .first()
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.locator(".lane-module-status")).toHaveText("GeneratedWebhook receiver");
    const format = inspector.getByLabel("Signature format", { exact: true });
    await expect(format).toHaveValue("jeeves");
    await format.selectOption({ label: "Stripe" });
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"signatureFormat":"stripe"');
    await inspector.getByLabel("Body limit", { exact: true }).selectOption({ label: "256 KiB" });
    await inspector.getByLabel("Signature window (seconds)", { exact: true }).fill("60");
    await inspector.getByLabel("Name", { exact: true }).click();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"replayWindowSeconds":60');
    await expect(inspector.getByLabel("Retries", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("mouse-webhook.png"),
      fullPage: true,
    });
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(JSON.stringify(blueprint)).toContain('"signatureFormat":"stripe"');
    expect(JSON.stringify(blueprint)).toContain('"bodyLimitBytes":"262144"');
    expect(JSON.stringify(blueprint)).toContain('"replayWindowSeconds":60');
    await page.getByRole("button", { name: "Pointer", exact: true }).click();
    await addModuleFrom(page, tile(page, "Events API"), "Auth guard");
    await expect(page.getByRole("alert")).toContainText("Required user Auth guard");
    expect(
      (await design(page, id)).architecture?.studio?.components?.some(
        (c) => c.settings.kind === "auth-guard",
      ),
    ).toBe(false);
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    expect(result.report.settings).toContainEqual(
      expect.objectContaining({ input: "webhook.signatureFormat", value: "stripe" }),
    );
    const process = result.report.processes.tiles.find(
      (p: { tile: string }) => p.tile === "events-api",
    );
    expect(process.templates).toContainEqual({
      selection: receiverId,
      template: "webhook-receiver",
      level: "mounted",
    });
    expect(process.routes).toContainEqual(
      expect.objectContaining({ method: "POST", path: `/modules/${receiverId}` }),
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

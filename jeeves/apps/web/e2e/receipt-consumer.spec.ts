import {
  applyOperations,
  buildStudioCommand,
  designGeneration,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { receiptDesign } from "../../../../field-projects/generator-system/fixtures/rg-receipts/design.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("RG18 edits the receipt delivery horizon by mouse and exports guarded consumer operations", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG18 receipts", "blank");
  try {
    const original = receiptDesign();
    const link = original.architecture?.studio?.componentConnections?.find(
      (c) => c.from === "apply-item" && c.to.id === "items",
    );
    if (!link) throw Error("Missing state connection");
    const disconnected = applyOperations(
      original,
      buildStudioCommand(original, { type: "disconnectModule", link: link.id }).ops,
    );
    if (!disconnected.ok) throw Error("Cannot disconnect fixture");
    const source = disconnected.design;
    const generation = designGeneration(source);
    if (!generation) throw Error("Missing generation");
    const ops = studioStudySeedOperations(source);
    ops.push({ op: "setGeneration", generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await stillBoard(page);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="apply-item"] .lane-container-row-dot'),
      tile(page, "Items"),
    );
    await page.mouse.up();
    await expect
      .poll(async () =>
        (
          (await design(page, id)).architecture?.studio as unknown as {
            componentConnections?: { from: string; to: { id: string } }[];
          }
        )?.componentConnections?.some((c) => c.from === "apply-item" && c.to.id === "items"),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Pointer", exact: true }).click();
    await stillBoard(page);
    await page
      .locator('.board .lane-container-row[data-module="count-events"]')
      .getByRole("button")
      .first()
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.locator(".lane-module-status")).toHaveText("GeneratedEvent counter");
    await inspector.getByLabel("Maximum replay delay (seconds)", { exact: true }).fill("86400");
    await inspector.getByLabel("Name", { exact: true }).click();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"deliveryHorizonSeconds":86400');
    await page.screenshot({
      path: testInfo.outputPath("mouse-receipt-horizon.png"),
      fullPage: true,
    });
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(JSON.stringify(blueprint)).toContain('"deliveryHorizonSeconds":86400');
    await expect(inspector.getByLabel("Keep counted IDs (days)", { exact: true })).toHaveCount(0);
    await page
      .locator('.board .lane-container-row[data-module="apply-item"]')
      .getByRole("button")
      .first()
      .click();
    await inspector.getByLabel("Maximum replay delay (days)", { exact: true }).fill("31");
    await inspector.getByLabel("Name", { exact: true }).click();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"replayDays":31');
    await inspector.getByLabel("Keep counted IDs (days)", { exact: true }).fill("35");
    await inspector.getByLabel("Name", { exact: true }).click();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"receiptDays":35');
    await page.screenshot({
      path: testInfo.outputPath("mouse-consumer-retention.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

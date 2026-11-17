import { applyOperations, buildStudioCommand, studioStudySeedOperations } from "@jeeves/spec";
import { cacheReaderDesign } from "../../../../field-projects/generator-system/fixtures/rg-cache-reader/design.ts";
import { foundationsDesign } from "../../../../field-projects/generator-system/fixtures/rg-foundations/design.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("RG13 selects freshness/exposure and connects a callable cache read by mouse", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG13 reader", "blank");
  try {
    const source = cacheReaderDesign("immutable-positive", "http");
    const link = source.architecture?.studio?.componentConnections?.find(
      (c) => c.from === "read-record",
    );
    if (!link) throw Error("read link");
    const disconnected = applyOperations(
      source,
      buildStudioCommand(source, { type: "disconnectModule", link: link.id }).ops,
    );
    if (
      !disconnected.ok ||
      disconnected.design.schemaVersion !== 3 ||
      !disconnected.design.generation
    )
      throw Error("generation");
    const ops = studioStudySeedOperations(disconnected.design);
    ops.push({ op: "setGeneration", generation: disconnected.design.generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page
      .locator('.board .lane-container-row[data-module="preview-reader"]')
      .getByRole("button", { name: "Open Preview reader in Preview API", exact: true })
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.getByLabel("Freshness", { exact: true })).toHaveValue(
      "immutable-positive",
    );
    await inspector.getByLabel("Freshness", { exact: true }).selectOption("versioned");
    await inspector.getByLabel("Exposure", { exact: true }).selectOption("in-process");
    await expect(inspector.getByLabel("L1 TTL", { exact: true })).toHaveCount(0);
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"transport":"in-process"');
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="read-record"] .lane-container-row-dot'),
      page.locator('.board .lane-container-row[data-module="preview-reader"]'),
    );
    await page.mouse.up();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"read-record-preview-reader"');
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprint.services
        .find((s: { id: string }) => s.id === "preview-api")
        .components.find((c: { id: string }) => c.id === "preview-reader").settings,
    ).toMatchObject({ freshness: "versioned", transport: "in-process" });
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    expect(result.report.capabilities).toContainEqual(
      expect.objectContaining({
        contract: expect.objectContaining({ id: "cache-reader.read", effect: "read" }),
        transport: "in-process",
        caller: { kind: "public" },
      }),
    );
    expect(
      result.report.processes.tiles.find((p: { tile: string }) => p.tile === "preview-api").routes,
    ).not.toContainEqual(expect.objectContaining({ path: "/modules/preview-reader/:key" }));
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("RG14 refuses HTTP reader exposure on an internal host by mouse", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG14 internal reader", "blank");
  try {
    const source = foundationsDesign();
    if (source.schemaVersion !== 3 || !source.generation) throw Error("generation");
    const ops = studioStudySeedOperations(source);
    ops.push({ op: "setGeneration", generation: source.generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page
      .locator('.board .lane-container-row[data-module="record-reader"]')
      .getByRole("button", { name: "Open record-reader in Items API", exact: true })
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.getByLabel("Exposure", { exact: true })).toHaveValue("in-process");
    await inspector.getByLabel("Exposure", { exact: true }).selectOption("http");
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"transport":"http"');
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const refused = await preview;
    expect(refused.status()).toBe(422);
    const result = await refused.json();
    expect(result.code).toBe("UNSUPPORTED_SOURCE");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        message: expect.stringContaining(
          "internal service has no workload-authenticated template adapter",
        ),
      }),
    );
    await expect(
      page
        .getByText(
          "HTTP Cache reader exposure on an internal service has no workload-authenticated template adapter; select in-process and call it through an authenticated route module.",
        )
        .first(),
    ).toBeVisible();
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

import { buildStudioCommand, studioStudySeedOperations } from "@jeeves/spec";
import { rateLimiterDesign } from "../../../../field-projects/generator-system/fixtures/rg-rate-limiter/design.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("RG12 edits the consumed limiter settings and connects new-work admission by mouse", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG12 limiter", "blank");
  try {
    const source = rateLimiterDesign();
    const link = source.architecture?.studio?.componentConnections?.find(
      (c) => c.from === "create-item" && c.to.kind === "component",
    );
    if (!link) throw Error("admission link");
    const batch = buildStudioCommand(source, { type: "disconnectModule", link: link.id });
    // Seed only the fixture setup; edits and reconnection below use the real mouse controls.
    const { applyOperations } = await import("@jeeves/spec");
    const disconnected = applyOperations(source, batch.ops);
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
      .locator('.board .lane-container-row[data-module="create-limit"]')
      .getByRole("button", { name: "Open Create limit in Items API", exact: true })
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.locator(".lane-module-status")).toHaveText("GeneratedRate limiter");
    await expect(inspector.getByLabel("Limit per window", { exact: true })).toHaveValue("2");
    await inspector.getByLabel("Limit per window", { exact: true }).fill("5");
    await inspector.getByLabel("Window", { exact: true }).fill("120");
    await inspector.getByLabel("Name", { exact: true }).click();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"windowSeconds":120');
    await expect(inspector.getByLabel("Algorithm", { exact: true })).toHaveCount(0);
    await expect(inspector.getByLabel("Key", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="create-item"] .lane-container-row-dot'),
      page.locator('.board .lane-container-row[data-module="create-limit"]'),
    );
    await page.mouse.up();
    const blueprint = async () =>
      (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
    await expect
      .poll(async () =>
        (await blueprint()).componentLinks.some(
          (link: { id: string }) => link.id === "create-item-create-limit",
        ),
      )
      .toBe(true);
    const value = await blueprint();
    expect(
      value.services
        .find((service: { id: string }) => service.id === "items-api")
        .components.find((component: { id: string }) => component.id === "create-limit").settings,
    ).toMatchObject({
      limit: 5,
      windowSeconds: 120,
      algorithm: "sliding-window",
      key: "policy",
      store: "redis",
    });
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    expect(result.report.capabilities).toContainEqual(
      expect.objectContaining({
        contract: expect.objectContaining({ id: "rate-limiter.admit", effect: "read" }),
      }),
    );
    await page
      .getByRole("button", { name: "Close generate experimental project", exact: true })
      .click();
    const connect = page.getByRole("button", { name: "Connect", exact: true });
    if ((await connect.getAttribute("aria-pressed")) !== "true") await connect.click();
    await stillBoard(page);
    const beforeRefusal = (await design(page, id)).revision;
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="item-caller"] .lane-container-row-dot'),
      tile(page, "Admission cache"),
    );
    await expect(page.locator(".board-connect-tip")).toContainText(
      "LRU eviction; admission requires no eviction",
    );
    await page.mouse.up();
    await expect(page.locator(".studio-notice")).toContainText(
      "LRU eviction; admission requires no eviction",
    );
    expect((await design(page, id)).revision).toBe(beforeRefusal);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

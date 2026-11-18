import { designGeneration, studioStudySeedOperations } from "@jeeves/spec";
import { sessionForwardingDesign } from "../../../../field-projects/generator-system/fixtures/rg-session-forwarding/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("RG21 connects declared session callee by mouse with blueprint and export parity", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG21 forwarding", "blank");
  try {
    const complete = sessionForwardingDesign();
    const link = complete.architecture?.studio?.componentConnections?.find(
      (link) => link.from === "send" && link.to.id === "callee",
    );
    if (!link) throw Error("Missing call");
    const source = runStudioCommands(complete, [{ type: "disconnectModule", link: link.id }]);
    const generation = designGeneration(source);
    if (!generation) throw Error("Missing generation");
    const ops = studioStudySeedOperations(source);
    ops.push({ op: "setGeneration", generation });
    const seed = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seed.ok(), await seed.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="send"] .lane-container-row-dot'),
      tile(page, "Callee"),
    );
    await page.mouse.up();
    await expect
      .poll(async () => {
        const current = (await design(page, id)) as unknown as {
          architecture?: {
            studio?: { componentConnections?: { from: string; to: { id: string } }[] };
          };
        };
        return current.architecture?.studio?.componentConnections?.some(
          (link) => link.from === "send" && link.to.id === "callee",
        );
      })
      .toBe(true);
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprint.componentLinks.some(
        (entry: { from: string; to?: { id: string } }) =>
          entry.from === "send" && entry.to?.id === "callee",
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("mouse-session-forwarding.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    const callee = result.report.processes.tiles.find((p: { tile: string }) => p.tile === "callee");
    expect(callee.workloadCallers).toEqual(["caller"]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

import {
  applyOperations,
  buildStudioCommand,
  designGeneration,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { scheduledDesign } from "../../../../field-projects/generator-system/fixtures/rg-scheduled/design.ts";
import {
  createStudy,
  design,
  dragOnto,
  expect,
  pickFrom,
  ready,
  showView,
  stillBoard,
  test,
  tile,
} from "./studio.ts";

test("RG16 edits both task intervals and connects a queue-free timer Worker by mouse with export parity", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG16 schedules", "blank");
  try {
    const source = scheduledDesign();
    const link = source.architecture?.studio?.componentConnections?.find(
      (c) => c.from === "maintenance-worker-scheduled-task" && c.to.id === "state",
    );
    if (!link) throw Error("worker state link");
    const disconnected = applyOperations(
      source,
      buildStudioCommand(source, { type: "disconnectModule", link: link.id }).ops,
    );
    if (!disconnected.ok) throw Error("fixture disconnect");
    const generation = designGeneration(disconnected.design);
    if (!generation) throw Error("generation");
    const ops = studioStudySeedOperations(disconnected.design);
    ops.push({ op: "setGeneration", generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator(
        '.board .lane-container-row[data-module="maintenance-worker-scheduled-task"] .lane-container-row-dot',
      ),
      tile(page, "State"),
    );
    await page.mouse.up();
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"kind":"scheduled-task","state"');
    for (const [module, interval] of [
      ["service-task", "5"],
      ["maintenance-worker-scheduled-task", "300"],
    ] as const) {
      await stillBoard(page);
      await page
        .locator(`.board .lane-container-row[data-module="${module}"]`)
        .getByRole("button")
        .first()
        .click();
      const inspector = page.locator(".studio-inspector");
      await expect(inspector.locator(".lane-module-status")).toHaveText("GeneratedScheduled task");
      await inspector.getByLabel("Interval", { exact: true }).fill(interval);
      await inspector.getByLabel("Name", { exact: true }).click();
      await expect
        .poll(async () => JSON.stringify(await design(page, id)))
        .toContain(`"intervalSeconds":${interval}`);
      await expect(inspector.getByLabel("Retries", { exact: true })).toHaveCount(0);
    }
    await page.screenshot({
      path: testInfo.outputPath("mouse-task-controls.png"),
      fullPage: true,
    });
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(JSON.stringify(blueprint)).toContain('"intervalSeconds":300');
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    const worker = result.report.processes.tiles.find(
      (p: { tile: string }) => p.tile === "maintenance-worker",
    );
    expect(worker.loops).toEqual([]);
    expect(worker.schedules).toEqual([
      {
        module: "maintenance-worker-scheduled-task",
        intervalSeconds: 300,
        policy: "coalesce-current-one-outstanding",
      },
    ]);
    expect(
      result.report.processes.tiles.find((p: { tile: string }) => p.tile === "maintenance-api")
        .schedules[0].intervalSeconds,
    ).toBe(5);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.zip$/);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("RG16 creates an independent scheduled Worker from its lane menu by mouse", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG16 new timer Worker", "blank", "Simple");
  try {
    await pickFrom(page, "User", "Add action", "Consume");
    await ready(page);
    await stillBoard(page);
    await tile(page, "Consume").click();
    await pickFrom(page, "Consume", "Add linked tile", "Worker service");
    await expect(tile(page, "Worker service")).toBeVisible();
    await ready(page);
    const source = await design(page, id);
    expect(JSON.stringify(source)).toContain('"kind":"scheduled-task"');
    expect(JSON.stringify(source)).toContain('"processes":true');
    expect(JSON.stringify(source)).not.toContain('"kind":"queue"');
    await showView(page, "Detailed");
    await expect(
      page.locator(".board .lane-container-row").filter({ hasText: "Scheduled task" }),
    ).toHaveCount(1);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

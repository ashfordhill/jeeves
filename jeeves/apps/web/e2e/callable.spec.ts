/** RG05 mouse connection/refusal uses the same installed call contract as chat/export. */

import { studioStudySeedOperations } from "@jeeves/spec";
import { callableDesign } from "../../../../field-projects/generator-system/fixtures/rg05/design.ts";
import { runStudioCommands } from "../../../packages/spec/src/fixtures/v2-modules.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("Custom call connects only to complete Favorites by mouse and adds no capability endpoint", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E RG05 callable", "blank");
  try {
    const fixture = callableDesign();
    const link = fixture.architecture?.studio?.componentConnections?.find(
      (item) => item.from === "favorite-summary",
    );
    if (!link) throw Error("No call link");
    const seed = runStudioCommands(fixture, [{ type: "disconnectModule", link: link.id }]);
    const response = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops: studioStudySeedOperations(seed) },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    const row = (module: string) =>
      page.locator(`.board .lane-container-row[data-module="${module}"]`);
    const dot = row("favorite-summary").locator(".lane-container-row-dot");
    const before = await design(page, id);
    await dragOnto(page, dot, row("item-reader"));
    await expect(page.locator(".board-connect-tip")).toHaveText(
      "Favorite summary's call must be a Favorites.",
    );
    await page.mouse.up();
    await expect(page.locator(".studio-notice")).toHaveText(
      "Favorite summary's call must be a Favorites.",
    );
    await page.getByRole("button", { name: "Dismiss notice" }).click();
    expect((await design(page, id)).revision).toBe(before.revision);
    await dragOnto(page, dot, row("favorite-items"));
    await page.mouse.up();
    const arrow = tile(page, "Account API").locator(".lane-container-loader");
    await expect(
      arrow.getByRole("img", { name: "Favorite summary to Favorite items", exact: true }),
    ).toBeVisible();
    const saved = await design(page, id);
    expect(saved.revision).toBe(before.revision + 1);
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(blueprint.componentLinks).toContainEqual({
      id: "favorite-summary-favorite-items",
      service: "account-api",
      from: "favorite-summary",
      to: { kind: "component", id: "favorite-items" },
    });
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    // Study seeding preserves architecture, not generation options; enable the runnable consumer by mouse.
    const runnable = page.getByRole("checkbox", { name: "Runnable processes", exact: true });
    await expect(runnable).not.toBeChecked();
    await runnable.click();
    await expect(runnable).toBeChecked();
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/projects/${id}/design`)).json()).design.generation
            ?.processes,
      )
      .toBe(true);
    const preview = page.waitForResponse((res) =>
      res.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const generated = await (await preview).json();
    const report = generated.report;
    expect(
      report.processes.tiles
        .find((item: { tile: string }) => item.tile === "account-api")
        .routes.filter((route: { path: string }) =>
          route.path.startsWith("/modules/favorite-items"),
        ),
    ).toHaveLength(4);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

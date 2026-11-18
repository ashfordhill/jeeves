import { designGeneration, studioStudySeedOperations } from "@jeeves/spec";
import { browserSessionDesign } from "../../../../field-projects/generator-system/fixtures/rg-browser-session/design.ts";
import { addModuleFrom, createStudy, design, expect, ready, test, tile } from "./studio.ts";

test("RG19 browser sign-in expiry/guest/offline controls, refusal and export parity by mouse", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG19 browser sessions", "blank");
  try {
    const source = browserSessionDesign(),
      generation = designGeneration(source);
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
    await page
      .locator('.board .lane-container-row[data-module="sign-in"]')
      .getByRole("button")
      .first()
      .click();
    const inspector = page.locator(".studio-inspector");
    await expect(inspector.locator(".lane-module-status")).toHaveText("GeneratedBrowser sessions");
    await inspector.getByLabel("Sign-in", { exact: true }).selectOption("required");
    await inspector.getByLabel("Idle expiry", { exact: true }).fill("3600");
    await inspector.getByLabel("Name", { exact: true }).click();
    await inspector.getByLabel("Absolute expiry", { exact: true }).fill("86400");
    await inspector.getByLabel("Name", { exact: true }).click();
    await inspector.getByLabel("Guest cookie context", { exact: true }).selectOption("enabled");
    await inspector.getByLabel("Request offline access", { exact: true }).selectOption("enabled");
    await expect
      .poll(async () => JSON.stringify(await design(page, id)))
      .toContain('"offlineAccess":"enabled"');
    await page.screenshot({
      path: testInfo.outputPath("mouse-browser-session.png"),
      fullPage: true,
    });
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(JSON.stringify(blueprint)).toContain('"idleSeconds":3600');
    expect(JSON.stringify(blueprint)).toContain('"guestContext":"enabled"');
    await addModuleFrom(page, tile(page, "Browser API"), "Auth guard");
    await expect(page.getByRole("alert")).toContainText("Browser session");
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
    const process = result.report.processes.tiles.find(
      (p: { tile: string }) => p.tile === "browser-api",
    );
    expect(process.templates).toContainEqual({
      selection: "sign-in",
      template: "browser-session",
      level: "mounted",
    });
    expect(process.routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/modules/sign-in/callback" }),
    );
    expect(result.report.gaps.some((g: { id: string }) => g.id === "browser-issuer-sign-in")).toBe(
      true,
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

import { studioStudySeedOperations } from "@jeeves/spec";
import { frontDoorDesign } from "../../../../field-projects/generator-system/fixtures/wd-front-door/design.ts";
import {
  addModuleFrom,
  createStudy,
  design,
  expect,
  fanItem,
  openFan,
  ready,
  test,
  tile,
} from "./studio.ts";

test("WD10 edits the public front door by mouse and offline chat with export parity", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E WD10 front door", "blank");
  try {
    const source = frontDoorDesign();
    const ops = studioStudySeedOperations(source);
    if (source.schemaVersion !== 3 || !source.generation) throw Error("Missing generation");
    ops.push({ op: "setGeneration", generation: source.generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await tile(page, "Public API").locator(".lane-container-header").click();
    const field = page.locator(".studio-inspector").getByLabel("Front door", { exact: true });
    await expect(field).toHaveValue("none");
    expect(
      (await design(page, id)).architecture?.studio?.elements.find((e) => e.element === "front")
        ?.settings,
    ).not.toHaveProperty("frontDoor");
    await field.selectOption("required");
    await expect
      .poll(
        async () =>
          (await design(page, id)).architecture?.studio?.elements.find((e) => e.element === "front")
            ?.settings,
      )
      .toMatchObject({ frontDoor: "required" });
    const blueprintRequired = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprintRequired.services.find((s: { id: string }) => s.id === "front").settings.frontDoor,
    ).toBe("required");
    await page.screenshot({ path: testInfo.outputPath("wd10-mouse-required.png") });
    await field.selectOption("none");
    await expect.poll(async () => (await design(page, id)).revision).toBe(3);
    const open = page.getByRole("button", { name: "Open chat" });
    if (await open.isVisible()) await open.click();
    await page.getByLabel("Message").fill("Require the WD10 front door");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("WD10 front door required.", { exact: false })).toBeVisible();
    await ready(page);
    await expect(field).toHaveValue("required");
    const blueprintChat = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(blueprintChat.services.find((s: { id: string }) => s.id === "front").settings).toEqual(
      blueprintRequired.services.find((s: { id: string }) => s.id === "front").settings,
    );
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const preview = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await (await preview).json();
    expect(result.report.findings).toEqual([]);
    expect(
      result.report.processes.tiles.find((p: { tile: string }) => p.tile === "front"),
    ).toMatchObject({
      frontDoor: "required",
      environment: expect.arrayContaining([
        "JEEVES_EDGE_STAMP_KEY",
        "JEEVES_EDGE_STAMP_KEY_PREVIOUS",
      ]),
    });
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("WD10 creates a public service required through the real mouse fan", async ({
  page,
  tinyurl,
}, testInfo) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E WD10 mouse creation", "blank");
  try {
    await openFan(page, "User", "Add action");
    await fanItem(page, "Consume").click();
    await ready(page);
    await openFan(page, "Consume", "Add linked tile");
    await fanItem(page, "Microservice").click();
    await ready(page);
    await expect
      .poll(
        async () =>
          (await design(page, id)).architecture?.studio?.elements.find(
            (e) => e.settings.kind === "service",
          )?.settings,
      )
      .toMatchObject({ exposure: "public", frontDoor: "required" });
    const field = page.locator(".studio-inspector").getByLabel("Front door", { exact: true });
    await expect(field).toHaveCount(0);
    await addModuleFrom(page, tile(page, "Microservice"), "Custom");
    await ready(page);
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    await dialog.getByRole("checkbox", { name: "Runnable processes" }).click();
    await expect(dialog.getByRole("checkbox", { name: "Runnable processes" })).toBeChecked();
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    await tile(page, "Microservice").locator(".lane-container-header").click();
    await expect(field).toHaveValue("required");
    await page.screenshot({ path: testInfo.outputPath("wd10-created-required.png") });
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

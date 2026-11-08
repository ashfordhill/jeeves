import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type DesignDocument, studioStudySeedOperations } from "@jeeves/spec";
import { createStudy, expect, ready, test, tile } from "./studio.ts";

const frozen = JSON.parse(
  await readFile(
    fileURLToPath(
      new URL("../../../field-projects/youtube/v1/inputs/design.json", import.meta.url),
    ),
    "utf8",
  ),
) as DesignDocument;

test("mouse previews and downloads the actual partial scaffold; stale source and project switch cannot download", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createStudy(page, "E2E experimental exact source", "blank");
  let other: string | undefined;
  try {
    for (const [baseRevision, ops] of [
      studioStudySeedOperations(frozen),
      [{ op: "updateArchitectureSystem", name: "Temporary" }],
      [
        {
          op: "updateArchitectureSystem",
          name: frozen.architecture?.system.name,
          description: frozen.architecture?.system.description,
        },
      ],
    ].entries()) {
      const response = await page.request.post(`/api/projects/${id}/operations`, {
        data: { baseRevision, source: "api", ops },
      });
      expect(response.ok(), await response.text()).toBe(true);
    }
    await page.reload();
    await ready(page);
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    const layout = await (await page.request.get(`/api/projects/${id}/layout`)).json();
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    const view = () =>
      page
        .locator(".lane-canvas .board")
        .evaluate((b) => b.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform);
    const camera = await view();
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const result = page.waitForResponse((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    await expect(page.getByText("Ready: 108 files", { exact: false })).toBeVisible();
    await page.getByText(/Missing behavior · G01/).click();
    await expect(page.getByText("G07", { exact: true })).toBeVisible();
    await page.getByText(/Source, versions & strict/).click();
    await expect(page.getByText(/Selected project:/)).toContainText(id);
    await expect(page.getByText(/Archive inputs retain frozen origin/)).toContainText(
      "293b4a2d-e25b-4a5b-83da-b27de7876f02",
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("youtube-local-v1-experimental.zip");
    const path = await download.path();
    if (!path) throw new Error("Missing archive");
    const bytes = await readFile(path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(preview.archive.sha256);
    expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
    await expect(page.getByText(/Project ZIP downloaded/)).toBeVisible();
    await page.getByRole("button", { name: "Close generate experimental project" }).click();
    expect(await view()).toBe(camera);
    expect(await (await page.request.get(`/api/projects/${id}/design`)).json()).toEqual(before);
    expect(await (await page.request.get(`/api/projects/${id}/layout`)).json()).toEqual(layout);
    expect(
      await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json(),
    ).toEqual(blueprint);
    let downloads = 0;
    page.on("download", () => downloads++);
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Download project ZIP", exact: true }),
    ).toBeEnabled();
    expect(
      (
        await page.request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 3,
            source: "api",
            ops: [{ op: "updateArchitectureSystem", name: "Changed saved source" }],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.getByRole("button", { name: "Download project ZIP", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("saved revision differs");
    await expect(
      page.getByRole("button", { name: "Download project ZIP", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Close generate experimental project" }).click();
    // A pending request is disposed when closing/switching; no stale response can download.
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/experimental-generation/preview", async (route) => {
      await held;
      await route.fulfill({ json: preview }).catch(() => {});
    });
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const pending = page.waitForRequest((r) =>
      r.url().endsWith("/experimental-generation/preview"),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    await pending;
    await page.getByRole("button", { name: "Close generate experimental project" }).click();
    other = await createStudy(page, "E2E experimental switched", "blank");
    release?.();
    await page.unroute("**/experimental-generation/preview");
    expect(downloads).toBe(0);
  } finally {
    if (other) await page.request.delete(`/api/projects/${other}`);
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("normal TinyURL source reports unsupported and keeps the mouse canvas usable", async ({
  page,
}) => {
  const id = await createStudy(
    page,
    "E2E unsupported generation",
    "TinyURL · extended study (design only)",
  );
  try {
    const before = await (await page.request.get(`/api/projects/${id}/design`)).json();
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    await page.route("**/experimental-generation/preview", (route) =>
      route.fulfill({
        status: 503,
        json: {
          code: "GENERATION_UNAVAILABLE",
          message: "Check the server installation and retry.",
        },
      }),
    );
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("GENERATION_UNAVAILABLE");
    await page.unroute("**/experimental-generation/preview");
    await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("UNSUPPORTED_SOURCE");
    await expect(
      page.getByRole("button", { name: "Download project ZIP", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Close generate experimental project" }).click();
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    expect(await (await page.request.get(`/api/projects/${id}/design`)).json()).toEqual(before);
    await tile(page, "Shorten service").click();
    const name = page.locator(".studio-inspector").getByLabel("Name", { exact: true });
    await name.fill("");
    await expect(
      page.getByRole("button", { name: "Generate project", exact: true }),
    ).toBeDisabled();
    await name.fill("Shorten service");
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Generate project", exact: true })).toBeEnabled();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

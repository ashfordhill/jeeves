import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

async function seed(page: Page, request: APIRequestContext, fixture: string) {
  const design = JSON.parse(
    readFileSync(new URL(`../../../fixtures/designs/${fixture}.json`, import.meta.url), "utf8"),
  );
  const id = await openNewProject(page, request, `P38 ${fixture}`);
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...design.elements.map((element: unknown) => ({ op: "addElement", element })),
            ...design.connections.map((connection: unknown) => ({ op: "connect", connection })),
            ...(design.architecture
              ? [{ op: "setArchitecture", architecture: design.architecture }]
              : []),
          ],
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  return id;
}
const workspace = (page: Page) => page.getByRole("dialog", { name: "API contracts", exact: true });
const selection = (page: Page) =>
  workspace(page).getByRole("region", { name: "Selected operation" });
async function pick(page: Page, route: string) {
  await workspace(page)
    .getByRole("navigation", { name: "API operations" })
    .getByRole("button", { name: route, exact: true })
    .click();
}

test("C3 operations open a complete saved API with JSON, PNG and redirect reference", async ({
  page,
  request,
}) => {
  const id = await seed(page, request, "qrwty-architecture");
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const before = await read();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("qrwty");
    await page.getByRole("button", { name: "Inspect Analytics", exact: true }).click();
    await page
      .getByRole("complementary", { name: "Architecture details" })
      .getByRole("button", { name: /GET \/api\/analytics/ })
      .click();
    await expect(
      selection(page).getByRole("heading", { name: "GET /api/analytics", exact: true }),
    ).toBeVisible();
    const list = workspace(page).getByRole("navigation", { name: "API operations" });
    await expect(list.getByRole("button")).toHaveCount(16);
    expect(new Set(await list.getByRole("button").allTextContents()).size).toBe(16);
    await expect(workspace(page).getByText(/QR-\d/)).toHaveCount(0);
    await expect(selection(page)).toContainText("from");
    await expect(selection(page)).toContainText("Signed-in owner");
    await page.screenshot({ path: "test-results/p38-operations.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include('[aria-label="API contracts"]').analyze()).violations,
    ).toEqual([]);
    await workspace(page).getByRole("button", { name: "Full API reference", exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="Saved design API reference"]').locator(".opblock"),
    ).toHaveCount(16);
    await page.getByRole("button", { name: "Close reference", exact: true }).click();
    await pick(page, "GET /api/qr/{id}/image");
    await expect(selection(page)).toContainText("image/png · string (binary)");
    await expect(selection(page)).toContainText("Content-Disposition");
    await selection(page).getByRole("button", { name: "Response schemas and examples" }).click();
    const frame = page.frameLocator('iframe[title="Saved design API reference"]');
    const image = frame
      .locator(".opblock")
      .filter({ has: frame.locator('[data-path="/api/qr/{id}/image"]') });
    await expect(image.locator(".opblock-body")).toBeVisible();
    await expect(image).toContainText("Content-Disposition");
    await expect(image.locator("select").first()).toHaveValue("image/png");
    await expect(frame.getByRole("button", { name: /Try it out|Execute|Authorize/ })).toHaveCount(
      0,
    );
    const viewerFrame = page.frames().find((item) => item.url() === "about:srcdoc")!;
    const require = createRequire(import.meta.url);
    const axeSource = readFileSync(
      require.resolve("axe-core/axe.min.js", { paths: [require.resolve("@axe-core/playwright")] }),
      "utf8",
    );
    await viewerFrame.addScriptTag({ content: axeSource });
    const violations = await viewerFrame.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (options: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (
        await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })
      ).violations;
    });
    expect(violations).toEqual([]);
    await image.locator('tr.response[data-code="200"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p38-image-reference.png", animations: "disabled" });
    await page.getByRole("button", { name: "Close reference", exact: true }).click();
    await pick(page, "GET /q/{id}");
    await expect(selection(page)).toContainText("302");
    await expect(selection(page)).toContainText("Location (required)");
    await selection(page).getByRole("button", { name: "Response schemas and examples" }).click();
    const redirect = frame
      .locator(".opblock")
      .filter({ has: frame.locator('[data-path="/q/{id}"]') });
    await expect(redirect.locator(".opblock-body")).toBeVisible();
    const response = redirect.locator('tr.response[data-code="302"]');
    await expect(response).toContainText("Location");
    await expect(response).toContainText("Cache-Control");
    await expect(response.locator(".highlight-code")).toHaveCount(0);
    await response.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/p38-redirect-reference.png",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Close reference", exact: true }).click();
    await workspace(page).getByRole("button", { name: "Close API contracts", exact: true }).click();
    await expect(
      page
        .getByRole("complementary", { name: "Architecture details" })
        .getByRole("heading", { name: "Analytics", exact: true }),
    ).toBeVisible();
    expect(await read()).toEqual(before);
    expect(
      requests.filter(
        (url) => !url.startsWith("http://127.0.0.1:4301/") && !url.startsWith("data:"),
      ),
    ).toEqual([]);
    expect(requests.some((url) => /swagger-ui-bundle.*\.js/.test(url))).toBe(true);
    expect(
      requests.filter((url) => /validator|\/q\/|\/api\/qr\//.test(new URL(url).pathname)),
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("extension drafts survive selection/close, reject unsupported contracts and save with undo/redo", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await seed(page, request, "qrwty-architecture");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const before = await read();
    await editorAction(page, "API contracts");
    await pick(page, "GET /api/analytics");
    await selection(page).getByRole("button", { name: "Edit operation", exact: true }).click();
    const contract = selection(page).getByLabel("Supported contract (JSON)");
    const original = await contract.inputValue();
    const changed = JSON.parse(original);
    changed.responses["200"].description = "Owner scan summary";
    changed.responses["200"].content["application/json"].schema["x-review"] = {
      preserved: ["all", 1],
    };
    await contract.fill(JSON.stringify({ ...changed, callbacks: {} }));
    await expect(selection(page).getByRole("button", { name: "Save operation" })).toBeDisabled();
    await expect(selection(page).getByRole("alert")).toContainText("callbacks");
    await pick(page, "GET /q/{id}");
    await pick(page, "GET /api/analytics");
    await expect(contract).toHaveValue(JSON.stringify({ ...changed, callbacks: {} }));
    await workspace(page).getByRole("button", { name: "Close API contracts", exact: true }).click();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await editorAction(page, "API contracts");
    await expect(contract).toHaveValue(JSON.stringify({ ...changed, callbacks: {} }));
    await contract.fill(JSON.stringify(changed));
    await selection(page).getByLabel("Full path").fill("/api/qr/{id}");
    await expect(selection(page).getByRole("button", { name: "Save operation" })).toBeDisabled();
    await selection(page).getByLabel("Full path").fill("/api/analytics");
    await selection(page).getByRole("button", { name: "Save operation" }).click();
    await expect(
      selection(page).getByRole("button", { name: "Edit operation", exact: true }),
    ).toBeVisible();
    const saved = await read();
    expect(saved.revision).toBe(before.revision + 1);
    const priorModel = before.elements[0].attachments[0].config.model;
    const nextModel = saved.elements[0].attachments[0].config.model;
    expect(nextModel.resources).toEqual(priorModel.resources);
    expect(
      nextModel.extensions.find((e: { id: string }) => e.id === "owner-analytics").contract,
    ).toEqual(changed);
    await workspace(page).getByRole("button", { name: "Close API contracts", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await read()).elements[0].attachments[0].config.model)
      .toEqual(priorModel);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.reload();
    await editorAction(page, "API contracts");
    await pick(page, "GET /api/analytics");
    await expect(selection(page)).toContainText("Owner scan summary");
    await selection(page).getByRole("button", { name: "Edit operation", exact: true }).click();
    await selection(page).getByLabel("Full path").fill("/api/discard");
    await selection(page).getByRole("button", { name: "Cancel operation" }).click();
    await selection(page).getByRole("button", { name: "Edit operation", exact: true }).click();
    await expect(selection(page).getByLabel("Full path")).toHaveValue("/api/analytics");
    const current = await read();
    const concurrent = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: current.revision,
        ops: [{ op: "setNotes", id: "qrwty", notes: "Concurrent edit" }],
      },
    });
    expect(concurrent.status()).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "P38 operation draft revision conflict",
      resourceType: "fetch",
      method: "POST",
      url: `http://127.0.0.1:4301/api/projects/${id}/operations`,
      status: 409,
    });
    await selection(page).getByLabel("Full path").fill("/api/conflict");
    await selection(page).getByRole("button", { name: "Save operation" }).click();
    await expect(selection(page).getByRole("alert")).toContainText(/changed|revision/i);
    await expect(selection(page).getByLabel("Full path")).toHaveValue("/api/conflict");
    conflict.finish();
    await page.screenshot({ path: "test-results/p38-conflict.png", animations: "disabled" });
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("non-QR resource contracts reuse structured editing and remain usable on narrow dark screens", async ({
  page,
  request,
}) => {
  const id = await seed(page, request, "generated-workspace");
  try {
    await editorAction(page, "API contracts");
    await pick(page, "POST /api/stockItem");
    await expect(
      workspace(page).getByRole("navigation", { name: "API operations" }).getByRole("button"),
    ).toHaveCount(12);
    await expect(selection(page)).toContainText("application/json");
    await selection(page).getByRole("button", { name: "Configure resources", exact: true }).click();
    const resources = page.getByRole("dialog", { name: "Configure resources", exact: true });
    await expect(resources.getByLabel("Resource name", { exact: true })).toHaveValue("stockItem");
    await resources.getByRole("button", { name: "Cancel", exact: true }).click();
    await selection(page).getByRole("button", { name: "Response schemas and examples" }).click();
    const frame = page.frameLocator('iframe[title="Saved design API reference"]');
    const stock = frame
      .locator(".opblock-post")
      .filter({ has: frame.locator('[data-path="/api/stockItem"]') });
    await expect(stock.locator(".opblock-body")).toBeVisible();
    await expect(stock).toContainText("warehouseId");
    await stock.locator(".opblock-section-request-body").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/p38-inventory-reference.png",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Close reference", exact: true }).click();
    await workspace(page).getByRole("button", { name: "Close API contracts", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await editorAction(page, "API contracts");
    await expect(selection(page)).toContainText("POST /api/stockItem");
    await page.screenshot({ path: "test-results/p38-narrow-dark.png", animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include('[aria-label="API contracts"]').analyze()).violations,
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("recipe operation definitions stay protected in the API workspace and operation API", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/projects/from-recipe", {
    data: { name: "P38 protected", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).project.id;
  try {
    await page.goto(`/?project=${id}#/draw`);
    await editorAction(page, "API contracts");
    await pick(page, "GET /api/analytics");
    await expect(selection(page)).toContainText("Protected recipe definition");
    await expect(selection(page).getByRole("button", { name: "Edit operation" })).toHaveCount(0);
    const before = (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    const attachment = before.elements[0].attachments[0];
    attachment.config.model.extensions[0].contract.responses["200"].description = "Rejected edit";
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: before.revision,
            ops: [{ op: "updateAttachment", id: attachment.id, config: attachment.config }],
          },
        })
      ).status(),
    ).toBe(422);
    expect((await (await request.get(`/api/projects/${id}/design`)).json()).design.revision).toBe(
      before.revision,
    );
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

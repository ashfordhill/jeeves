import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { architectureExample, type DesignDocument } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject } from "./helpers.ts";

const details = (page: Page) => page.getByRole("complementary", { name: "Architecture details" });
async function fit(page: Page) {
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  const area = await page.locator(".draw-board").boundingBox();
  const viewport = await page.locator(".draw-board .react-flow").boundingBox();
  expect(
    area &&
      viewport &&
      viewport.y >= area.y + 45 &&
      viewport.y + viewport.height <= area.y + area.height,
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Zoom to selection", exact: true }),
  ).toBeInViewport();
  await expect
    .poll(async () => {
      const board = await page.locator(".draw-board .react-flow").boundingBox();
      if (!board) return false;
      for (const node of await page.locator(".draw-board .react-flow__node").all()) {
        const box = await node.boundingBox();
        if (
          !box ||
          box.x < board.x ||
          box.y < board.y ||
          box.x + box.width > board.x + board.width ||
          box.y + box.height > board.y + board.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
}

for (const example of ["qr", "link-platform"] as const) {
  test(`${example} C2 notation fits, keeps actors outside and passes light/narrow dark accessibility`, async ({
    page,
    request,
  }) => {
    const fixture: DesignDocument =
      example === "qr"
        ? JSON.parse(
            readFileSync(
              new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
              "utf8",
            ),
          )
        : architectureExample(example).design;
    const layout = example === "qr" ? undefined : architectureExample(example).layout;
    const created = await request.post("/api/projects", { data: { name: `P39 ${example}` } });
    const id = (await created.json()).project.id;
    const read = async () =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    try {
      const seeded = await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: 0,
          ops: [
            ...fixture.elements.map((element) => ({ op: "addElement", element })),
            ...fixture.connections.map((connection) => ({ op: "connect", connection })),
            { op: "setArchitecture", architecture: fixture.architecture },
          ],
        },
      });
      expect(seeded.status()).toBe(200);
      if (layout)
        expect((await request.put(`/api/projects/${id}/layout`, { data: layout })).ok()).toBe(true);
      const before = await read();
      await page.goto(`/?project=${id}#/draw`);
      await expect(page.locator("[data-element-id]")).toHaveCount(fixture.elements.length);
      await expect(page.locator(".c2-system-boundary")).toContainText(
        fixture.architecture!.system.name,
      );
      await fit(page);
      expect(await page.locator(".element-card select").count()).toBe(0);
      for (const card of await page.locator(".element-card").all()) {
        await expect(card.locator(".element-card-stereotype")).toContainText(/Container|External/);
        await expect(card.locator(".element-card-technology")).not.toBeEmpty();
        await expect(card.locator(".container-description")).not.toBeEmpty();
        expect(await card.locator(":scope > .card-chips .card-chip").count()).toBeLessThanOrEqual(
          2,
        );
      }
      const boundary = await page.locator(".c2-system-boundary").boundingBox();
      for (const actor of await page.locator(".c2-context-card").all()) {
        const box = await actor.boundingBox();
        expect(
          box &&
            boundary &&
            (box.x + box.width < boundary.x || box.x > boundary.x + boundary.width),
        ).toBe(true);
      }
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p39-${example}-light.png`,
        animations: "disabled",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await fit(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p39-${example}-dark.png`,
        animations: "disabled",
      });
      expect(await read()).toEqual(before);
      const savedLayout = (await (await request.get(`/api/projects/${id}/layout`)).json()).layout;
      expect(Object.keys(savedLayout.items).some((key) => key.startsWith("context:"))).toBe(false);
      expect((await read()).annotations).toEqual([]);
    } finally {
      await request.delete(`/api/projects/${id}`);
    }
  });
}

test("description and technology edits keep Save/Cancel, undo/redo, reload and conflict drafts; context stays mouse editable", async ({
  page,
  request,
  browserProblems,
}) => {
  const created = await request.post("/api/projects/from-recipe", {
    data: { name: "P39 description", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  const id = (await created.json()).project.id;
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const element = async () =>
    (await read()).elements.find((item: { id: string }) => item.id === "qrwty");
  try {
    await page.goto(`/?project=${id}#/draw`);
    await inspectObject(page, "container:qrwty");
    const description = details(page).getByRole("textbox", { name: "Description", exact: true });
    const field = details(page).getByRole("textbox", { name: "Description", exact: true });
    await field.fill("Discard this description");
    await details(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(description).toHaveValue("");
    await field.fill("Manages links and QR artwork for their owners.");
    await details(page).getByRole("button", { name: "Save description", exact: true }).click();
    await expect
      .poll(async () => (await element()).description)
      .toBe("Manages links and QR artwork for their owners.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(field).toHaveValue("");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await element()).description)
      .toBe("Manages links and QR artwork for their owners.");
    await page.reload();
    await inspectObject(page, "container:qrwty");
    await expect(field).toHaveValue("Manages links and QR artwork for their owners.");
    await field.fill("Draft retained through conflict");
    const current = await read();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "updateElement", id: "qrwty", description: "Edited elsewhere" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "P39 description conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await details(page).getByRole("button", { name: "Save description", exact: true }).click();
    await expect(details(page).getByRole("alert")).toContainText(/changed|reloaded|revision/i);
    await expect(field).toHaveValue("Draft retained through conflict");
    conflict.finish();
    await inspectObject(page, "container:qrwty-web");
    await inspectObject(page, "container:qrwty");
    await expect(field).toHaveValue("Draft retained through conflict");
    await page.screenshot({ path: "test-results/p39-conflict.png", animations: "disabled" });
    await details(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(field).toHaveValue("Edited elsewhere");
    await inspectObject(page, "context:owner");
    await expect(details(page).getByLabel("Responsibility", { exact: true })).toBeVisible();
    await editorAction(page, "Hide inspector");
    await fit(page);
    await page.locator(".c2-context-card").first().click();
    const responsibility = details(page).getByLabel("Responsibility", { exact: true });
    const original = await responsibility.inputValue();
    await responsibility.fill("Discard participant draft");
    await details(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(responsibility).toHaveValue(original);
    await responsibility.fill("Owns the team's links and QR artwork.");
    await details(page).getByRole("button", { name: "Save context", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).architecture.nodes.find((node: { id: string }) => node.id === "owner")
            .description,
      )
      .toBe("Owns the team's links and QR artwork.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(responsibility).toHaveValue(original);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).architecture.nodes.find((node: { id: string }) => node.id === "owner")
            .description,
      )
      .toBe("Owns the team's links and QR artwork.");
    await page.reload();
    await inspectObject(page, "context:owner");
    await expect(responsibility).toHaveValue("Owns the team's links and QR artwork.");
    await inspectObject(page, "context:owner-manages");
    await details(page).getByLabel("Application at the system boundary").selectOption("");
    await details(page).getByRole("button", { name: "Save context", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).architecture.relationships.find(
            (edge: { id: string }) => edge.id === "owner-manages",
          ).container,
      )
      .toBeUndefined();
    const projected = (await (await request.get(`/api/projects/${id}/architecture`)).json()).views
      .containers;
    expect(
      projected.edges.find((edge: { id: string }) => edge.id === "context:owner-manages").to,
    ).toBe("context:system");
    await page.screenshot({ path: "test-results/p39-unbound-context.png", animations: "disabled" });
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("planned technology and descriptions save atomically without borrowing implementation notes", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/projects", { data: { name: "P39 planned metadata" } });
  const id = (await created.json()).project.id;
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              {
                op: "addElement",
                element: {
                  id: "cache",
                  name: "Lookup cache",
                  template: null,
                  planned: "distributed-cache",
                  notes: "Private implementation instructions",
                },
              },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.goto(`/?project=${id}#/draw`);
    const card = page.locator('[data-element-id="cache"]');
    await expect(card).toContainText("Redis compatible");
    await expect(card).not.toContainText("Private implementation");
    await card.locator(".element-card-name").click();
    const description = details(page).getByLabel("Description", { exact: true });
    const technology = details(page).getByLabel("Technology", { exact: true });
    await description.fill("Discard me");
    await technology.fill("Discard me");
    await details(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(technology).toHaveValue("");
    await description.fill("Caches public redirect destinations.");
    await technology.fill("Valkey 8");
    await details(page).getByRole("button", { name: "Save options", exact: true }).click();
    await expect(card).toContainText("Valkey 8");
    await expect
      .poll(async () => (await read()).elements[0].description)
      .toBe("Caches public redirect destinations.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(card).toContainText("Redis compatible");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => (await read()).elements[0].description)
      .toBe("Caches public redirect destinations.");
    await page.reload();
    await card.locator(".element-card-name").click();
    await expect(description).toHaveValue("Caches public redirect destinations.");
    await expect(technology).toHaveValue("Valkey 8");
    expect((await read()).elements[0].notes).toBe("Private implementation instructions");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

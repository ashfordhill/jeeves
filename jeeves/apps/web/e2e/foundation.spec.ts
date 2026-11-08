import { DEFAULT_STUDIO_EXAMPLE_ID, studioArchitectureExample } from "@jeeves/spec";
import { createStudy, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("new project preselects the complete foundation, reloads it and undoes the seed in one step", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E NC06 default foundation");
  try {
    const state = async () => await (await page.request.get(`/api/projects/${id}/design`)).json();
    const initial = await state(),
      source = studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design;
    expect(initial.design).toEqual({ ...source, revision: 1 });
    await expect(tiles(page)).toHaveCount(6);
    await expect(lines(page)).toHaveCount(7);
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    await expect(tile(page, "Links · logical owner")).toContainText("2 declared operations");
    await page.reload();
    await ready(page);
    expect(await state()).toEqual(initial);
    expect((await page.request.get(`/api/projects/${id}/blueprint`)).status()).toBe(422);
    const full = await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
    expect(full.readiness).toMatchObject({
      designValidity: { status: "valid" },
      contractCompleteness: { status: "complete" },
      implementationAvailability: { status: "unavailable" },
      runtimeEvidence: { status: "none" },
      generationEligible: false,
    });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await state()).design.schemaVersion).toBe(2);
    expect((await state()).design).toEqual({
      schemaVersion: 2,
      revision: 2,
      elements: [],
      connections: [],
    });
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await state()).design).toEqual({ ...source, revision: 3 });
    await page.reload();
    await ready(page);
    expect((await state()).design).toEqual({ ...source, revision: 3 });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("foundation view actions preserve complete semantics and exact operation selection reaches chat history", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E NC06 foundation views");
  try {
    const state = async () => await (await page.request.get(`/api/projects/${id}/design`)).json(),
      bp = async () =>
        await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
    const before = await state(),
      full = await bp();
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "Expand roles", exact: true }).click();
    await ready(page);
    await expect(tiles(page)).toHaveCount(7);
    await tile(page, "Resolve link").click();
    await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
    await page.getByRole("button", { name: "Fit focus", exact: true }).click();
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await tile(page, "Resolve link").click();
    await page.getByRole("button", { name: "Details & bindings", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Operation contracts" })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      page.getByText("Selected operation for chat · resolve-link", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
    await page.getByLabel("Message", { exact: true }).fill("Read this exact operation");
    const request = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().endsWith(`/projects/${id}/chat`),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect((await request).postDataJSON().selection).toEqual(["operation:resolve-link"]);
    await expect
      .poll(async () => {
        const t = await (await page.request.get(`/api/projects/${id}/chat`)).json();
        return t.turns.at(-1)?.status;
      })
      .toBe("done");
    const history = await (await page.request.get(`/api/projects/${id}/chat`)).json();
    expect(history.turns.at(-1).selection).toEqual(["operation:resolve-link"]);
    expect(await state()).toEqual(before);
    expect(await bp()).toEqual(full);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("explicit authority stays primary while preserved legacy inference remains editable and undoable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createStudy(page, "E2E NC14 legacy disclosure");
  try {
    const state = async () =>
      (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
    const before = await state();
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await tile(page, "Links database").click();
    const explicit = page.getByLabel("Declared ownership and access"),
      legacy = page.locator(".studio-legacy-access");
    await expect(explicit).toContainText("Explicit authority: Links");
    await expect(explicit).toContainText("Create link · Read & write");
    await expect(legacy).not.toHaveAttribute("open");
    await expect(page.getByLabel("Legacy inferred writer", { exact: true })).toBeHidden();
    await legacy.locator("> summary").click();
    await expect(legacy).toContainText("Legacy inferred writer");
    await expect(legacy).toContainText("no owner yet");
    await page
      .getByLabel("Legacy inferred writer", { exact: true })
      .selectOption("element:resolve-api");
    await expect
      .poll(
        async () =>
          (await state()).architecture.studio.elements.find(
            (row: { element: string }) => row.element === "links-db",
          ).owner,
      )
      .toEqual({ kind: "element", id: "resolve-api" });
    expect((await state()).ownership).toEqual(before.ownership);
    expect((await state()).operations).toEqual(before.operations);
    await expect(explicit).toContainText("Create link · Read & write");
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => ({ ...(await state()), revision: 0 }))
      .toEqual({ ...before, revision: 0 });
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Expand roles", exact: true }).click();
    await ready(page);
    await tile(page, "Create link").click();
    await expect(page.locator(".lane-inspector-kind")).toHaveText("API role");
    await expect(
      page.getByText(/Tile kind: Microservice · deployable intent: links-runtime/),
    ).toBeVisible();
    expect({ ...(await state()), revision: 0 }).toEqual({ ...before, revision: 0 });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

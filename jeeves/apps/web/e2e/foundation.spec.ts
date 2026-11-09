import {
  buildStudioCommand,
  DEFAULT_STUDIO_EXAMPLE_ID,
  studioArchitectureExample,
} from "@jeeves/spec";
import { commitSource, openDiagnostics, selectOperation } from "./source.ts";
import { clickLine, createStudy, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("new project preselects the complete foundation, reloads it and undoes the seed in one step", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E NC06 default foundation");
  try {
    const state = async () => await (await page.request.get(`/api/projects/${id}/design`)).json();
    const initial = await state(),
      source = studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design;
    expect(initial.design).toEqual({ ...source, revision: 1 });
    await expect(tiles(page)).toHaveCount(7);
    await expect(lines(page)).toHaveCount(7);
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    await expect(tile(page, "Create link")).toBeVisible();
    await expect(tile(page, "Resolve link")).toBeVisible();
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
    await ready(page);
    await expect(tiles(page)).toHaveCount(7);
    await tile(page, "Resolve link").click();
    await clickLine(page, "resolve-cache");
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".board .react-flow__edge.selected")).toHaveCount(0);
    await tile(page, "Resolve link").click();
    await selectOperation(page, "resolve-link");
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

test("explicit authority and legacy inference remain in source diagnostics and source edits stay undoable", async ({
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
    await expect(page.getByLabel("Legacy inferred writer", { exact: true })).toHaveCount(0);
    const diagnostic = await openDiagnostics(page);
    await diagnostic.getByText(/^Ownership & access ·/).click();
    await expect(diagnostic.locator(".ownership-summary").first()).toContainText(
      '"authority": "links"',
    );
    await page.getByRole("button", { name: "Close source & diagnostics", exact: true }).click();
    await commitSource(page, (design) =>
      buildStudioCommand(design, {
        type: "edit",
        element: "links-db",
        owner: { kind: "element", id: "resolve-api" },
      }),
    );
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
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => ({ ...(await state()), revision: 0 }))
      .toEqual({ ...before, revision: 0 });
    await page.reload();
    await ready(page);
    await tile(page, "Create link").click();
    await expect(page.locator(".lane-inspector-kind")).toHaveText("Microservice");
    await expect(page.locator(".studio-inspector")).not.toContainText("deployable");
    await expect(
      page.getByRole("button", { name: "Operation contracts", exact: true }),
    ).toHaveCount(0);
    expect({ ...(await state()), revision: 0 }).toEqual({ ...before, revision: 0 });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

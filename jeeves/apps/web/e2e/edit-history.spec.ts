import { buildGenerationPresetCommand } from "@jeeves/spec";
import { commitSource } from "./source.ts";
import { createStudy, design, expect, pickFromMenu, ready, test, tile } from "./studio.ts";

test("a historical preset design autosaves its useful TTL and pool controls through Undo, Redo and reload", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E historical feature controls", "blank", "Simple");
  try {
    const inspector = page.locator(".studio-inspector");
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    // The preset has no normal entry point; a historical design that used it stays editable.
    await commitSource(page, (source) =>
      buildGenerationPresetCommand(source, { preset: "youtube" }),
    );
    await tile(page, "User").click();
    await expect(inspector.getByText("Add a supported feature", { exact: true })).toHaveCount(0);
    await tile(page, "Metadata cache").click();
    // One page: the cache's Options follow its Description without a tab.
    await expect(inspector.getByRole("tablist")).toHaveCount(0);
    await expect(inspector.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
    const ttl = inspector.getByLabel("TTL", { exact: true });
    await expect(ttl).toHaveValue("3600");
    await ttl.fill("420");
    await ttl.blur();
    const values = async () => {
      const saved = await design(page, id);
      return {
        ttl: saved.architecture.studio.elements.find((row) => row.element === "metadata-cache")
          ?.settings.ttlSeconds,
        mirror: saved.architecture.studio.components.find(
          (row) => row.settings.kind === "cache-reader",
        )?.settings.l2TtlSeconds,
      };
    };
    await expect.poll(values).toEqual({ ttl: 420, mirror: 420 });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(values).toEqual({ ttl: 3600, mirror: 3600 });
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(values).toEqual({ ttl: 420, mirror: 420 });
    await page.reload();
    await ready(page);
    expect(await values()).toEqual({ ttl: 420, mirror: 420 });
    await tile(page, "Watch API").click();
    // One page in the sketch's order: Name, Description, Options, Connections, then Modules.
    expect(
      await inspector
        .locator("form label, form h3")
        .evaluateAll((nodes) => nodes.map((node) => node.textContent)),
    ).toEqual([
      "Name",
      "Description",
      "Options",
      "Request timeout",
      "Concurrency limit",
      "Connections",
      "Modules",
    ]);
    // A module's card opens its own page: Back, Name, Description, Options, then Remove module.
    await inspector.getByRole("button", { name: "Open Details reader", exact: true }).click();
    await expect(inspector.getByRole("tablist")).toHaveCount(0);
    expect(
      await inspector
        .locator(".lane-inspector-back, form label, form h3, form button")
        .evaluateAll((nodes) => nodes.map((node) => node.textContent)),
    ).toEqual([
      "Watch API",
      "Name",
      "Description",
      "Options",
      "Pool size",
      "Statement timeout",
      "Remove module",
    ]);
    const pool = inspector.getByLabel("Pool size", { exact: true });
    const poolBefore = await pool.inputValue();
    await pool.fill("60");
    await expect
      .poll(
        async () =>
          (await design(page, id)).architecture.studio.components.find(
            (row) => row.name === "Details reader",
          )?.settings.poolSize,
      )
      .toBe(60);
    await expect(inspector.getByLabel("Read routing", { exact: true })).toHaveCount(0);
    await expect(inspector.getByLabel("Language", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(pool).toHaveValue(poolBefore);
    await inspector.getByRole("button", { name: "Back to Watch API", exact: true }).click();
    await expect(inspector.getByLabel("Name", { exact: true })).toHaveValue("Watch API");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("legacy unsupported settings stay hidden and unchanged while names/history remain usable", async ({
  page,
  tinyurl: id,
}) => {
  const before = await design(page, id);
  const inspector = page.locator(".studio-inspector");
  // The container's header selects the tile (its middle may be a module row).
  await tile(page, "Shorten service").click({ position: { x: 20, y: 12 } });
  await expect(inspector.getByRole("group", { name: "Type", exact: true })).toHaveCount(0);
  await expect(inspector.getByLabel("Language", { exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Open Link writer", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Options", exact: true })).toHaveCount(0);
  await expect(inspector.getByLabel("Pool size", { exact: true })).toHaveCount(0);
  await inspector.getByLabel("Name", { exact: true }).fill("Preserved writer");
  await expect
    .poll(
      async () =>
        (await design(page, id)).architecture.studio.components.find(
          (row) => row.name === "Preserved writer",
        )?.settings,
    )
    .toEqual(
      before.architecture.studio.components.find((row) => row.name === "Link writer")?.settings,
    );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
    .toEqual({ ...before, revision: 0 });
  await page.reload();
  await ready(page);
  expect({ ...(await design(page, id)), revision: 0 }).toEqual({ ...before, revision: 0 });
});

test("Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y press Undo and Redo, but not in a field or under a dialog", async ({
  page,
  tinyurl: id,
}) => {
  const steps: string[] = [];
  page.on("request", (request) => {
    const step = /\/projects\/[^/]+\/(undo|redo)$/.exec(request.url())?.[1];
    if (step && request.method() === "POST") steps.push(step);
  });
  const inspector = page.locator(".studio-inspector");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  const described = async () =>
    (
      (await design(page, id)).elements.find((item) => item.id === "url-cache") as
        | { description?: string }
        | undefined
    )?.description ?? "";
  const original = await described();
  const edited = "Keeps hot short links";
  const paper = () =>
    page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });

  await tile(page, "URL cache").click();
  await inspector.getByLabel("Description", { exact: true }).fill(edited);
  await expect.poll(described).toBe(edited);

  // Outside a field: the keys do what the header's buttons do, one step each.
  await paper();
  await expect(undo).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect.poll(described).toBe(original);
  await expect(redo).toBeEnabled();
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect.poll(described).toBe(edited);
  await expect(undo).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect.poll(described).toBe(original);
  await expect(redo).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect.poll(described).toBe(edited);
  await expect(redo).toBeDisabled();
  expect(steps).toEqual(["undo", "redo", "undo", "redo"]);
  // With Redo disabled its keys do nothing.
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(undo).toBeEnabled();
  expect(steps).toHaveLength(4);

  // In the Name field the keys are the browser's: the design is not undone.
  await tile(page, "URL cache").click();
  const name = inspector.getByLabel("Name", { exact: true });
  await name.click();
  await expect(name).toBeFocused();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+KeyZ");
  await page.keyboard.press("Control+y");
  await expect(name).toHaveValue("URL cache");

  // Under a dialog nothing happens: Export diagram, then a removal's confirmation.
  await paper();
  await page.getByRole("button", { name: "Export diagram", exact: true }).click();
  const exporting = page.getByRole("dialog", { name: "Export diagram" });
  await expect(exporting).toBeVisible();
  await page.keyboard.press("Control+z");
  await page.getByRole("button", { name: "Close export diagram" }).click();
  await expect(exporting).toHaveCount(0);
  await tile(page, "Redirect service").click({ position: { x: 20, y: 12 } });
  await pickFromMenu(page, tile(page, "Redirect service"), "Remove tile");
  const removal = page.getByRole("dialog", { name: "Remove Redirect service" });
  await expect(removal).toBeVisible();
  await page.keyboard.press("Control+z");
  await removal.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(removal).toHaveCount(0);
  expect(steps).toHaveLength(4);
  expect(await described()).toBe(edited);

  // Once the dialogs are closed the keys work again.
  await paper();
  await page.keyboard.press("Control+z");
  await expect.poll(described).toBe(original);
  expect(steps).toEqual(["undo", "redo", "undo", "redo", "undo"]);

  // In the Description box Ctrl+Z undoes the typing, not the saved design.
  await tile(page, "URL cache").click();
  const box = inspector.getByLabel("Description", { exact: true });
  await box.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await expect(box).toHaveValue(`${original}!`);
  await page.keyboard.press("Control+z");
  await expect(box).toHaveValue(original);
  await paper();
  await expect.poll(described).toBe(original);
  expect(steps).toHaveLength(5);
});

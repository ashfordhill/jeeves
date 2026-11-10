import { buildGenerationPresetCommand } from "@jeeves/spec";
import { commitSource } from "./source.ts";
import { createStudy, design, expect, ready, test, tile } from "./studio.ts";

test("a historical preset design autosaves its useful TTL and pool controls through Undo, Redo and reload", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E historical feature controls", "blank");
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
    // One page in the sketch's order: Name, Description, Options, then Modules.
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
  await tile(page, "Shorten service").click();
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

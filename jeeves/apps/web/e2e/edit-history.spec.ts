import { buildGenerationPresetCommand } from "@jeeves/spec";
import { commitSource } from "./source.ts";
import { createStudy, design, expect, ready, test, tile } from "./studio.ts";

async function attach(page: Parameters<typeof createStudy>[0]) {
  await tile(page, "User").click();
  await page.getByLabel("Feature preset", { exact: true }).selectOption("video");
  await page.getByRole("button", { name: "Preview attachment", exact: true }).click();
  await expect(page.locator(".studio-inspector").getByRole("status")).toContainText(
    "One Undo step",
  );
  await page.getByRole("button", { name: "Attach feature", exact: true }).click();
  await ready(page);
}

test("attaches the installed preset atomically and autosaves useful TTL/pool controls through Undo, Redo and reload", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E reusable feature and historical controls", "blank");
  try {
    const inspector = page.locator(".studio-inspector");
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await attach(page);
    await expect(page.locator('.studio-inspector option[value="youtube"]')).toHaveCount(0);
    await expect.poll(async () => (await design(page, id)).elements.length).toBe(9);
    const attached = await design(page, id);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await design(page, id)).elements.length).toBe(0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
      .toEqual({ ...attached, revision: 0 });
    // Product implementations are no longer an installed attachment. Preserve the historical
    // design explicitly, then exercise its still-supported generic cache and SQL controls.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await design(page, id)).elements.length).toBe(0);
    await commitSource(page, (source) =>
      buildGenerationPresetCommand(source, { preset: "youtube" }),
    );
    await tile(page, "Metadata cache").click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
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
    await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
    await inspector.getByRole("button", { name: "Details reader", exact: true }).click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
    await inspector.getByLabel("Pool size", { exact: true }).fill("60");
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
  await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
  await inspector.getByRole("button", { name: "Link writer", exact: true }).click();
  await expect(inspector.getByRole("tab", { name: "Options", exact: true })).toHaveCount(0);
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

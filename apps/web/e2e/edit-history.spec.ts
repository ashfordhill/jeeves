import type { Page } from "@playwright/test";
import { design, expect, ready, test, tile } from "./studio.ts";

const poolSize = async (page: Page, id: string) =>
  (await design(page, id)).architecture.studio.components.find((c) => c.name === "Link writer")
    ?.settings.poolSize;

test("autosaves a module setting, undoes and redoes it, and keeps it after reload", async ({
  page,
  tinyurl: id,
}) => {
  const inspector = page.locator(".studio-inspector");
  const pool = inspector.getByLabel("Pool size", { exact: true });
  const open = async () => {
    await tile(page, "Shorten API").click();
    await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
    await inspector.getByRole("button", { name: "Link writer", exact: true }).click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  };
  await open();
  await expect(pool).toHaveValue("20");
  await pool.fill("32");
  await expect.poll(() => poolSize(page, id)).toBe(32);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => poolSize(page, id)).toBe(20);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => poolSize(page, id)).toBe(32);

  await page.reload();
  await ready(page);
  expect(new URL(page.url()).searchParams.get("project")).toBe(id);
  await open();
  await expect(pool).toHaveValue("32");
});

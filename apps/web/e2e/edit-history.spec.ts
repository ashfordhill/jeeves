import type { Page } from "@playwright/test";
import { box, design, expect, level, ready, test } from "./studio.ts";

const poolSize = async (page: Page, id: string) =>
  (await design(page, id)).architecture.studio.components.find((c) => c.name === "Link writer")
    ?.settings.poolSize;

test("autosaves a setting, undoes and redoes it, and keeps it after reload", async ({
  page,
  tinyurl: id,
}) => {
  await level(page, "C3");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await box(page, "Link writer").click();
  const inspector = page.locator(".studio-inspector");
  const options = inspector.getByRole("tab", { name: "Options", exact: true });
  if (await options.count()) await options.click();
  const pool = inspector.getByLabel("Pool size", { exact: true });
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
  await level(page, "C3");
  await box(page, "Link writer").click();
  if (await options.count()) await options.click();
  await expect(pool).toHaveValue("32");
});

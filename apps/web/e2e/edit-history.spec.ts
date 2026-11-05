import type { Page } from "@playwright/test";
import { design, expect, ready, test, tile } from "./studio.ts";

const requestTimeout = async (page: Page, id: string) =>
  (await design(page, id)).architecture.studio.elements.find((e) => e.element === "shorten-api")
    ?.settings.requestTimeoutMs;

test("autosaves a setting, undoes and redoes it, and keeps it after reload", async ({
  page,
  tinyurl: id,
}) => {
  const inspector = page.locator(".studio-inspector");
  const timeout = inspector.getByLabel("Request timeout", { exact: true });
  const open = async () => {
    await tile(page, "Shorten API").click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  };
  await open();
  await expect(timeout).toHaveValue("3000");
  await timeout.fill("4500");
  await expect.poll(() => requestTimeout(page, id)).toBe(4500);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => requestTimeout(page, id)).toBe(3000);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => requestTimeout(page, id)).toBe(4500);

  await page.reload();
  await ready(page);
  expect(new URL(page.url()).searchParams.get("project")).toBe(id);
  await open();
  await expect(timeout).toHaveValue("4500");
});

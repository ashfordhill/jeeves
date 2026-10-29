import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("loads the shell, reports a healthy server, and switches views", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Jeeves", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Draw" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Draw" })).toBeVisible();
  await expect(page.getByText("Server healthy")).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

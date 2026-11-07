import type { Page } from "@playwright/test";
import { expect, ready, tile } from "./studio.ts";

/** Explicitly align the existing finite timeout; declaring a contract never rewrites it. */
export async function alignCreateTimeout(page: Page, owned = true) {
  const owner = tile(page, "Links · logical owner");
  if (owned) {
    await expect(owner).toBeVisible();
    await owner.getByRole("button", { name: "Expand roles", exact: true }).click();
  }
  await ready(page);
  await tile(page, "Shorten service").click();
  await page.getByRole("tab", { name: "Options", exact: true }).click();
  await page.getByLabel("Request timeout", { exact: true }).fill("10000");
  await page.getByRole("tab", { name: "General", exact: true }).click();
}
export async function declareCreate(page: Page) {
  await page.getByRole("button", { name: "Operation contracts", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await form.getByLabel("Create receiver role", { exact: true }).selectOption("shorten");
  await form.getByRole("button", { name: "Declare Create link", exact: true }).click();
  await form.getByRole("tab", { name: "Callers", exact: true }).click();
  await form.getByRole("button", { name: /^Bind upload entry/ }).click();
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await expect(
    form.getByText("Operation declarations preview · 2 affected bindings"),
  ).toBeVisible();
  await expect(
    form.getByText(/Trusted runtime auth verifier is unspecified and unavailable/),
  ).toBeVisible();
  await form.getByRole("button", { name: /^(Upgrade & save operations|Save operations)$/ }).click();
  await expect(form).toBeHidden();
  await ready(page);
}

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

/** Explicit mouse edits align legacy typed intent; contract declarations never migrate it. */
export async function alignResolveSettings(page: Page, owned = true) {
  await ready(page);
  const inspector = page.locator(".studio-inspector");
  const owner = tile(page, "Links · logical owner");
  if (owned) {
    await expect(owner).toBeVisible();
    await owner.getByRole("button", { name: "Expand roles", exact: true }).click();
  }
  await ready(page);
  await tile(page, "Redirect service").click();
  await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  await inspector.getByLabel("Request timeout", { exact: true }).fill("1200");
  await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
  const module = async (name: string) => {
    await inspector.getByRole("button", { name, exact: true }).click();
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  };
  const back = async () => {
    await inspector.getByRole("button", { name: "Back to Redirect service", exact: true }).click();
    await inspector.getByRole("tab", { name: "Modules", exact: true }).click();
  };
  await module("Link reader");
  await inspector.getByLabel("Read routing", { exact: true }).selectOption("primary");
  await back();
  await module("Cache reader");
  // Clear the TTL before size because the finite module requires size when TTL is present.
  for (const label of ["L1 TTL", "L1 in-process size", "Negative caching TTL"])
    await inspector.getByLabel(label, { exact: true }).fill("");
  await inspector.getByLabel("Shared cache TTL", { exact: true }).fill("300");
  await inspector.getByLabel("Stampede protection", { exact: true }).selectOption("none");
  await back();
  await module("Redirect responder");
  await inspector.getByLabel("Status", { exact: true }).selectOption("307");
  await back();
  await tile(page, "URL cache").click();
  await inspector.getByRole("tab", { name: "Options", exact: true }).click();
  await inspector.getByLabel("TTL", { exact: true }).fill("300");
  await inspector.getByRole("tab", { name: "General", exact: true }).click();
  await tile(page, "Redirect service").click();
  await inspector.getByRole("tab", { name: "General", exact: true }).click();
}
export async function declareResolve(page: Page) {
  await page.getByRole("button", { name: "Operation contracts", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await form.getByLabel("Operation", { exact: true }).selectOption("resolve-link");
  await form.getByLabel("Resolve receiver role", { exact: true }).selectOption("redirect");
  await form.getByRole("button", { name: "Declare Resolve link", exact: true }).click();
  await form.getByRole("tab", { name: "Callers", exact: true }).click();
  await form.getByRole("button", { name: /^Bind download entry/ }).click();
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await expect(
    form.getByText("Operation declarations preview · 2 affected bindings", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: /^(Upgrade & save operations|Save operations)$/ }).click();
  await expect(form).toBeHidden();
  await ready(page);
}

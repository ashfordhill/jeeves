import type { Page } from "@playwright/test";
import { expect } from "./studio.ts";

/** Exercise the real mouse editor; the existing roles/resources keep their canonical IDs. */
export async function declareLinks(page: Page) {
  const openInspector = page.getByRole("button", { name: "Open inspector", exact: true });
  if (await openInspector.isVisible()) await openInspector.click();
  await page.getByRole("button", { name: "Ownership & access", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Ownership & access" });
  await form.getByRole("button", { name: "Add logical owner", exact: true }).click();
  await form.getByLabel("Owner 1 name", { exact: true }).fill("Links");
  await form.getByRole("tab", { name: "Roles", exact: true }).click();
  for (const name of ["Shorten service", "Redirect service"]) {
    await form.getByLabel(`${name} logical owner`, { exact: true }).selectOption("owner-1");
    await form.getByLabel(`${name} deployable`, { exact: true }).fill("links-app");
  }
  await form.getByRole("tab", { name: "Resources", exact: true }).click();
  await form.getByLabel("URL database authority", { exact: true }).selectOption("owner-1");
  await form.getByLabel("URL cache authority", { exact: true }).selectOption("owner-1");
  await form
    .getByLabel("URL cache resource classification", { exact: true })
    .selectOption("projection");
  await form.getByLabel("URL cache projection source", { exact: true }).selectOption("url-db");
  await form.getByRole("tab", { name: "Access", exact: true }).click();
  for (const [label, access] of [
    ["Shorten service to URL database grant", "write"],
    ["Redirect service to URL database grant", "read"],
    ["Redirect service to URL cache grant", "read-write"],
    ["shorten-db dependency access", "write"],
    ["redirect-db dependency access", "read"],
    ["redirect-cache dependency access", "read-write"],
  ])
    await form.getByLabel(label as string, { exact: true }).selectOption(access as string);
  await form.getByRole("button", { name: "Preview ownership", exact: true }).click();
  await expect(form.getByRole("tab", { name: "Preview", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    form.getByText(/Ownership declarations preview · 11 affected declarations/),
  ).toBeVisible();
  await form.getByRole("button", { name: /^(Upgrade & save ownership|Save ownership)$/ }).click();
  await expect(form).toBeHidden();
}

/** The tile, system and action inspectors are one page: no tabs, connection lists or Entries. */
import type { Locator, Page } from "@playwright/test";
import { clickLine, design, expect, showView, test, tile } from "./studio.ts";

/** The page's parts in order: field labels, section headings, the warning list and fieldsets. */
const outline = (inspector: Locator) =>
  inspector
    .locator('form label, form h3, form legend, form ul[aria-label="Warnings"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? node.childNodes[0]?.textContent),
    );
const lines = (count: number, text: string) =>
  Array.from({ length: count }, (_, i) => `${text} ${i + 1}`).join("\n");
const saved = async (page: Page, id: string, element: string) =>
  (await design(page, id)).elements.find((item) => item.id === element) as
    | { name: string; description?: string }
    | undefined;

test("a tile is one page: Name, Description and Modules autosave, grow and undo", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  const inspector = page.locator(".studio-inspector");
  const original = await saved(page, id, "redirect");
  await tile(page, "Redirect service").click();
  await expect(inspector.getByRole("tablist")).toHaveCount(0);
  await expect(inspector.getByRole("tabpanel")).toHaveCount(0);
  // The Name is the title, printed once; Description replaces Purpose; no Options here, then the
  // modules. The relationships are the drawn lines, never a list in words.
  const name = inspector.getByLabel("Name", { exact: true });
  await expect(name).toHaveValue("Redirect service");
  await expect(inspector.getByText("Redirect service", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText(/^(Purpose|Goal)$/)).toHaveCount(0);
  expect(await outline(inspector)).toEqual(["Name", "Description", "Modules"]);
  await expect(
    inspector.getByRole("list", { name: "Modules", exact: true }).getByRole("button"),
  ).toHaveCount(4);
  await expect(inspector.getByRole("button", { name: /→/ })).toHaveCount(0);

  // The description box starts at 6 rows, grows with its text, and stops at half the rail.
  const box = inspector.getByLabel("Description", { exact: true });
  const height = () => box.evaluate((node) => node.getBoundingClientRect().height);
  const start = await height();
  const rail = await inspector.evaluate((node) => node.clientHeight);
  const ten = lines(10, "Redirect step");
  await box.fill(ten);
  await expect.poll(height).toBeGreaterThan(start);
  await expect.poll(async () => (await saved(page, id, "redirect"))?.description).toBe(ten);
  // 80 short lines, within the 240-character limit.
  const many = Array.from({ length: 80 }, () => "r").join("\n");
  await box.fill(many);
  await expect.poll(async () => (await saved(page, id, "redirect"))?.description).toBe(many);
  expect(await height()).toBeLessThanOrEqual(rail / 2 + 1);
  expect(await box.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page, id, "redirect"))?.description).toBe(ten);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page, id, "redirect"))?.description)
    .toBe(original?.description);
  await expect(box).toHaveValue(original?.description ?? "");
  await expect.poll(height).toBe(start);

  // The title edits the name in place.
  await name.fill("Redirect edge");
  await expect.poll(async () => (await saved(page, id, "redirect"))?.name).toBe("Redirect edge");
  await expect(tile(page, "Redirect edge")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tile(page, "Redirect service")).toBeVisible();
  await expect(name).toHaveValue("Redirect service");

  // A tile with neither options nor modules is its header and Description.
  await tile(page, "URL cache").click();
  expect(await outline(inspector)).toEqual(["Name", "Description"]);
});

test("the system page: Name, Description, then warnings; actions list no entries", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  const inspector = page.locator(".studio-inspector");
  const before = await design(page, id);
  // Removing the stats read leaves the worker's store unread: one warning.
  await clickLine(page, "stats-read");
  await page
    .getByRole("button", { name: "Remove Stats API to Analytics store", exact: true })
    .click();
  // The removal is saved before the page is read: its warning comes from the saved design.
  await expect
    .poll(async () => {
      const saved = await design(page, id);
      return {
        revision: saved.revision,
        read: saved.connections.some((c) => c.id === "stats-read"),
      };
    })
    .toEqual({ revision: before.revision + 1, read: false });
  await expect(page.locator('.board .react-flow__edge[data-id="stats-read"]')).toHaveCount(0);
  await tile(page, "User").click();
  await expect(inspector.getByRole("tablist")).toHaveCount(0);
  await expect(inspector.getByLabel("Name", { exact: true })).toHaveValue("TinyURL");
  await expect(inspector.locator(".lane-inspector-kind")).toHaveText("System");
  await expect(inspector.getByText(/^(Purpose|Goal)$/)).toHaveCount(0);
  await expect.poll(() => outline(inspector)).toEqual(["Name", "Description", "Warnings"]);
  await inspector.getByRole("button", { name: "Analytics store", exact: true }).click();
  await expect(tile(page, "Analytics store")).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
    .toEqual({ ...before, revision: 0 });

  // An action keeps its Name, Lane and warnings; its entries are its drawn lines.
  await tile(page, "Open link").click();
  await expect(inspector.getByLabel("Name", { exact: true })).toHaveValue("Open link");
  await expect(inspector.getByRole("definition")).toContainText("Download");
  await expect(inspector.getByText("Entries", { exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "Redirect service" })).toHaveCount(0);
});

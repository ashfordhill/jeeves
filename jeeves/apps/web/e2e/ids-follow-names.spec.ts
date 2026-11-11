/**
 * IDs follow names (tile processes plan, TP03): renaming a tile or module by mouse re-keys an ID
 * that still follows its kind or its name, with its modules, in one Undo step, and the selection
 * and the field being typed in stay on it. A study keeps its IDs; only the name changes.
 */
import type { Page } from "@playwright/test";
import { createStudy, design, expect, moveOnto, pull, ready, test, tile } from "./studio.ts";

const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });
const inspector = (page: Page) => page.locator(".studio-inspector");
const field = (page: Page, label: string) => inspector(page).getByLabel(label, { exact: true });
const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name, exact: true });
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();

type Saved = Omit<Awaited<ReturnType<typeof design>>, "elements" | "architecture"> & {
  elements: { id: string; name: string; description?: string }[];
  architecture: {
    studio: { components?: { id: string; host: string; name: string }[] };
  };
};
const saved = async (page: Page, id: string) => (await design(page, id)) as unknown as Saved;
const tiles = async (page: Page, id: string) =>
  (await saved(page, id)).elements.map((item) => [item.id, item.name]);
const modules = async (page: Page, id: string) =>
  ((await saved(page, id)).architecture.studio.components ?? []).map((item) => [
    item.id,
    item.host,
    item.name,
  ]);

/** Pulls the selected tile's tab onto a fan item and lets go. */
async function pick(page: Page, from: string, tab: string, item: string) {
  await pull(page, from, tab, tab === "Add module" ? { x: -60, y: 12 } : undefined);
  await moveOnto(page, fanItem(page, item));
  await page.mouse.up();
  await ready(page);
}

/** Types over the focused field's text. */
async function typeOver(page: Page, text: string) {
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

test("renaming a new Worker and its module by mouse re-keys their IDs, with Undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E IDs follow names", "blank");
  try {
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await pick(page, "User", "Add action", "Consume");
    await pick(page, "Consume", "Add linked tile", "Microservice");
    await pick(page, "Microservice", "Add linked tile", "Queue or topic");
    await pick(page, "Queue or topic", "Add linked tile", "Worker service");
    await expect.poll(() => tiles(page, id)).toContainEqual(["worker-service", "Worker service"]);

    // The new Worker opens with its Name focused. Its new name commits after the debounce while
    // the Description is being typed: the ID follows the name, the tile stays selected and the
    // Description keeps its focus and text, saved under the new ID.
    await expect(field(page, "Name")).toBeFocused();
    await typeOver(page, "Video lifecycle worker");
    await field(page, "Description").click();
    await page.keyboard.type("Records each video's state.");
    await expect
      .poll(() => tiles(page, id))
      .toContainEqual(["video-lifecycle-worker", "Video lifecycle worker"]);
    await expect(field(page, "Description")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect
      .poll(async () =>
        (await saved(page, id)).elements.find((item) => item.id === "video-lifecycle-worker"),
      )
      .toMatchObject({ description: "Records each video's state." });
    await expect(tile(page, "Video lifecycle worker")).toHaveClass(/selected/);
    await expect(field(page, "Name")).toHaveValue("Video lifecycle worker");
    await expect(field(page, "Description")).toHaveValue("Records each video's state.");

    // A name whose ID another tile has waits in the field, with the reason, and saves nothing.
    const revision = (await saved(page, id)).revision;
    await field(page, "Name").click();
    await typeOver(page, "Microservice");
    await expect(inspector(page).locator(".studio-field-error")).toHaveText(
      "Microservice would take the ID microservice, which Microservice already uses. Choose another name.",
    );
    await typeOver(page, "Video lifecycle worker");
    await expect(inspector(page).locator(".studio-field-error")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(700);
    expect((await saved(page, id)).revision).toBe(revision);

    // A module from the Worker's `+`: its ID follows the Worker's, then its own new name.
    await tile(page, "Video lifecycle worker").click();
    await pick(page, "Video lifecycle worker", "Add module", "Data access");
    await expect(field(page, "Name")).toBeFocused();
    await expect
      .poll(() => modules(page, id))
      .toEqual([["video-lifecycle-worker-data-access", "video-lifecycle-worker", "Data access"]]);
    await typeOver(page, "State writer");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => modules(page, id))
      .toEqual([["video-lifecycle-worker-state-writer", "video-lifecycle-worker", "State writer"]]);
    // The module's page stays open on its new ID, and its row carries it.
    await expect(
      inspector(page).getByRole("button", { name: "Back to Video lifecycle worker", exact: true }),
    ).toBeVisible();
    await expect(field(page, "Name")).toHaveValue("State writer");
    await tool(page, "Detailed").click();
    await ready(page);
    const row = page.locator(
      '.board .lane-container-row[data-module="video-lifecycle-worker-state-writer"]',
    );
    await expect(row).toHaveAttribute("data-mark", "open");

    // Undo restores the module's ID and name in one step; its page follows it back.
    await undo(page);
    await expect
      .poll(() => modules(page, id))
      .toEqual([["video-lifecycle-worker-data-access", "video-lifecycle-worker", "Data access"]]);
    await expect(field(page, "Name")).toHaveValue("Data access");
    await expect(
      page.locator('.board .lane-container-row[data-module="video-lifecycle-worker-data-access"]'),
    ).toHaveAttribute("data-mark", "open");

    // Renaming the Worker again moves its module with it; Undo moves both back.
    await tool(page, "Simple").click();
    await ready(page);
    await tile(page, "Video lifecycle worker").click();
    await field(page, "Name").click();
    await typeOver(page, "Video worker");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => modules(page, id))
      .toEqual([["video-worker-data-access", "video-worker", "Data access"]]);
    await expect(tile(page, "Video worker")).toHaveClass(/selected/);
    await undo(page);
    await expect
      .poll(() => tiles(page, id))
      .toContainEqual(["video-lifecycle-worker", "Video lifecycle worker"]);
    expect(await modules(page, id)).toEqual([
      ["video-lifecycle-worker-data-access", "video-lifecycle-worker", "Data access"],
    ]);
    await expect(tile(page, "Video lifecycle worker")).toHaveClass(/selected/);
    await expect(field(page, "Name")).toHaveValue("Video lifecycle worker");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("renaming a study's tile keeps its ID", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E IDs pinned", "YouTube · studio study");
  try {
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await tile(page, "Transcoder").click();
    await field(page, "Name").click();
    await typeOver(page, "Video transcoder");
    await page.keyboard.press("Tab");
    await expect.poll(() => tiles(page, id)).toContainEqual(["transcoder", "Video transcoder"]);
    expect((await modules(page, id)).filter(([, host]) => host === "transcoder")).toHaveLength(5);
    await expect(tile(page, "Video transcoder")).toHaveClass(/selected/);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

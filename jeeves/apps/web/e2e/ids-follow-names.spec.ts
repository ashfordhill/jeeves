/** Display labels preserve runtime identities, module hosts and handwritten paths (RG05). */
import type { Page } from "@playwright/test";
import {
  addModuleFrom,
  createStudy,
  design,
  expect,
  pickFrom,
  ready,
  test,
  tile,
} from "./studio.ts";

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

/** Clicks the selected tile's tab, or its `+`, then the fan's or the menu's item. */
async function pick(page: Page, from: string, tab: string, item: string) {
  if (tab === "Add module") await addModuleFrom(page, tile(page, from), item);
  else await pickFrom(page, from, tab, item);
  await ready(page);
}

/** Types over the focused field's text. */
async function typeOver(page: Page, text: string) {
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

test("renaming a new Worker and its module preserves runtime IDs, selection and Undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E stable IDs", "blank");
  try {
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await pick(page, "User", "Add action", "Consume");
    await pick(page, "Consume", "Add linked tile", "Microservice");
    await pick(page, "Microservice", "Add linked tile", "Message channel");
    await pick(page, "Message channel", "Add linked tile", "Worker service");
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
      .toContainEqual(["worker-service", "Video lifecycle worker"]);
    await expect(field(page, "Description")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect
      .poll(async () =>
        (await saved(page, id)).elements.find((item) => item.id === "worker-service"),
      )
      .toMatchObject({ description: "Records each video's state." });
    await expect(tile(page, "Video lifecycle worker")).toHaveClass(/selected/);
    await expect(field(page, "Name")).toHaveValue("Video lifecycle worker");
    await expect(field(page, "Description")).toHaveValue("Records each video's state.");

    // Duplicate display labels do not collide with runtime identities.
    await field(page, "Name").fill("Microservice");
    await field(page, "Description").click();
    await expect.poll(() => tiles(page, id)).toContainEqual(["worker-service", "Microservice"]);
    await expect(inspector(page).locator(".studio-field-error")).toHaveCount(0);
    await field(page, "Name").fill("Video lifecycle worker");
    await field(page, "Description").click();
    await expect
      .poll(() => tiles(page, id))
      .toContainEqual(["worker-service", "Video lifecycle worker"]);

    // A module from the Worker's `+`: its ID follows the Worker's, then its own new name.
    await tile(page, "Video lifecycle worker").click();
    await pick(page, "Video lifecycle worker", "Add module", "Data access");
    await expect(field(page, "Name")).toBeFocused();
    await expect
      .poll(() => modules(page, id))
      .toEqual([["worker-service-data-access", "worker-service", "Data access"]]);
    await typeOver(page, "State writer");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => modules(page, id))
      .toEqual([["worker-service-data-access", "worker-service", "State writer"]]);
    // The module's page stays open on its new ID, and its row carries it.
    await expect(
      inspector(page).getByRole("button", { name: "Back to Video lifecycle worker", exact: true }),
    ).toBeVisible();
    await expect(field(page, "Name")).toHaveValue("State writer");
    await tool(page, "Detailed").click();
    await ready(page);
    const row = page.locator(
      '.board .lane-container-row[data-module="worker-service-data-access"]',
    );
    await expect(row).toHaveAttribute("data-mark", "open");

    // Undo restores the module's ID and name in one step; its page follows it back.
    await undo(page);
    await expect
      .poll(() => modules(page, id))
      .toEqual([["worker-service-data-access", "worker-service", "Data access"]]);
    await expect(field(page, "Name")).toHaveValue("Data access");
    await expect(
      page.locator('.board .lane-container-row[data-module="worker-service-data-access"]'),
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
      .toEqual([["worker-service-data-access", "worker-service", "Data access"]]);
    await expect(tile(page, "Video worker")).toHaveClass(/selected/);
    await undo(page);
    await expect
      .poll(() => tiles(page, id))
      .toContainEqual(["worker-service", "Video lifecycle worker"]);
    expect(await modules(page, id)).toEqual([
      ["worker-service-data-access", "worker-service", "Data access"],
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
    // The container's header selects the tile (its middle is a module row).
    await tile(page, "Transcoder").click({ position: { x: 20, y: 12 } });
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

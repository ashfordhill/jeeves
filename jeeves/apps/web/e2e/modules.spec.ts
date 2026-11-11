/**
 * A tile's modules are cards at the bottom of its page. A card opens the module's own page in the
 * rail; Back, another selection, Remove module and Undo return. Opening a module is view state.
 */
import type { Locator, Page } from "@playwright/test";
import { clickLine, createStudy, design, expect, test, tile } from "./studio.ts";

const encoder = "Segmenter and encoder";
type Component = {
  id: string;
  host: string;
  name: string;
  description?: string;
  settings: Record<string, unknown>;
};
const component = async (page: Page, id: string, module: string) =>
  ((await design(page, id)).architecture.studio.components as Component[]).find(
    (item) => item.id === module,
  );
/** The page's parts in order: the Back row, field labels, section headings and buttons. */
const outline = (inspector: Locator) =>
  inspector
    .locator(".lane-inspector-back, form label, form h3, form button")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent),
    );
/** Whether `target` lies wholly inside the inspector's scrolling page. */
const inView = async (inspector: Locator, target: Locator) =>
  target.evaluate(
    (node, page) => {
      const box = node.getBoundingClientRect();
      const frame = (page as HTMLElement).getBoundingClientRect();
      return box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
    },
    await inspector.locator(".studio-selection-summary").elementHandle(),
  );

test("module cards open a module page; Back, other selections, Remove and Undo return to its tile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // A short window, so the Transcoder's page scrolls and Back has to bring Modules into view.
  await page.setViewportSize({ width: 1280, height: 640 });
  const id = await createStudy(page, "E2E UI03 module cards", "YouTube · studio study", "Simple");
  try {
    const blueprint = async () =>
      await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    const before = await design(page, id);
    const original = (before.architecture.studio.components as Component[]).find(
      (item) => item.id === "transcoder-encoder",
    );
    const full = await blueprint();
    const inspector = page.locator(".studio-inspector");
    const name = inspector.getByLabel("Name", { exact: true });
    const back = inspector.getByRole("button", { name: "Back to Transcoder", exact: true });
    const cards = inspector.getByRole("list", { name: "Modules", exact: true }).getByRole("button");
    const card = (module: string) =>
      inspector.getByRole("button", { name: `Open ${module}`, exact: true });

    // The Transcoder's five modules are cards: icon, name, kind and a two-line description.
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await tile(page, "Transcoder").click();
    await expect(cards).toHaveCount(5);
    expect(
      await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
    ).toEqual([
      "Open Job consumer",
      `Open ${encoder}`,
      "Open Packager",
      "Open Thumbnailer",
      "Open Completion publisher",
    ]);
    await expect(card(encoder).locator(".lane-module-icon svg")).toHaveCount(1);
    await expect(card(encoder).locator(".lane-module-kind")).toHaveText("Custom");
    await expect(card("Job consumer").locator(".lane-module-kind")).toHaveText("Event consumer");
    const clamp = await card(encoder)
      .locator(".lane-module-description")
      .evaluate((node) => ({
        lines: Math.round(node.clientHeight / Number.parseFloat(getComputedStyle(node).lineHeight)),
        cut: node.scrollHeight > node.clientHeight,
      }));
    expect(clamp).toEqual({ lines: 2, cut: true });

    // A card opens the module's page in place of the tile's: Back, header, Description, Remove.
    await card(encoder).click();
    await expect(back).toBeVisible();
    await expect(name).toHaveValue(encoder);
    await expect(inspector.locator(".lane-inspector-kind")).toHaveText("Custom");
    await expect(inspector.getByRole("tablist")).toHaveCount(0);
    await expect(inspector.getByRole("tab")).toHaveCount(0);
    expect(await outline(inspector)).toEqual([
      "Back to Transcoder",
      "Name",
      "Description",
      "Remove module",
    ]);
    await expect(inspector.getByRole("button", { name: /Unlink|→|←/ })).toHaveCount(0);
    await expect(inspector.getByText(/^(Connections|Purpose)$/)).toHaveCount(0);
    await expect(inspector.locator(".studio-selection-summary")).toHaveJSProperty("scrollTop", 0);
    // Opening a module selects nothing new on the canvas and changes nothing saved.
    await expect(tile(page, "Transcoder")).toHaveClass(/selected/);
    expect(await design(page, id)).toEqual(before);
    expect(await blueprint()).toEqual(full);

    // Its name and description autosave, and Undo restores each.
    await name.fill("Segment encoder");
    await expect
      .poll(async () => (await component(page, id, "transcoder-encoder"))?.name)
      .toBe("Segment encoder");
    const description = inspector.getByLabel("Description", { exact: true });
    await description.fill("Encodes each segment at every rendition.");
    await expect
      .poll(async () => (await component(page, id, "transcoder-encoder"))?.description)
      .toBe("Encodes each segment at every rendition.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(description).toHaveValue(original?.description ?? "");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(name).toHaveValue(encoder);
    await expect
      .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
      .toEqual({ ...before, revision: 0 });
    await expect(back).toBeVisible();

    // Back returns to the tile, with the Modules section in view and the card focused.
    await back.click();
    await expect(name).toHaveValue("Transcoder");
    await expect(back).toHaveCount(0);
    const modules = inspector.getByRole("heading", { name: "Modules", exact: true });
    expect(
      await inspector
        .locator(".studio-selection-summary")
        .evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    expect(await inView(inspector, modules)).toBe(true);
    await expect(card(encoder)).toBeFocused();

    // Selecting another tile, a line or empty paper closes the module.
    await card("Packager").click();
    await expect(name).toHaveValue("Packager");
    await tile(page, "Upload service").click();
    await expect(name).toHaveValue("Upload service");
    await tile(page, "Transcoder").click();
    await expect(name).toHaveValue("Transcoder");
    await card("Packager").click();
    await clickLine(page, "transcoder-read");
    await expect(inspector.locator(".lane-connection-label")).toHaveText("Reads originals");
    await tile(page, "Transcoder").click();
    await expect(name).toHaveValue("Transcoder");
    await card("Packager").click();
    await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(inspector.locator(".lane-inspector-kind").first()).toHaveText("System");
    await tile(page, "Transcoder").click();
    await expect(name).toHaveValue("Transcoder");

    // Remove module returns to the tile; Undo brings the card back on the tile's page.
    await card("Thumbnailer").click();
    await inspector.getByRole("button", { name: "Remove module", exact: true }).click();
    await expect(name).toHaveValue("Transcoder");
    await expect(cards).toHaveCount(4);
    await expect.poll(async () => component(page, id, "transcoder-thumbnails")).toBeUndefined();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(cards).toHaveCount(5);
    await expect(name).toHaveValue("Transcoder");
    // A history step that removes the open module (here Redo) also returns to its tile.
    await card("Thumbnailer").click();
    await expect(name).toHaveValue("Thumbnailer");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(name).toHaveValue("Transcoder");
    await expect(cards).toHaveCount(4);
    // Undoing that step reopens the module, as a selected tile comes back with its tile.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(name).toHaveValue("Thumbnailer");
    await back.click();
    await expect(cards).toHaveCount(5);
    await expect
      .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
      .toEqual({ ...before, revision: 0 });
    const after = await blueprint();
    expect({ ...after, revision: full.revision }).toEqual(full);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("an open module is chat's selection, and its host's when it closes", async ({ page }) => {
  const id = await createStudy(page, "E2E UI03 module chat", "YouTube · studio study");
  try {
    const inspector = page.locator(".studio-inspector");
    const send = async (message: string) => {
      await page.getByLabel("Message", { exact: true }).fill(message);
      const request = page.waitForRequest(
        (r) => r.method() === "POST" && r.url().endsWith(`/projects/${id}/chat`),
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const selection = (await request).postDataJSON().selection;
      await expect
        .poll(
          async () =>
            (await (await page.request.get(`/api/projects/${id}/chat`)).json()).turns.at(-1)
              ?.status,
        )
        .toBe("done");
      return selection;
    };
    const before = await design(page, id);
    await tile(page, "Transcoder").click();
    await inspector.getByRole("button", { name: `Open ${encoder}`, exact: true }).click();
    expect(await send("Describe this module")).toEqual(["transcoder-encoder"]);
    const history = await (await page.request.get(`/api/projects/${id}/chat`)).json();
    expect(history.turns.at(-1).selection).toEqual(["transcoder-encoder"]);
    await inspector.getByRole("button", { name: "Back to Transcoder", exact: true }).click();
    expect(await send("Describe this tile")).toEqual(["transcoder"]);
    expect(await design(page, id)).toEqual(before);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

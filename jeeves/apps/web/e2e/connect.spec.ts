/**
 * Connect mode (MA03): Connect (C) in the canvas toolbar, next to Pointer. A drag from one tile to
 * another links them in the pair's default mode, from where the drag started; a refused end fades
 * with its reason and changes nothing; a hovered line shows its X; a click still selects. The mode
 * is view state: it never reaches the design, its revision or the blueprint.
 */
import type { Page } from "@playwright/test";
import {
  clickLine,
  createStudy,
  design,
  dragOnto,
  dragPaper,
  expect,
  linePoint,
  lines,
  ready,
  showView,
  test,
  tile,
} from "./studio.ts";

const tool = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const blueprint = async (page: Page, id: string) =>
  (await page.request.get(`/api/projects/${id}/blueprint`)).json();
const notice = (page: Page) => page.locator(".studio-notice");
const camera = (page: Page) =>
  page
    .locator(".board .react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);
/** The mode the toolbar shows as pressed. */
const mode = async (page: Page) => {
  for (const name of ["Pointer", "Connect"])
    if ((await tool(page, name).getAttribute("aria-pressed")) === "true") return name;
  return "none";
};

test("C, V, Escape and the toolbar's two tools switch modes without touching the design", async ({
  page,
  tinyurl: id,
}) => {
  const before = { design: await design(page, id), blueprint: await blueprint(page, id) };
  // Exactly two tools, Pointer then Connect, with their keys in their titles; then Fit.
  const toolbar = page.getByRole("toolbar", { name: "Canvas tools" });
  const names = await toolbar
    .locator(":scope > button")
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
  expect(names.slice(0, 3)).toEqual(["Pointer", "Connect", "Fit"]);
  await expect(toolbar.locator(":scope > button[aria-pressed]")).toHaveCount(2);
  await expect(tool(page, "Pointer")).toHaveAttribute("title", "Pointer (V)");
  await expect(tool(page, "Connect")).toHaveAttribute("title", "Connect (C)");
  await expect(page.getByRole("button", { name: /^Hand/ })).toHaveCount(0);
  expect(await mode(page)).toBe("Pointer");

  await page.keyboard.press("c");
  expect(await mode(page)).toBe("Connect");
  await expect(page.locator(".board")).toHaveAttribute("data-mode", "connect");
  await page.keyboard.press("v");
  expect(await mode(page)).toBe("Pointer");
  await expect(page.locator(".board")).toHaveAttribute("data-mode", "select");
  await page.keyboard.press("c");
  await page.keyboard.press("Escape");
  expect(await mode(page)).toBe("Pointer");
  // H is no tool's key any more.
  await page.keyboard.press("h");
  expect(await mode(page)).toBe("Pointer");
  await page.keyboard.press("c");
  await page.keyboard.press("h");
  expect(await mode(page)).toBe("Connect");
  // By mouse: the button toggles, and Pointer returns too.
  await tool(page, "Connect").click();
  expect(await mode(page)).toBe("Pointer");
  await tool(page, "Connect").click();
  expect(await mode(page)).toBe("Connect");
  await tool(page, "Pointer").click();
  expect(await mode(page)).toBe("Pointer");

  expect(await design(page, id)).toEqual(before.design);
  expect(await blueprint(page, id)).toEqual(before.blueprint);
});

test("links two tiles by dragging; the design gains exactly that link, and Undo", async ({
  page,
  tinyurl: id,
}) => {
  const before = await design(page, id);
  await tool(page, "Connect").click();
  await dragOnto(page, tile(page, "Shorten service"), tile(page, "Click events"));
  // A provisional line follows the pointer; the allowed ends show through the scrim.
  await expect(page.locator(".board-connect .board-connect-line line")).toHaveCount(1);
  await expect(tile(page, "Click events")).toHaveClass(/is-drop-target/);
  await expect(tile(page, "Click events")).toHaveClass(/is-drop-over/);
  // Shorten service already writes URL database, and nothing links onto the user.
  await expect(tile(page, "URL database")).not.toHaveClass(/is-drop-target/);
  await expect(tile(page, "User")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(page.locator(".board-connect")).toHaveCount(0);

  await ready(page);
  await expect(lines(page)).toHaveCount(13);
  const after = await design(page, id);
  expect(after.revision).toBe(before.revision + 1);
  const added = after.connections.filter((c) => !before.connections.some((old) => old.id === c.id));
  // Exactly one new link, in the drag's direction and the pair's default mode (a queue: async).
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({
    from: { element: "shorten" },
    to: { element: "click-events" },
    planned: { label: "Publishes", interaction: "Asynchronous" },
  });
  expect(after.connections.filter((c) => c !== added[0])).toEqual(before.connections);
  expect(after.elements).toEqual(before.elements);
  // The mode and the selection stay: a drag selects nothing.
  expect(await mode(page)).toBe("Connect");
  await expect(page.locator(".board .react-flow__node.selected")).toHaveCount(0);

  // A store link: Redirect service → Analytics store, a request.
  await dragOnto(page, tile(page, "Redirect service"), tile(page, "Analytics store"));
  await page.mouse.up();
  await ready(page);
  await expect(lines(page)).toHaveCount(14);
  const read = (await design(page, id)).connections.find(
    (c) => c.from.element === "redirect" && c.to.element === "analytics-store",
  );
  expect(read).toMatchObject({ kind: "uses-database" });

  // Each link is one Undo step.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(lines(page)).toHaveCount(13);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(lines(page)).toHaveCount(12);
  expect((await design(page, id)).connections).toEqual(before.connections);
});

test("a refused end fades with its reason, and nothing changes", async ({ page, tinyurl: id }) => {
  const before = await design(page, id);
  await page.keyboard.press("c");
  // The drag's direction is the arrow's: a store links onward to nothing, and the drag is not
  // reversed into Redirect service → Analytics store.
  await dragOnto(page, tile(page, "Analytics store"), tile(page, "Redirect service"));
  await expect(page.locator(".board .react-flow__node.is-drop-target")).toHaveCount(0);
  const reason = "Analytics store can't link to Redirect service. A database can't link onward.";
  await expect(page.locator(".board-connect-tip")).toHaveText(reason);
  await page.mouse.up();
  await expect(notice(page)).toHaveText(reason);
  await page.getByRole("button", { name: "Dismiss notice" }).click();

  // Nothing links back to the user.
  await dragOnto(page, tile(page, "Redirect service"), tile(page, "User"));
  await expect(page.locator(".board-connect-tip")).toHaveText("Links don't lead back to the user.");
  await page.mouse.up();
  await expect(notice(page)).toHaveText("Links don't lead back to the user.");
  await page.getByRole("button", { name: "Dismiss notice" }).click();

  // Released on paper, or cancelled with Escape (which leaves the mode on): nothing at all.
  await dragOnto(page, tile(page, "Redirect service"), tile(page, "Analytics worker"));
  const paper = await page.locator(".lane-canvas").boundingBox();
  if (!paper) throw new Error("No paper.");
  await page.mouse.move(paper.x + 30, paper.y + paper.height - 120, { steps: 6 });
  await page.mouse.up();
  await dragOnto(page, tile(page, "Redirect service"), tile(page, "Analytics worker"));
  await page.keyboard.press("Escape");
  await expect(page.locator(".board-connect")).toHaveCount(0);
  await page.mouse.up();
  expect(await mode(page)).toBe("Connect");

  await expect(notice(page)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(12);
  expect(await design(page, id)).toEqual(before);
});

test("removes a line by its hover X, then Undo; the user's lines have none", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  const before = await design(page, id);
  await page.keyboard.press("c");
  const x = page.locator(".board-remove-line");
  await expect(x).toHaveCount(0);
  const at = await linePoint(page, "redirect-db");
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await expect(x).toHaveAttribute("aria-label", "Remove Redirect service to URL database");
  // The hovered line takes the selection colour, drawn over the rest.
  await expect(
    page.locator('.board .react-flow__edge[data-id="redirect-db"] .react-flow__edge-path'),
  ).toHaveAttribute("style", /--board-select/);
  // The pointer can leave the line for its X.
  const box = await x.boundingBox();
  if (!box) throw new Error("No X.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await expect(x).toHaveCount(1);
  await x.click();
  await ready(page);
  await expect(lines(page)).toHaveCount(11);
  await expect(page.locator('.board .react-flow__edge[data-id="redirect-db"]')).toHaveCount(0);
  expect((await design(page, id)).connections.some((c) => c.id === "redirect-db")).toBe(false);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(lines(page)).toHaveCount(12);
  const undone = await design(page, id);
  expect({ ...undone, revision: before.revision }).toEqual(before);

  // The user's line to an action goes with the action: no X.
  const user = await linePoint(page, "@actor-download");
  await page.mouse.move(user.x, user.y, { steps: 4 });
  await page.waitForTimeout(200);
  await expect(x).toHaveCount(0);
  // A removal that would cut a tile off is refused with the reason, as with Pointer.
  const clicks = await linePoint(page, "redirect-clicks");
  await page.mouse.move(clicks.x, clicks.y, { steps: 4 });
  await x.click();
  await expect(notice(page)).toContainText("would cut off Click events and Analytics worker");
  await expect(lines(page)).toHaveCount(12);
});

test("a click selects in Connect mode, and dragging empty paper pans in both modes", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  const before = await design(page, id);
  const inspector = page.locator(".studio-inspector");
  await page.keyboard.press("c");
  await tile(page, "Redirect service").click();
  await expect(tile(page, "Redirect service")).toHaveClass(/selected/);
  await expect(inspector.getByLabel("Name", { exact: true })).toHaveValue("Redirect service");
  // Connect mode shows no pull tabs and no tile X: a drag from a tile links it.
  await expect(tile(page, "Redirect service").locator(".board-tab, .board-remove")).toHaveCount(0);
  await clickLine(page, "redirect-cache");
  await expect(inspector.getByRole("heading", { name: "Connection" })).toBeVisible();
  await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
  await expect(page.locator(".board .react-flow__node.selected")).toHaveCount(0);

  // A drag on empty paper pans, and selects or links nothing, in Connect mode and with Pointer.
  for (const key of ["c", "v"]) {
    await page.keyboard.press(key);
    const panned = await camera(page);
    await dragPaper(page);
    await expect.poll(() => camera(page)).not.toBe(panned);
    await expect(page.locator(".board .react-flow__node.selected")).toHaveCount(0);
    await expect(page.locator(".board-connect")).toHaveCount(0);
  }
  expect(await design(page, id)).toEqual(before);
});

test("connects containers from anywhere in the Detailed view", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(
    page,
    "E2E Connect detailed",
    "TinyURL · extended study (design only)",
  );
  try {
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    const before = await design(page, id);
    await page.keyboard.press("c");
    // From a module row: the gesture is the container's (tile level).
    const row = page.locator('.lane-container-row[data-module="stats-data"]');
    // A worker takes its work only from a queue or topic: the tip says so, and Escape cancels.
    await dragOnto(page, row, tile(page, "Analytics worker"));
    await expect(page.locator(".board-connect-tip")).toHaveText(
      "Stats API can't link to Analytics worker. A worker takes its work from a queue or topic. Put one between them.",
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await dragOnto(page, row, tile(page, "Shorten service"));
    await expect(tile(page, "Shorten service")).toHaveClass(/is-drop-over/);
    await page.mouse.up();
    const added = async () =>
      (await design(page, id)).connections
        .filter((c) => !before.connections.some((old) => old.id === c.id))
        .map((c) => `${c.from.element} ${c.to.element}`);
    await expect.poll(added).toEqual(["stats-api shorten"]);
    // A click on a row still opens its module.
    await row.click();
    await expect(
      page.locator(".studio-inspector").getByRole("button", { name: "Back to Stats API" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await design(page, id)).connections).toEqual(before.connections);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

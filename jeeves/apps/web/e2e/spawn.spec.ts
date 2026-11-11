import type { Page } from "@playwright/test";
import {
  createStudy,
  design,
  dragOnto,
  expect,
  lines,
  moveOnto,
  pull,
  ready,
  test,
  tile,
  tiles,
} from "./studio.ts";

/** The open fan's items (every kind, in its slot). */
const fan = (page: Page) => page.locator(".board-pull [data-fan-item]");
const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });
const LINK_TAB = "Add linked tile";
/** The link fan's eleven kinds by row (application, data, messaging, edge), as named in it. */
const FAN = [
  ["Microservice", "Worker service", "Uploads", "Identity"],
  ["Database", "Search index", "Cache", "Object storage"],
  ["Message channel"],
  ["CDN", "External API"],
];

test("pulls the link tab onto a kind to add a linked tile", async ({ page, tinyurl: id }) => {
  await tile(page, "Redirect service").click();
  // One link tab on the right, and on the left only the module `+` (linking existing tiles is
  // Connect mode's).
  const side = (which: string) =>
    tile(page, "Redirect service").locator(`.board-tabs[data-side="${which}"] .board-tab`);
  await expect(side("after")).toHaveCount(1);
  await expect(side("after")).toHaveAttribute("data-glyph", "link");
  await expect(side("before")).toHaveCount(1);
  await expect(side("before")).toHaveAttribute("aria-label", "Add module");
  await pull(page, "Redirect service", LINK_TAB);
  // All eleven kinds, captioned, a row per group in a fixed order; after a service all fit.
  await expect(fan(page)).toHaveCount(11);
  await expect(page.locator(".board-pull .board-fan-caption")).toHaveText(FAN.flat());
  await expect(page.locator('.board-pull [aria-disabled="true"]')).toHaveCount(0);
  const rows = await fan(page).evaluateAll((items) =>
    items.map((item) => (item as HTMLElement).style.top),
  );
  expect(new Set(rows).size).toBe(4);
  expect(rows.slice(0, 4).every((top) => top === rows[0])).toBe(true);
  // Every item and its caption is on screen.
  for (const item of await fan(page).all()) await expect(item).toBeInViewport({ ratio: 1 });
  await moveOnto(page, fanItem(page, "Cache"));
  await page.mouse.up();

  await ready(page);
  await expect(tiles(page)).toHaveCount(12);
  await expect(lines(page)).toHaveCount(13);
  await expect(tile(page, "Cache")).toHaveClass(/selected/);
  await expect(page.locator(".studio-inspector").getByLabel("Name", { exact: true })).toBeFocused();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.connections.find((c) => c.to.element === "cache")?.from.element).toBe("redirect");
});

test("greys the kinds the rules refuse there, with the reason", async ({ page, tinyurl: id }) => {
  // A store links onward to nothing: no tabs at all, only its X.
  await tile(page, "URL database").click();
  await expect(tile(page, "URL database").locator(".board-tab")).toHaveCount(0);

  // After a queue only applications fit: a Service and a Worker both consume.
  await tile(page, "Click events").click();
  await pull(page, "Click events", LINK_TAB);
  await expect(fan(page)).toHaveCount(11);
  for (const name of FAN[0] ?? [])
    await expect(fanItem(page, name)).not.toHaveAttribute("aria-disabled");
  for (const name of [...(FAN[1] ?? []), ...(FAN[2] ?? []), ...(FAN[3] ?? [])])
    await expect(fanItem(page, name)).toHaveAttribute("aria-disabled", "true");
  await moveOnto(page, fanItem(page, "Search index"));
  // Its tip gives the name and the reason; releasing there changes nothing.
  const tip = page.locator(".board-fan-tip");
  await expect(tip).toContainText("Search index");
  await expect(tip.locator(".board-fan-reason")).toHaveText(
    "Click events can't link to a search index. A queue feeds only an application, not a search index.",
  );
  await page.mouse.up();

  await expect(fan(page)).toHaveCount(0);
  await expect(tiles(page)).toHaveCount(11);
  expect((await design(page, id)).revision).toBe(1);
});

test("a greyed kind's tip never hides the kind below it", async ({ page, tinyurl: id }) => {
  // After an action, Message channel is greyed; its tip, with the reason, hangs over CDN below it.
  await tile(page, "Open link").click();
  await pull(page, "Open link", LINK_TAB);
  await moveOnto(page, fanItem(page, "Message channel"));
  const tip = page.locator(".board-fan-tip");
  await expect(tip.locator(".board-fan-reason")).toBeVisible();
  const [over, under] = [await tip.boundingBox(), await fanItem(page, "CDN").boundingBox()];
  if (!over || !under) throw new Error("No tip or CDN.");
  expect(over.y + over.height).toBeGreaterThan(under.y + under.height / 2);
  // Straight down onto CDN: the pointer passes through the tip, and CDN is picked.
  await moveOnto(page, fanItem(page, "CDN"));
  await expect(fanItem(page, "CDN")).toHaveAttribute("data-hover", "true");
  await page.mouse.up();
  await ready(page);
  await expect(tile(page, "CDN")).toHaveClass(/selected/);
  expect((await design(page, id)).architecture.studio.entries.at(-1)).toMatchObject({
    lane: "download",
    element: "cdn",
  });
});

test("a link tab released on a tile changes nothing", async ({ page, tinyurl: id }) => {
  await tile(page, "Redirect service").click();
  // The fan opens on the right; Open link, on the left, is no target.
  await pull(page, "Redirect service", LINK_TAB);
  await expect(fan(page)).toHaveCount(11);
  await expect(page.locator(".board-scrim")).toHaveCount(0);
  await moveOnto(page, tile(page, "Open link"));
  await expect(tile(page, "Open link")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();

  await expect(fan(page)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(12);
  await expect(page.locator(".studio-notice")).toHaveCount(0);
  expect((await design(page, id)).revision).toBe(1);
});

test("an action's link tab adds an entry; a drag in Connect mode adds one too", async ({
  page,
  tinyurl: id,
}) => {
  const tabs = (name: string) => tile(page, name).locator(".board-tab");
  await tile(page, "User").click();
  // TinyURL has both actions, so the user's one `+` is gone.
  await expect(tabs("User")).toHaveCount(0);

  // An action has the link tab on its right and nothing on its left.
  await tile(page, "Open link").click();
  await expect(tabs("Open link")).toHaveCount(1);
  await expect(tabs("Open link")).toHaveAttribute("data-glyph", "link");
  await pull(page, "Open link", LINK_TAB);
  // An entry is a service (not a worker), Uploads, Identity or the CDN.
  for (const name of ["Microservice", "Uploads", "Identity", "CDN"])
    await expect(fanItem(page, name)).not.toHaveAttribute("aria-disabled");
  for (const name of FAN.flat().filter(
    (name) => !["Microservice", "Uploads", "Identity", "CDN"].includes(name),
  ))
    await expect(fanItem(page, name)).toHaveAttribute("aria-disabled", "true");
  await moveOnto(page, fanItem(page, "Object storage"));
  await expect(page.locator(".board-fan-tip .board-fan-reason")).toHaveText(
    "Open link can't link to object storage. An action reaches a service (not a worker), an API or the CDN.",
  );
  await moveOnto(page, fanItem(page, "Identity"));
  await page.mouse.up();
  await ready(page);
  await expect(tile(page, "Identity")).toHaveClass(/selected/);
  await expect(lines(page)).toHaveCount(13);
  let saved = await design(page, id);
  expect(saved.architecture.studio.entries.at(-1)).toEqual({
    id: "download-identity",
    lane: "download",
    element: "identity",
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(tile(page, "Identity")).toHaveCount(0);
  await expect(lines(page)).toHaveCount(12);

  // A Microservice after the Shorten service has no entry: a drag from Shorten makes it one.
  await tile(page, "Shorten service").click();
  await pull(page, "Shorten service", LINK_TAB);
  await moveOnto(page, fanItem(page, "Microservice"));
  await page.mouse.up();
  await ready(page);
  await expect(lines(page)).toHaveCount(13);
  await tile(page, "Shorten").click();
  await expect(tabs("Shorten")).toHaveCount(1);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await dragOnto(page, tile(page, "Shorten"), tile(page, "Redirect service"));
  // A tile has one entry: Redirect service starts the download lane, so it stays dimmed.
  await expect(tile(page, "Microservice")).toHaveClass(/is-drop-target/);
  await expect(tile(page, "Redirect service")).not.toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(page.locator(".studio-notice")).toHaveText(
    "Redirect service already starts the download lane; a tile has one entry.",
  );
  await expect(lines(page)).toHaveCount(13);
  await page.getByRole("button", { name: "Dismiss notice" }).click();

  await dragOnto(page, tile(page, "Shorten"), tile(page, "Microservice"));
  await page.mouse.up();
  await ready(page);
  await expect(lines(page)).toHaveCount(14);
  await expect(tile(page, "Shorten")).toHaveClass(/selected/);
  saved = await design(page, id);
  // Add, Undo, add, connect.
  expect(saved.revision).toBe(5);
  expect(saved.architecture.studio.entries.map((e) => `${e.lane} ${e.element}`)).toEqual([
    "download stats-api",
    "download redirect",
    "upload shorten",
    "upload microservice",
  ]);
});

test("builds both actions from a blank design", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Blank actions", "blank");
  try {
    // A blank design opens with the user selected and its one `+`.
    await expect(tile(page, "User").locator(".board-tab")).toHaveCount(1);
    await expect(tile(page, "User").locator(".board-tab")).toHaveAttribute("data-glyph", "plus");
    await pull(page, "User", "Add action");
    await expect(fan(page)).toHaveCount(2);
    await moveOnto(page, fanItem(page, "Consume"));
    await page.mouse.up();
    await ready(page);
    // The new action is selected with its Name ready to type over.
    const name = page.locator(".studio-inspector").getByLabel("Name", { exact: true });
    await expect(name).toBeFocused();
    await name.fill("Watch");
    await name.blur();
    await expect(tile(page, "Watch")).toBeVisible();
    // An action with no entries is a warning, never a refusal: a mark on the tile, a line in its
    // inspector.
    const nothing =
      "Watch has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action.";
    await expect(tile(page, "Watch").locator(".lane-warning-mark")).toHaveAttribute(
      "title",
      nothing,
    );
    await expect(
      page.locator(".studio-inspector").getByRole("list", { name: "Warnings" }),
    ).toHaveText(nothing);

    await pull(page, "Watch", LINK_TAB);
    await moveOnto(page, fanItem(page, "Microservice"));
    await page.mouse.up();
    await ready(page);
    await expect(tile(page, "Microservice")).toHaveClass(/selected/);
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);

    // The user's `+` greys the action the design already has.
    await tile(page, "User").click();
    await pull(page, "User", "Add action");
    await expect(fanItem(page, "Consume")).toHaveAttribute("aria-disabled", "true");
    await moveOnto(page, fanItem(page, "Consume"));
    await expect(page.locator(".board-fan-tip .board-fan-reason")).toHaveText(
      "This design already has a Consume action; each lane has one.",
    );
    await moveOnto(page, fanItem(page, "Produce"));
    await page.mouse.up();
    await ready(page);
    await expect(tiles(page)).toHaveCount(4);
    await expect(lines(page)).toHaveCount(3);
    await expect(tile(page, "Produce").locator(".lane-warning-mark")).toHaveCount(1);
    // The system inspector lists every warning; its button selects the action.
    await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
    const all = page.locator(".studio-inspector").getByRole("list", { name: "Warnings" });
    await expect(all.getByRole("listitem")).toHaveCount(1);
    await all.getByRole("button", { name: "Produce" }).click();
    await expect(tile(page, "Produce")).toHaveClass(/selected/);
    const saved = await design(page, id);
    expect(saved.architecture.studio.actions).toEqual([
      { lane: "download", name: "Watch" },
      { lane: "upload", name: "Produce" },
    ]);
    expect(saved.architecture.studio.entries).toEqual([
      { id: "download-microservice", lane: "download", element: "microservice" },
    ]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("creates each of the eleven kinds by mouse, with its icon and label, and Undo removes one", async ({
  page,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Every kind", "blank");
  try {
    await pull(page, "User", "Add action");
    await moveOnto(page, fanItem(page, "Consume"));
    await page.mouse.up();
    await ready(page);
    // Each kind from a tile it may follow: the action's entries, then a service's stores, then
    // the Uploads service's queue, external API and worker. A tile links to at most four.
    // A new message channel is a work queue, so its label reads Queue.
    const plan: [from: string, name: string, kind: string, icon: string, label: string][] = [
      ["Consume", "Microservice", "service", "server", "Service"],
      ["Consume", "Uploads", "uploads", "cloud-upload", "Uploads"],
      ["Consume", "Identity", "identity", "lock", "Identity"],
      ["Consume", "CDN", "cdn", "world", "CDN"],
      ["Microservice", "Database", "database", "database", "Database"],
      ["Microservice", "Search index", "search", "search", "Search index"],
      ["Microservice", "Cache", "cache", "bolt", "Cache"],
      ["Microservice", "Object storage", "object-store", "archive", "Object storage"],
      ["Uploads", "Message channel", "queue", "list", "Queue"],
      ["Uploads", "External API", "external-api", "plug", "External API"],
      ["Uploads", "Worker service", "worker", "cpu", "Worker"],
    ];
    for (const [index, [from, name, kind, icon, label]] of plan.entries()) {
      await tile(page, from).click();
      await pull(page, from, LINK_TAB);
      await moveOnto(page, fanItem(page, name));
      await page.mouse.up();
      await ready(page);
      // The new tile is named after its kind, shows its kind's icon and label and is selected.
      const added = tile(page, name);
      await expect(added).toHaveClass(/selected/);
      await expect(added.locator(`.lane-tile-icon svg.tabler-icon-${icon}`)).toHaveCount(1);
      await expect(added.locator(".lane-tile-kind")).toHaveText(label);
      await expect(tiles(page)).toHaveCount(3 + index);
      const saved = await design(page, id);
      const element = saved.elements.find((e) => e.name === name)?.id;
      expect(
        saved.architecture.studio.elements.find((e) => e.element === element)?.settings.kind,
      ).toBe(kind);
      expect(saved.connections.find((c) => c.to.element === element)?.from.element ?? "entry").toBe(
        from === "Consume" ? "entry" : saved.elements.find((e) => e.name === from)?.id,
      );
    }
    const saved = await design(page, id);
    expect(saved.architecture.studio.entries.map((e) => e.element)).toEqual([
      "microservice",
      "uploads",
      "identity",
      "cdn",
    ]);
    expect(
      new Set(saved.architecture.studio.elements.map((e) => e.settings.kind as string)),
    ).toEqual(new Set(plan.map(([, , kind]) => kind)));

    // Undo takes the last tile and its link back out, in one step.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(tile(page, "Worker service")).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(12);
    await expect
      .poll(async () => (await design(page, id)).elements.map((e) => e.id))
      .not.toContain("worker-service");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

/**
 * Modules on tiles (MA06, V3-03, UI06): the `+` inside a tile opens the menu of the module kinds
 * it allows, grouped by what they do, each with a dot for Generated, Building block or You write
 * it; a picked kind becomes a module that opens with its name focused. In the Detailed view a row that can connect has a dot: in Connect mode a drag
 * from it runs `connectModule`, the Cache reader's loader is a row→row drag drawn as a gutter
 * arrow (so is Favorites' items), and the right-click menu of a module's line or arrow runs
 * `disconnectModule`.
 * Every change is one command and one Undo step; looking, hovering and cancelled drags change
 * nothing.
 */
import type { Locator, Page } from "@playwright/test";
import {
  addModuleFrom,
  createStudy,
  design,
  dragOnto,
  expect,
  linePoint,
  moduleMenu,
  pickFrom,
  pickFromMenu,
  ready,
  stillBoard,
  test,
  tile,
} from "./studio.ts";

const PLUS = "Add module";
const LINK_TAB = "Add linked tile";
/** The open menu's kinds, each with its dot's word: [name, word]. */
const menuKinds = (page: Page) =>
  moduleMenu(page)
    .getByRole("menuitem")
    .evaluateAll((items) =>
      items.map((item) => [
        item.getAttribute("aria-label"),
        item.querySelector(".lane-generation-dot")?.getAttribute("title"),
      ]),
    );
const inspector = (page: Page) => page.locator(".studio-inspector");
const status = (page: Page) => inspector(page).locator(".lane-module-status");
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();
const blueprint = async (page: Page, id: string) =>
  (await page.request.get(`/api/projects/${id}/blueprint`)).json();
const row = (page: Page, module: string) =>
  page.locator(`.board .lane-container-row[data-module="${module}"]`);
const dot = (page: Page, module: string) => row(page, module).locator(".lane-container-row-dot");

type Saved = Omit<Awaited<ReturnType<typeof design>>, "architecture"> & {
  schemaVersion: number;
  architecture: {
    studio: {
      components?: { id: string; host: string; name: string; settings: { kind: string } }[];
      componentConnections?: {
        id: string;
        from: string;
        to: { kind: string; id: string; via?: string };
      }[];
    };
  };
};
const saved = async (page: Page, id: string) => (await design(page, id)) as unknown as Saved;
const modules = async (page: Page, id: string, host: string) =>
  ((await saved(page, id)).architecture.studio.components ?? []).filter(
    (item) => item.host === host,
  );
const moduleLinks = async (page: Page, id: string) =>
  (await saved(page, id)).architecture.studio.componentConnections ?? [];

/**
 * The menu's kinds for a Service and a Worker, in menu order (Requests, Data, Events, Files &
 * media, Custom): [name, word].
 */
const SERVICE = [
  ["Rate limiter", "You write it"],
  ["Redirect responder", "You write it"],
  ["Auth guard", "Generated"],
  ["External call", "You write it"],
  ["Cache reader", "Generated"],
  ["ID generator", "You write it"],
  ["Data access", "Building block"],
  ["Search query", "Generated"],
  ["Favorites", "Generated"],
  ["Event publisher", "Building block"],
  ["Event consumer", "You write it"],
  ["Multipart uploads", "Generated"],
  ["Custom", "You write it"],
];
const WORKER = [
  ["Rate limiter", "You write it"],
  ["Redirect responder", "You write it"],
  ["Auth guard", "You write it"],
  ["External call", "You write it"],
  ["Cache reader", "You write it"],
  ["ID generator", "You write it"],
  ["Data access", "Building block"],
  ["Lifecycle writer", "Generated"],
  ["Event counter", "Generated"],
  ["Index writer", "Generated"],
  ["Event publisher", "Building block"],
  ["Event consumer", "Building block"],
  ["Video encoder", "Generated"],
  ["Video packager", "Building block"],
  ["Video thumbnailer", "Building block"],
  ["Custom", "You write it"],
];
/** Kinds whose rows can't connect: no dot. */
const NO_DOT = ["Redirect responder", "Event counter"];

/**
 * A blank project in the Simple view with the user's Consume action and the given tiles, each
 * added by its fan. The new tile is selected only once its commit lands, so each step waits for
 * that: a commit landing after the next click would move the selection off `from` and hide its
 * tabs. The board can still be moving after `ready` (its layout animation and camera), so each
 * click on `from` waits for a still board: a click aimed during that motion misses the tile.
 */
async function build(page: Page, name: string, plan: [from: string, kind: string][]) {
  const id = await createStudy(page, name, "blank", "Simple");
  await pickFrom(page, "User", "Add action", "Consume");
  await expect(tile(page, "Consume")).toHaveClass(/selected/);
  await ready(page);
  for (const [from, kind] of plan) {
    await stillBoard(page);
    await tile(page, from).click();
    await pickFrom(page, from, LINK_TAB, kind);
    await expect(tile(page, kind)).toHaveClass(/selected/);
    await ready(page);
  }
  return id;
}

/**
 * Picks `kind` from the module menu of the `+` in tile `host` (in Simple, the selected tile's);
 * its page opens with the name focused.
 */
async function addModule(page: Page, host: string, kind: string) {
  await addModuleFrom(page, tile(page, host), kind);
  const name = inspector(page).getByLabel("Name", { exact: true });
  await expect(name).toHaveValue(kind);
  await expect(name).toBeFocused();
  await expect(inspector(page).getByRole("button", { name: `Back to ${host}` })).toBeVisible();
}

/** A screen point on the middle of a loader arrow's run. */
const arrowPoint = (arrow: Locator) =>
  arrow.locator(".lane-container-loader-hit").evaluate((element) => {
    const path = element as SVGPathElement;
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("The arrow is not drawn.");
    const at = path.getPointAtLength(path.getTotalLength() / 2);
    const screen = new DOMPoint(at.x, at.y).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  });

test("adds a module of every menu kind to a Service and a Worker by mouse", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module fan", [
    ["Consume", "Microservice"],
    ["Microservice", "Message channel"],
    ["Message channel", "Worker service"],
  ]);
  try {
    // A selected Service in the Simple view: the `+` inside it (no tab on its left), the link tab
    // on its right.
    await tile(page, "Microservice").click();
    const service = tile(page, "Microservice");
    await expect(service.locator(".board-tab")).toHaveCount(1);
    await expect(service.locator(".board-tab")).toHaveAttribute("aria-label", LINK_TAB);
    const plus = service.locator(".lane-tile-add");
    await expect(plus).toHaveAttribute("aria-label", PLUS);
    // Its menu: the thirteen kinds a Service allows, grouped by what they do, each named, with its
    // dot, and described, all on screen.
    await plus.click();
    await expect(moduleMenu(page).getByRole("menuitem")).toHaveCount(SERVICE.length);
    expect(await menuKinds(page)).toEqual(SERVICE);
    await expect(moduleMenu(page)).toBeInViewport({ ratio: 1 });
    await expect(
      moduleMenu(page).getByRole("menuitem", { name: "Data access", exact: true }),
    ).toContainText("Reads and writes one database.");
    // Cancelled: nothing is added.
    await page.keyboard.press("Escape");
    await expect(moduleMenu(page)).toHaveCount(0);
    expect((await saved(page, id)).architecture.studio.components ?? []).toEqual([]);

    // Every kind, in the Simple view: each is one step and opens unconnected, as a stub.
    for (const [index, [kind]] of SERVICE.entries()) {
      await addModule(page, "Microservice", kind as string);
      await expect(status(page).locator("strong")).toHaveText("You write it");
      await expect
        .poll(async () => (await modules(page, id, "microservice")).length)
        .toBe(index + 1);
    }
    const added = await modules(page, id, "microservice");
    expect(added.map((item) => item.name)).toEqual(SERVICE.map(([kind]) => kind));
    expect((await saved(page, id)).schemaVersion).toBe(3);
    // The tile's page lists them as cards.
    await inspector(page).getByRole("button", { name: "Back to Microservice" }).click();
    await expect(
      inspector(page).getByRole("list", { name: "Modules", exact: true }).getByRole("button"),
    ).toHaveCount(SERVICE.length);

    // A Worker, in the Detailed view: the `+` in its container, selected or not; its sixteen
    // kinds, each a new row.
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await tile(page, "Worker service").getByRole("button", { name: PLUS }).click();
    expect(await menuKinds(page)).toEqual(WORKER);
    await expect(moduleMenu(page)).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    for (const [index, [kind]] of WORKER.entries()) {
      await addModule(page, "Worker service", kind as string);
      await ready(page);
      await expect(tile(page, "Worker service").locator(".lane-container-row")).toHaveCount(
        index + 1,
      );
    }
    // Every row is open to a connection but those of kinds that take none; none is connected.
    const worker = tile(page, "Worker service");
    await expect(worker.locator(".lane-container-row-dot")).toHaveCount(
      WORKER.length - NO_DOT.length,
    );
    await expect(worker.locator(".lane-container-row-dot[data-connected]")).toHaveCount(0);
    for (const kind of NO_DOT)
      await expect(
        worker.locator(".lane-container-row", { hasText: kind }).locator(".lane-container-row-dot"),
      ).toHaveCount(0);

    // One Undo takes the last module back out.
    const before = (await saved(page, id)).revision;
    await undo(page);
    await expect(worker.locator(".lane-container-row")).toHaveCount(WORKER.length - 1);
    await expect
      .poll(async () => (await modules(page, id, "worker-service")).map((item) => item.name))
      .toEqual(WORKER.slice(0, -1).map(([kind]) => kind));
    expect((await saved(page, id)).revision).toBe(before + 1);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("connects a module from its dot, refuses with the reason, and disconnects from its line's menu", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module connect", [
    ["Consume", "Microservice"],
    ["Microservice", "Database"],
    ["Microservice", "Cache"],
  ]);
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Data access");
    // Unconnected is allowed: a stub, with what its template still needs.
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText("No template in Microservice uses it.");

    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    const module = "microservice-data-access";
    await expect(dot(page, module)).not.toHaveAttribute("data-connected");
    const unconnected = await saved(page, id);

    // A tile it can't use fades, with the reason; on release the notice says it and nothing
    // changes.
    await dragOnto(page, dot(page, module), tile(page, "Cache"));
    const reason = "Data access can't use Cache; a Data access connects to a database.";
    await expect(page.locator(".board-connect-tip")).toHaveText(reason);
    await expect(tile(page, "Cache")).not.toHaveClass(/is-drop-target/);
    await expect(tile(page, "Database")).toHaveClass(/is-drop-target/);
    await page.mouse.up();
    await expect(page.locator(".studio-notice")).toHaveText(reason);
    await page.getByRole("button", { name: "Dismiss notice" }).click();
    expect(await saved(page, id)).toEqual(unconnected);

    // The Database: exactly one module link, through the tiles' existing link, in one step.
    await dragOnto(page, dot(page, module), tile(page, "Database"));
    await expect(tile(page, "Database")).toHaveClass(/is-drop-over/);
    await page.mouse.up();
    await expect(dot(page, module)).toHaveAttribute("data-connected", "true");
    const connected = await saved(page, id);
    expect(connected.revision).toBe(unconnected.revision + 1);
    expect(connected.connections).toEqual(unconnected.connections);
    expect(connected.architecture.studio.componentConnections).toEqual([
      {
        id: "microservice-data-access-database",
        from: module,
        to: { kind: "element", id: "database", via: "microservice-database" },
      },
    ]);
    await ready(page);
    const drawn = "microservice-database/microservice-data-access";
    await expect(page.locator(`.board .react-flow__edge[data-id="${drawn}"]`)).toHaveCount(1);

    // Its line's menu disconnects the module; the tiles' link stays.
    await pickFromMenu(page, await linePoint(page, drawn), "Disconnect Data access from Database");
    await expect(dot(page, module)).not.toHaveAttribute("data-connected");
    const disconnected = await saved(page, id);
    expect(disconnected.revision).toBe(connected.revision + 1);
    expect(disconnected.architecture.studio.componentConnections).toEqual([]);
    expect(disconnected.connections).toEqual(unconnected.connections);
    await expect(
      page.locator('.board .react-flow__edge[data-id="microservice-database"]'),
    ).toHaveCount(1);

    // Undo: connected again, then unconnected, one step each.
    await undo(page);
    await expect(dot(page, module)).toHaveAttribute("data-connected", "true");
    await expect
      .poll(async () => (await moduleLinks(page, id)).map((link) => link.id))
      .toEqual(["microservice-data-access-database"]);
    await undo(page);
    await expect(dot(page, module)).not.toHaveAttribute("data-connected");
    await expect
      .poll(async () => ({ ...(await saved(page, id)), revision: 0 }))
      .toEqual({ ...unconnected, revision: 0 });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("the Cache reader's loader is a row-to-row drag, drawn as a gutter arrow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module loader", [
    ["Consume", "Microservice"],
    ["Microservice", "Cache"],
    ["Microservice", "Database"],
  ]);
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Cache reader");
    await addModule(page, "Microservice", "Data access");
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    const reader = "microservice-cache-reader";
    const data = "microservice-data-access";
    await dragOnto(page, dot(page, reader), tile(page, "Cache"));
    await page.mouse.up();
    await expect(dot(page, reader)).toHaveAttribute("data-connected", "true");
    await dragOnto(page, dot(page, data), tile(page, "Database"));
    await page.mouse.up();
    await expect(dot(page, data)).toHaveAttribute("data-connected", "true");
    await ready(page);
    const before = await saved(page, id);

    // From the reader's dot onto the Data access row of its own tile: the row is the end.
    await dragOnto(page, dot(page, reader), row(page, data));
    await expect(page.locator(`.board-connect-ends rect[data-end="${data}"]`)).toHaveAttribute(
      "data-over",
      "true",
    );
    await page.mouse.up();
    const arrow = tile(page, "Microservice").locator(".lane-container-loader");
    await expect(arrow).toHaveCount(1);
    await expect(arrow.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Cache reader to Data access",
    );
    const loaded = await saved(page, id);
    expect(loaded.revision).toBe(before.revision + 1);
    expect(loaded.architecture.studio.componentConnections?.at(-1)).toEqual({
      id: `${reader}-${data}`,
      from: reader,
      to: { kind: "component", id: data },
    });
    // The reader now leads its template.
    await row(page, reader).getByRole("button").click();
    await expect(status(page)).toHaveAttribute("data-status", "template");
    await expect(status(page)).toHaveText("GeneratedCache read");

    // The arrow's menu, titled with the link, disconnects the loader.
    const at = await arrowPoint(arrow);
    await page.mouse.click(at.x, at.y, { button: "right" });
    await expect(page.getByRole("menu")).toContainText("Cache reader to Data access");
    await page.getByRole("menuitem", { name: "Disconnect", exact: true }).click();
    await expect(arrow).toHaveCount(0);
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText("Needs");
    expect(await moduleLinks(page, id)).toEqual(before.architecture.studio.componentConnections);
    await undo(page);
    await expect(arrow).toHaveCount(1);
    await expect(status(page)).toHaveAttribute("data-status", "template");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("looking, hovering and cancelled drags change neither the design nor the blueprint", async ({
  page,
  tinyurl: id,
}) => {
  const before = { design: await saved(page, id), blueprint: await blueprint(page, id) };
  // The Redirect service is a Service: its module menu, opened and closed.
  await tile(page, "Redirect service").getByRole("button", { name: PLUS }).click();
  await expect(moduleMenu(page).getByRole("menuitem")).toHaveCount(13);
  await page.keyboard.press("Escape");
  await expect(moduleMenu(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  await ready(page);
  // A Redirect responder takes no connections: no dot. The Cache reader's loader is drawn, and
  // no other link between modules of a tile is.
  await expect(dot(page, "redirect-responder")).toHaveCount(0);
  await expect(dot(page, "redirect-cache-reader")).toHaveAttribute("data-connected", "true");
  await expect(page.locator(".board .lane-container-loader")).toHaveCount(1);
  await expect(page.locator(".board .lane-container-loader")).toHaveAttribute(
    "data-link",
    "cache-reader-miss",
  );
  // Clicking a row opens its module; in Select mode the dot is just a mark.
  await row(page, "redirect-data").getByRole("button").click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Link reader");

  await page.keyboard.press("c");
  // A drag from a dot, cancelled with Escape or released on paper; a hovered module line.
  await dragOnto(page, dot(page, "redirect-data"), tile(page, "URL database"));
  await page.keyboard.press("Escape");
  await expect(page.locator(".board-connect")).toHaveCount(0);
  await page.mouse.up();
  await dragOnto(page, dot(page, "redirect-data"), tile(page, "URL database"));
  const paper = await page.locator(".lane-canvas").boundingBox();
  if (!paper) throw new Error("No canvas.");
  await page.mouse.move(paper.x + 30, paper.y + paper.height - 80, { steps: 6 });
  await page.mouse.up();
  // A module's line and the loader arrow, hovered and right-clicked: their menus, closed unpicked.
  const at = await linePoint(page, "redirect-db/redirect-data");
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.mouse.click(at.x, at.y, { button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Disconnect Link reader from URL database" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  const arrow = page.locator(".board .lane-container-loader");
  const point = await arrowPoint(arrow);
  await page.mouse.move(point.x, point.y, { steps: 4 });
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page.getByRole("menuitem", { name: "Disconnect", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("v");
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  await ready(page);

  expect(await saved(page, id)).toEqual(before.design);
  expect(await blueprint(page, id)).toEqual(before.blueprint);
});

test("a module added to a study tile shows its kept Service identity as Refused", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Module study", "YouTube · studio study", "Simple");
  try {
    const before = await saved(page, id);
    // Before any module command a study's modules have no generation declaration.
    await tile(page, "Watch API").click();
    await inspector(page).getByRole("button", { name: "Open Details cache", exact: true }).click();
    await expect(status(page)).toHaveAttribute("data-status", "custom");
    await inspector(page).getByRole("button", { name: "Back to Watch API" }).click();

    // Adding a module derives the tile's generation: the new module is a stub, and the cache read
    // the study already wires is Refused, calmly, with the reason its kept links give.
    await addModule(page, "Watch API", "Custom");
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await inspector(page).getByRole("button", { name: "Back to Watch API" }).click();
    await inspector(page).getByRole("button", { name: "Open Details cache", exact: true }).click();
    await expect(status(page)).toHaveAttribute("data-status", "refused");
    await expect(status(page).locator("strong")).toHaveText("Refused");
    await expect(status(page)).toContainText("Service identity");
    // One Undo returns the study exactly.
    await undo(page);
    await expect(status(page)).toHaveAttribute("data-status", "custom");
    await expect
      .poll(async () => ({ ...(await saved(page, id)), revision: 0 }))
      .toEqual({ ...before, revision: 0 });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("an Auth guard is a Template once it verifies an Identity: Sign-in Required, or Optional by mouse", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Sign-in", [
    ["Consume", "Microservice"],
    ["Microservice", "Identity"],
  ]);
  const module = "microservice-auth-guard";
  const settings = async () =>
    (await saved(page, id)).architecture.studio.components?.find((item) => item.id === module)
      ?.settings;
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Auth guard");
    // Unconnected: a stub, with no Sign-in until it generates.
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText("Needs a connection to an identity service.");
    await expect(inspector(page).getByLabel("Sign-in", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, module), tile(page, "Identity"));
    await expect(tile(page, "Identity")).toHaveClass(/is-drop-over/);
    await page.mouse.up();
    await expect(dot(page, module)).toHaveAttribute("data-connected", "true");
    await ready(page);
    await page.keyboard.press("v");
    await row(page, module)
      .getByRole("button", { name: "Open Auth guard in Microservice", exact: true })
      .click();

    // Its template is the sign-in, Required at first; Credential stays fixed and hidden.
    await expect(status(page)).toHaveAttribute("data-status", "template");
    await expect(status(page)).toContainText("Sign-in");
    const select = inspector(page).getByLabel("Sign-in", { exact: true });
    await expect(select).toHaveValue("required");
    await expect(inspector(page).getByLabel("Credential", { exact: true })).toHaveCount(0);
    await expect.poll(settings).toMatchObject({ signIn: "required" });
    const required = await saved(page, id);
    const selection = (
      required as unknown as {
        generation: { selections: { id: string; template: { id: string } }[] };
      }
    ).generation.selections.find((item) => item.id === module);
    expect(selection?.template.id).toBe("verified-identity");

    // Optional saves in one step, and Undo returns Required.
    await select.selectOption({ label: "Optional" });
    await expect.poll(settings).toMatchObject({ signIn: "optional" });
    expect((await saved(page, id)).revision).toBe(required.revision + 1);
    await expect(status(page)).toHaveAttribute("data-status", "template");
    await undo(page);
    await expect.poll(settings).toMatchObject({ signIn: "required" });
    await expect(select).toHaveValue("required");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("Favorites is a Template beside a Required Auth guard; its items are a row-to-row drag onto a Data access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Favorites", [
    ["Consume", "Microservice"],
    ["Microservice", "Database"],
    ["Microservice", "Identity"],
  ]);
  const guard = "microservice-auth-guard";
  const favorites = "microservice-favorites";
  const data = "microservice-data-access";
  const open = async (module: string, kind: string) => {
    await page.keyboard.press("v");
    await row(page, module)
      .getByRole("button", { name: `Open ${kind} in Microservice`, exact: true })
      .click();
  };
  try {
    // A second database, for the items.
    await tile(page, "Microservice").click();
    await pickFrom(page, "Microservice", LINK_TAB, "Database");
    await expect(tile(page, "Database 2")).toHaveClass(/selected/);
    await ready(page);
    await tile(page, "Microservice").click();
    // The + lists Favorites as Generated, with its one line.
    await tile(page, "Microservice").locator(".lane-tile-add").click();
    expect(await menuKinds(page)).toContainEqual(["Favorites", "Generated"]);
    await expect(
      moduleMenu(page).getByRole("menuitem", { name: "Favorites", exact: true }),
    ).toContainText("Keeps each signed-in account's favorite items.");
    await page.keyboard.press("Escape");
    await addModule(page, "Microservice", "Favorites");
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText("Needs a connection to a database.");
    await addModule(page, "Microservice", "Auth guard");
    await addModule(page, "Microservice", "Data access");

    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, favorites), tile(page, "Database"));
    await page.mouse.up();
    await expect(dot(page, favorites)).toHaveAttribute("data-connected", "true");
    await dragOnto(page, dot(page, data), tile(page, "Database 2"));
    await page.mouse.up();
    await expect(dot(page, data)).toHaveAttribute("data-connected", "true");
    await ready(page);
    // Without a guard it is a Stub, with the reason.
    await open(favorites, "Favorites");
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText(
      "Needs an Auth guard set to Required in Microservice.",
    );
    // A Required guard beside it makes it a Template.
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, guard), tile(page, "Identity"));
    await page.mouse.up();
    await expect(dot(page, guard)).toHaveAttribute("data-connected", "true");
    await ready(page);
    await open(favorites, "Favorites");
    await expect(status(page)).toHaveAttribute("data-status", "template");
    await expect(status(page)).toHaveText("GeneratedFavorites");
    const before = await saved(page, id);

    // Its items: from its dot onto the Data access row of its own tile, drawn as a gutter arrow.
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, favorites), row(page, data));
    await expect(page.locator(`.board-connect-ends rect[data-end="${data}"]`)).toHaveAttribute(
      "data-over",
      "true",
    );
    await page.mouse.up();
    const arrow = tile(page, "Microservice").locator(".lane-container-loader");
    await expect(arrow).toHaveCount(1);
    await expect(arrow.getByRole("img")).toHaveAttribute("aria-label", "Favorites to Data access");
    const linked = await saved(page, id);
    expect(linked.revision).toBe(before.revision + 1);
    expect(linked.architecture.studio.componentConnections?.at(-1)).toEqual({
      id: `${favorites}-${data}`,
      from: favorites,
      to: { kind: "component", id: data },
    });
    // The Data access is now its part.
    await open(data, "Data access");
    await expect(status(page)).toHaveAttribute("data-status", "template");
    await expect(status(page)).toHaveText("GeneratedFavorites");

    // Sign-in Optional: Favorites waits for Required again; Undo brings it back.
    await open(guard, "Auth guard");
    await inspector(page)
      .getByLabel("Sign-in", { exact: true })
      .selectOption({ label: "Optional" });
    await expect.poll(async () => (await saved(page, id)).revision).toBe(linked.revision + 1);
    await open(favorites, "Favorites");
    await expect(status(page)).toHaveAttribute("data-status", "stub");
    await expect(status(page)).toContainText(
      "Needs an Auth guard set to Required in Microservice.",
    );
    await undo(page);
    await expect(status(page)).toHaveAttribute("data-status", "template");

    // In Connect mode, as in Pointer, the arrow's menu disconnects the items; Undo returns them.
    await page.keyboard.press("c");
    await pickFromMenu(page, await arrowPoint(arrow), "Disconnect");
    await expect(arrow).toHaveCount(0);
    expect(await moduleLinks(page, id)).toEqual(before.architecture.studio.componentConnections);
    await undo(page);
    await expect(arrow).toHaveCount(1);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("a cache read built by mouse previews its template for the lead and its part", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module template", [
    ["Consume", "Microservice"],
    ["Microservice", "Cache"],
    ["Microservice", "Database"],
  ]);
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Cache reader");
    await addModule(page, "Microservice", "Data access");
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    const reader = "microservice-cache-reader";
    const data = "microservice-data-access";
    await dragOnto(page, dot(page, reader), tile(page, "Cache"));
    await page.mouse.up();
    await dragOnto(page, dot(page, data), tile(page, "Database"));
    await page.mouse.up();
    await dragOnto(page, dot(page, reader), row(page, data));
    await page.mouse.up();
    await expect(tile(page, "Microservice").locator(".lane-container-loader")).toHaveCount(1);
    await ready(page);
    await page.keyboard.press("v");
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const rows = dialog
      .getByRole("list", { name: "Generated modules", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    for (const [index, name] of ["Cache reader", "Data access"].entries()) {
      await expect(rows.nth(index)).toContainText(`${name} in Microservice`);
      await expect(rows.nth(index).locator(".lane-module-status")).toHaveAttribute(
        "data-status",
        "template",
      );
      await expect(rows.nth(index)).toContainText("Cache read");
    }
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    expect(preview.report.findings).toEqual([]);
    expect(
      preview.report.modules.map((item: { module: string; status: string; template: string }) => [
        item.module,
        item.status,
        item.template,
      ]),
    ).toEqual([
      [reader, "template", "positive-cache-read"],
      [data, "template", "positive-cache-read"],
    ]);
    // The lead's template code, and no stub.
    for (const item of preview.report.modules as { files: string[] }[]) {
      expect(item.files).toContain("src/runtime/positive-cache.ts");
      expect(item.files.some((file) => file.startsWith("src/modules/"))).toBe(false);
    }
    await expect(dialog.getByText(/^Ready: \d+ files/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("Runnable processes is saved by its checkbox: Preview lists the processes and loops, Undo unticks it and a study refuses it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Runnable processes", [
    ["Consume", "Microservice"],
    ["Microservice", "Message channel"],
    ["Message channel", "Worker service"],
  ]);
  let study: string | undefined;
  const generation = async (project: string) =>
    (await (await page.request.get(`/api/projects/${project}/design`)).json()).design as {
      revision: number;
      generation?: { processes?: true };
    };
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Rate limiter");
    // A Worker's Event consumer, connected to the queue, runs a loop on it.
    await tile(page, "Worker service").click();
    await addModule(page, "Worker service", "Event consumer");
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, "worker-service-event-consumer"), tile(page, "Message channel"));
    await page.mouse.up();
    await expect(dot(page, "worker-service-event-consumer")).toHaveAttribute(
      "data-connected",
      "true",
    );
    await page.keyboard.press("v");
    const generate = page.getByRole("button", { name: "Generate project", exact: true });
    await generate.click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const box = dialog.getByRole("checkbox", { name: "Runnable processes" });
    await expect(box).not.toBeChecked();
    const before = await generation(id);
    await box.click();
    await expect(box).toBeChecked();
    await expect.poll(async () => (await generation(id)).generation?.processes).toBe(true);
    expect((await generation(id)).revision).toBe(before.revision + 1);
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    expect(preview.report.processes).toMatchObject({
      runnable: true,
      tiles: [
        { tile: "microservice", service: "app-microservice", shape: "http", loops: [], stores: [] },
        {
          tile: "worker-service",
          service: "app-worker-service",
          shape: "worker",
          loops: [{ queue: "message-channel", module: "worker-service-event-consumer" }],
          // The queue its consumer stub links to is provisioned for it (TP07).
          stores: [
            {
              store: "message-channel",
              kind: "queue",
              access: "consume",
              provisioned: "RabbitMQ work queue message-channel and its .failed",
            },
          ],
        },
      ],
    });
    await expect(dialog.getByText("Processes · 2 · runnable")).toBeVisible();
    const rows = dialog
      .getByRole("list", { name: "Runnable processes", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText("Worker service app-worker-service · worker");
    await expect(rows.nth(1)).toContainText("loop on message-channel");
    await expect(rows.nth(1)).toContainText("Provisioned: Message channel (queue, consume)");
    await expect(rows.nth(0)).toContainText(
      "Microservice app-microservice · HTTP, public · at /api/microservice/",
    );
    // The edge publishes it; its stub answers any method on its own path.
    await expect(dialog.getByText("Edge app-edge: /api/microservice/")).toBeVisible();
    await expect(rows.nth(0)).toContainText(
      "GET /healthz, ANY /modules/microservice-rate-limiter, ANY /modules/microservice-rate-limiter/*",
    );
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    // One Undo step unticks it.
    await undo(page);
    await expect.poll(async () => (await generation(id)).generation?.processes).toBeUndefined();
    await generate.click();
    await expect(box).not.toBeChecked();
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    // A study isn't built from modules: the box refuses with the reason and saves nothing.
    study = await createStudy(page, "E2E Runnable processes study");
    const saved = await generation(study);
    await generate.click();
    await box.click();
    await expect(
      dialog.getByText("Runnable processes needs a design built from modules.", { exact: true }),
    ).toBeVisible();
    await expect(box).not.toBeChecked();
    expect((await generation(study)).revision).toBe(saved.revision);
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
    if (study) await page.request.delete(`/api/projects/${study}`);
  }
  expect(errors).toEqual([]);
});

test("with Runnable processes on, Preview lists each writer module's own product SQL file", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Product SQL", [
    ["Consume", "Microservice"],
    ["Microservice", "Database"],
  ]);
  try {
    // Microservice created Database, so its Data access writes it (v3 contract, section 1).
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Data access");
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await page.keyboard.press("c");
    await dragOnto(page, dot(page, "microservice-data-access"), tile(page, "Database"));
    await page.mouse.up();
    await expect(dot(page, "microservice-data-access")).toHaveAttribute("data-connected", "true");
    await page.keyboard.press("v");
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const box = dialog.getByRole("checkbox", { name: "Runnable processes" });
    await box.click();
    await expect(box).toBeChecked();
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    expect(preview.report.findings).toEqual([]);
    const file = "infra/postgres/database/modules/microservice-data-access.sql";
    expect(
      preview.report.modules.map((item: { module: string; sql?: unknown }) => [
        item.module,
        item.sql,
      ]),
    ).toEqual([
      [
        "microservice-data-access",
        [{ database: "database", file, schema: "m_microservice_data_access" }],
      ],
    ]);
    const rows = dialog
      .getByRole("list", { name: "Runnable processes", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText(`Product SQL: Data access → ${file}`);
    await expect(rows.nth(0)).toContainText("Provisioned: Database (database, read-write)");
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("with Runnable processes on, a stub tile's Options show what its process runs, typing saves on the tile and Undo restores it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Process settings", [
    ["Consume", "Microservice"],
    ["Microservice", "Message channel"],
    ["Message channel", "Worker service"],
  ]);
  const settings = async (element: string) =>
    (await design(page, id)).architecture.studio.elements.find((row) => row.element === element)
      ?.settings as Record<string, unknown> | undefined;
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Rate limiter");
    await inspector(page).getByRole("button", { name: "Back to Microservice" }).click();
    const timeout = inspector(page).getByLabel("Request timeout", { exact: true });
    const limit = inspector(page).getByLabel("Concurrency limit", { exact: true });
    // Off, a stub tile's process limits are no control.
    await expect(timeout).toHaveCount(0);
    const generate = page.getByRole("button", { name: "Generate project", exact: true });
    await generate.click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const box = dialog.getByRole("checkbox", { name: "Runnable processes" });
    await box.click();
    await expect(box).toBeChecked();
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    // On: empty, each shows what the process runs, and turning it on wrote nothing.
    await tile(page, "Microservice").click();
    await expect(timeout).toHaveValue("");
    await expect(timeout).toHaveAttribute("placeholder", "1000");
    await expect(limit).toHaveAttribute("placeholder", "1000");
    expect((await settings("microservice"))?.requestTimeoutMs).toBeUndefined();
    await timeout.fill("250");
    await inspector(page).getByRole("heading", { name: "Options", exact: true }).click();
    await expect.poll(async () => (await settings("microservice"))?.requestTimeoutMs).toBe(250);
    // The Worker shows Concurrency, which its stub loops run.
    await tile(page, "Worker service").click();
    const concurrency = inspector(page).getByLabel("Concurrency", { exact: true });
    await expect(concurrency).toHaveAttribute("placeholder", "1");
    await expect(inspector(page).getByLabel("Request timeout", { exact: true })).toHaveCount(0);
    // The process runs the tile's value, listed with its origin.
    await generate.click();
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    const rows = preview.report.processes.tiles as { tile: string; settings: unknown[] }[];
    expect(rows.find((row) => row.tile === "microservice")?.settings).toEqual([
      { setting: "requestTimeoutMs", value: 250, origin: "tile" },
      { setting: "concurrencyLimit", value: 1000, origin: "fixed" },
    ]);
    expect(rows.find((row) => row.tile === "worker-service")?.settings).toEqual([
      { setting: "concurrency", value: 1, origin: "fixed" },
    ]);
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    // One Undo step takes the value off the tile again.
    await undo(page);
    await expect
      .poll(async () => (await settings("microservice"))?.requestTimeoutMs)
      .toBeUndefined();
    await tile(page, "Microservice").click();
    await expect(timeout).toHaveValue("");
    await expect(timeout).toHaveAttribute("placeholder", "1000");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("Generate project lists each module's status and previews its stubs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module stubs", [["Consume", "Microservice"]]);
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Rate limiter");
    await addModule(page, "Microservice", "Custom");
    const generate = page.getByRole("button", { name: "Generate project", exact: true });
    await expect(generate).toBeEnabled();
    await generate.click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    // Listed before any preview, from the saved design: name, tile, status and reason.
    const rows = dialog
      .getByRole("list", { name: "Generated modules", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Rate limiter in Microservice");
    await expect(rows.nth(0).locator(".lane-module-status")).toHaveAttribute("data-status", "stub");
    await expect(rows.nth(0)).toContainText("StubRate limiter has no template.");
    await expect(rows.nth(1)).toContainText("Custom in Microservice");
    await expect(rows.nth(1)).toContainText("StubYour own logic, with no template.");
    const result = page.waitForResponse((response) =>
      response.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const preview = await (await result).json();
    expect(
      preview.modules.map((row: { name: string; status: string }) => [row.name, row.status]),
    ).toEqual([
      ["Rate limiter", "stub"],
      ["Custom", "stub"],
    ]);
    expect(preview.report.findings).toEqual([]);
    expect(preview.report.modules.map((row: { files: string[] }) => row.files.at(-1))).toEqual([
      "src/modules/microservice/microservice-rate-limiter.ts",
      "src/modules/microservice/microservice-custom.ts",
    ]);
    await expect(dialog.getByText(/^Ready: \d+ files/)).toBeVisible();
    await expect(
      dialog.getByText(/Write Rate limiter in src\/modules\/microservice\//),
    ).toBeVisible();
    await expect(rows).toHaveCount(2);
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

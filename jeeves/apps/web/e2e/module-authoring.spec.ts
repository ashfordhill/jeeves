/**
 * Modules on tiles (MA06): a tile's left `+` opens the fan of the module kinds it allows, each
 * captioned Template, Part of a template or Stub; a picked kind becomes a module that opens with
 * its name focused. In the Detailed view a row that can connect has a dot: in Connect mode a drag
 * from it runs `connectModule`, the Cache reader's loader is a row→row drag drawn as a gutter
 * arrow, and the X on a module's line or arrow runs `disconnectModule`. Every change is one
 * command and one Undo step; looking, hovering and cancelled drags change nothing.
 */
import type { Locator, Page } from "@playwright/test";
import {
  createStudy,
  design,
  dragOnto,
  expect,
  linePoint,
  moveOnto,
  pull,
  ready,
  test,
  tile,
} from "./studio.ts";

const MODULE_TAB = "Add module";
const LINK_TAB = "Add linked tile";
const LEFT = { x: -60, y: 12 };
const fan = (page: Page) => page.locator(".board-pull [data-fan-item]");
const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });
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

/** The fan's rows for a Service and a Worker: [name, caption] by Template, Part, Stub. */
const SERVICE = [
  ["Cache reader", "Template"],
  ["Multipart uploads", "Template"],
  ["Search query", "Template"],
  ["Event publisher", "Part of a template"],
  ["Data access", "Part of a template"],
  ["Auth guard", "Part of a template"],
  ["Rate limiter", "Stub"],
  ["ID generator", "Stub"],
  ["Redirect responder", "Stub"],
  ["Event consumer", "Stub"],
  ["External call", "Stub"],
  ["Custom", "Stub"],
];
const WORKER = [
  ["Lifecycle writer", "Template"],
  ["Video encoder", "Template"],
  ["Event counter", "Template"],
  ["Index writer", "Template"],
  ["Event publisher", "Part of a template"],
  ["Event consumer", "Part of a template"],
  ["Data access", "Part of a template"],
  ["Video packager", "Part of a template"],
  ["Video thumbnailer", "Part of a template"],
  ["Rate limiter", "Stub"],
  ["Cache reader", "Stub"],
  ["ID generator", "Stub"],
  ["Redirect responder", "Stub"],
  ["Auth guard", "Stub"],
  ["External call", "Stub"],
  ["Custom", "Stub"],
];
/** Kinds whose rows can't connect: no dot. */
const NO_DOT = ["Redirect responder", "Event counter"];

/** A blank project with the user's Consume action and the given tiles, each added by its fan. */
async function build(page: Page, name: string, plan: [from: string, kind: string][]) {
  const id = await createStudy(page, name, "blank");
  await pull(page, "User", "Add action");
  await moveOnto(page, fanItem(page, "Consume"));
  await page.mouse.up();
  await ready(page);
  for (const [from, kind] of plan) {
    await tile(page, from).click();
    await pull(page, from, LINK_TAB);
    await moveOnto(page, fanItem(page, kind));
    await page.mouse.up();
    await ready(page);
  }
  return id;
}

/** Picks `kind` from the selected tile's module fan; its page opens with the name focused. */
async function addModule(page: Page, host: string, kind: string) {
  await pull(page, host, MODULE_TAB, LEFT);
  await moveOnto(page, fanItem(page, kind));
  await page.mouse.up();
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

test("adds a module of every fan kind to a Service and a Worker by mouse", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Module fan", [
    ["Consume", "Microservice"],
    ["Microservice", "Queue or topic"],
    ["Queue or topic", "Worker service"],
  ]);
  try {
    // A Service: the `+` on its left, the link tab on its right.
    await tile(page, "Microservice").click();
    const tabs = (side: string) =>
      tile(page, "Microservice").locator(`.board-tabs[data-side="${side}"] .board-tab`);
    await expect(tabs("before")).toHaveAttribute("aria-label", MODULE_TAB);
    await expect(tabs("before")).toHaveAttribute("data-glyph", "plus");
    await expect(tabs("after")).toHaveAttribute("aria-label", LINK_TAB);
    // Its fan: the twelve kinds a Service allows, a row per Template, Part of a template and
    // Stub (five to a row), each named and captioned, all on screen; the tip adds its purpose.
    await pull(page, "Microservice", MODULE_TAB, LEFT);
    await expect(fan(page)).toHaveCount(SERVICE.length);
    expect(
      await fan(page).evaluateAll((items) =>
        items.map((item) => [
          item.querySelector(".board-fan-caption")?.firstChild?.textContent,
          item.querySelector(".board-fan-detail")?.textContent,
        ]),
      ),
    ).toEqual(SERVICE);
    const rows = await fan(page).evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).style.top),
    );
    expect(new Set(rows).size).toBe(4);
    for (const item of await fan(page).all()) await expect(item).toBeInViewport({ ratio: 0.99 });
    await moveOnto(page, fanItem(page, "Data access"));
    await expect(page.locator(".board-fan-tip")).toHaveText(
      "Data accessReads and writes one database.",
    );
    // Cancelled: nothing is added. The release may land on the paper and clear the selection.
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(fan(page)).toHaveCount(0);
    expect((await saved(page, id)).architecture.studio.components ?? []).toEqual([]);
    await tile(page, "Microservice").click();

    // Every kind, in the Overview: each is one step and opens unconnected, as a stub.
    for (const [index, [kind]] of SERVICE.entries()) {
      await addModule(page, "Microservice", kind as string);
      await expect(status(page).locator("strong")).toHaveText("Stub");
      await expect
        .poll(async () => (await modules(page, id, "microservice")).length)
        .toBe(index + 1);
    }
    const service = await modules(page, id, "microservice");
    expect(service.map((item) => item.name)).toEqual(SERVICE.map(([kind]) => kind));
    expect((await saved(page, id)).schemaVersion).toBe(3);
    // The tile's page lists them as cards.
    await inspector(page).getByRole("button", { name: "Back to Microservice" }).click();
    await expect(
      inspector(page).getByRole("list", { name: "Modules", exact: true }).getByRole("button"),
    ).toHaveCount(SERVICE.length);

    // A Worker, in the Detailed view: its sixteen kinds, each a new row.
    await page.getByRole("button", { name: "Detailed", exact: true }).click();
    await ready(page);
    await tile(page, "Worker service").click();
    await pull(page, "Worker service", MODULE_TAB, LEFT);
    expect(
      await fan(page).evaluateAll((items) =>
        items.map((item) => [
          item.querySelector(".board-fan-caption")?.firstChild?.textContent,
          item.querySelector(".board-fan-detail")?.textContent,
        ]),
      ),
    ).toEqual(WORKER);
    for (const item of await fan(page).all()) await expect(item).toBeInViewport({ ratio: 0.99 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await tile(page, "Worker service").click({ position: { x: 20, y: 12 } });
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

test("connects a module from its dot, refuses with the reason, and disconnects by its X", async ({
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

    // Its line's X in Connect mode disconnects the module; the tiles' link stays.
    const at = await linePoint(page, drawn);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    const x = page.getByRole("button", { name: "Disconnect Data access from Database" });
    await expect(x).toBeVisible();
    await x.click();
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
    await expect(status(page)).toHaveText("TemplateCache read");

    // In Connect mode the arrow under the pointer shows its X, which disconnects the loader.
    const at = await arrowPoint(arrow);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    const x = page.getByRole("button", { name: "Disconnect Cache reader from Data access" });
    await expect(x).toBeVisible();
    await x.click();
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
  // The older Redirect service kind takes modules too: its fan, released on paper.
  await tile(page, "Redirect service").click();
  await pull(page, "Redirect service", MODULE_TAB, LEFT);
  await expect(fan(page)).toHaveCount(10);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(fan(page)).toHaveCount(0);

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
  const at = await linePoint(page, "redirect-db/redirect-data");
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await expect(
    page.getByRole("button", { name: "Disconnect Link reader from URL database" }),
  ).toBeVisible();
  const arrow = page.locator(".board .lane-container-loader");
  const point = await arrowPoint(arrow);
  await page.mouse.move(point.x, point.y, { steps: 4 });
  await expect(
    page.getByRole("button", { name: "Disconnect Cache reader from Link reader" }),
  ).toBeVisible();
  await page.keyboard.press("v");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await ready(page);

  expect(await saved(page, id)).toEqual(before.design);
  expect(await blueprint(page, id)).toEqual(before.blueprint);
});

test("a module added to a study tile shows its kept Service identity as Refused", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Module study", "YouTube · studio study");
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

test("Runnable processes is saved by its checkbox: Preview lists the processes, Undo unticks it and a study refuses it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await build(page, "E2E Runnable processes", [["Consume", "Microservice"]]);
  let study: string | undefined;
  const generation = async (project: string) =>
    (await (await page.request.get(`/api/projects/${project}/design`)).json()).design as {
      revision: number;
      generation?: { processes?: true };
    };
  try {
    await tile(page, "Microservice").click();
    await addModule(page, "Microservice", "Rate limiter");
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
      tiles: [{ tile: "microservice", service: "app-microservice", shape: "http" }],
    });
    await expect(dialog.getByText("Processes · 1 · runnable")).toBeVisible();
    const rows = dialog
      .getByRole("list", { name: "Runnable processes", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("Microservice app-microservice · HTTP, public");
    await expect(rows.nth(0)).toContainText("GET /healthz");
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

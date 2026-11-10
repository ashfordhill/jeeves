/**
 * The Detailed view (UI07): Overview | Detailed in the canvas toolbar draws each module host as a
 * container of its modules, with each module's links from or into its row. It is a per-project
 * browser preference: toggling changes no design, revision or blueprint. Drawn lines map to their
 * canonical relationships for the inspector, chat and removal, and the Overview, including its
 * export, stays exactly what it was. A row is its module (UI08): clicking it opens the module in
 * the inspector, and an open module marks its row, only its own lines and its partners' rows.
 */
import type { Page } from "@playwright/test";
import { exportPng } from "./export.ts";
import { declareLinks } from "./ownership.ts";
import {
  clickLine,
  createStudy,
  design,
  expect,
  lines,
  moveOnto,
  pull,
  ready,
  test,
  tile,
  tiles,
} from "./studio.ts";

/** `detailedView` draws the YouTube study's 25 relationships as 26 lines (two Transcoder rows write
 * Transcoded videos); `selection.test.ts` pins the count. */
const YOUTUBE_DETAILED_LINES = 26;
const TRANSCODER_ROWS = [
  "Job consumer",
  "Segmenter and encoder",
  "Packager",
  "Thumbnailer",
  "Completion publisher",
];
const WRITES = ["transcoder-write/transcoder-packager", "transcoder-write/transcoder-thumbnails"];

const viewButton = (page: Page, name: "Overview" | "Detailed") =>
  page.getByRole("group", { name: "View", exact: true }).getByRole("button", { name, exact: true });

/** The tiles, lines and camera, once the layout, its animation and the fit have stopped. */
async function settled(page: Page) {
  await ready(page);
  const read = () =>
    page.locator(".lane-canvas .board").evaluate((board) => ({
      camera: board.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform,
      tiles: Object.fromEntries(
        Array.from(board.querySelectorAll<HTMLElement>(".react-flow__node")).map((el) => [
          el.dataset.id,
          `${el.style.transform} ${el.style.width}×${el.style.height}`,
        ]),
      ),
      lines: Object.fromEntries(
        Array.from(board.querySelectorAll<HTMLElement>(".react-flow__edge")).map((el) => [
          el.dataset.id,
          el.querySelector(".react-flow__edge-path")?.getAttribute("d"),
        ]),
      ),
    }));
  let last = JSON.stringify(await read());
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const next = JSON.stringify(await read());
    if (next === last) return JSON.parse(next) as Awaited<ReturnType<typeof read>>;
    last = next;
  }
  throw new Error("The canvas never stopped moving.");
}

async function show(page: Page, view: "Overview" | "Detailed") {
  await viewButton(page, view).click();
  await expect(viewButton(page, view)).toHaveAttribute("aria-pressed", "true");
  await expect(viewButton(page, view === "Overview" ? "Detailed" : "Overview")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  return settled(page);
}

/** Lines drawn in the selection colour. */
const highlighted = (page: Page) =>
  lines(page).evaluateAll((edges) =>
    edges
      .filter(
        (edge) =>
          (edge.querySelector(".board-line-arrow") as SVGPathElement | null)?.style.stroke ===
          "var(--board-select)",
      )
      .map((edge) => (edge as HTMLElement).dataset.id)
      .sort(),
  );

/** Every tile is inside the canvas: the camera fits the view. */
async function fitted(page: Page) {
  const pane = await page.locator(".lane-canvas").boundingBox();
  if (!pane) throw new Error("No canvas");
  const boxes = await tiles(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect),
  );
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(pane.x - 1);
    expect(box.top).toBeGreaterThanOrEqual(pane.y - 1);
    expect(box.right).toBeLessThanOrEqual(pane.x + pane.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(pane.y + pane.height + 1);
  }
}

test("Detailed draws YouTube's modules by mouse, maps lines to relationships and leaves the design alone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E UI07 detailed", "YouTube · studio study");
  try {
    const blueprint = async () =>
      await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    const before = { design: await design(page, id), blueprint: await blueprint() };
    const inspector = page.locator(".studio-inspector");
    await expect(viewButton(page, "Overview")).toHaveAttribute("aria-pressed", "true");
    const overview = await settled(page);
    expect(Object.keys(overview.lines)).toHaveLength(25);

    // Detailed: Transcoder is a container of its five modules, one row each, in module order.
    const detailed = await show(page, "Detailed");
    await fitted(page);
    const transcoder = tile(page, "Transcoder");
    const rows = transcoder.locator(".lane-container-row");
    await expect(rows).toHaveText(TRANSCODER_ROWS);
    await expect(rows.first()).toHaveAttribute("data-module", "transcoder-consumer");
    await expect(rows.nth(1)).toHaveAttribute("title", "Segmenter and encoder");
    expect(detailed.tiles.transcoder).toContain("256px×224px");
    expect(Object.keys(detailed.lines)).toHaveLength(YOUTUBE_DETAILED_LINES);
    for (const line of WRITES) expect(detailed.lines[line]).toBeTruthy();
    expect(detailed.lines["transcoder-write"]).toBeUndefined();
    expect(await design(page, id)).toEqual(before.design);
    expect(await blueprint()).toEqual(before.blueprint);

    // A module's line opens its canonical relationship; all of its drawn lines turn blue.
    await clickLine(page, WRITES[1] as string);
    await expect(inspector.locator(".lane-connection-label")).toHaveText(
      "Stores segments, playlists and thumbnails",
    );
    await expect.poll(() => highlighted(page)).toEqual(WRITES);
    await expect(page.locator(".board .react-flow__edge.selected")).toHaveCount(1);
    await page.getByLabel("Message", { exact: true }).fill("Describe this relationship");
    const sent = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().endsWith(`/projects/${id}/chat`),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect((await sent).postDataJSON().selection).toEqual(["transcoder-write"]);
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/projects/${id}/chat`)).json()).turns.at(-1)?.status,
      )
      .toBe("done");

    // The selection carries across views, both ways.
    await show(page, "Overview");
    await expect(page.locator('.board .react-flow__edge[data-id="transcoder-write"]')).toHaveClass(
      /selected/,
    );
    await show(page, "Detailed");
    await expect.poll(() => highlighted(page)).toEqual(WRITES);

    // Its X removes the whole relationship, both drawn lines; one Undo restores it.
    await page
      .getByRole("button", { name: "Remove Thumbnailer (Transcoder) to Transcoded videos" })
      .click();
    await expect(lines(page)).toHaveCount(YOUTUBE_DETAILED_LINES - 2);
    expect((await design(page, id)).connections.some((c) => c.id === "transcoder-write")).toBe(
      false,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(lines(page)).toHaveCount(YOUTUBE_DETAILED_LINES);
    expect((await design(page, id)).connections.some((c) => c.id === "transcoder-write")).toBe(
      true,
    );

    // A removal that would cut a tile off is refused with the reason, as in the Overview.
    await clickLine(page, "completions-handler/handler-consumer");
    await page
      .getByRole("button", {
        name: "Remove Completion events to Completion consumer (Completion handler)",
      })
      .click();
    await expect(page.locator(".studio-notice")).toContainText("would cut off Completion handler");
    await expect(lines(page)).toHaveCount(YOUTUBE_DETAILED_LINES);

    // A container has its tile X and pull tabs; a tile added from one is one step, and Undo.
    await transcoder.click({ position: { x: 20, y: 12 } });
    await expect(transcoder).toHaveClass(/selected/);
    await transcoder.getByRole("button", { name: "Remove Transcoder", exact: true }).click();
    const removal = page.getByRole("dialog", { name: "Remove Transcoder" });
    await expect(removal).toBeVisible();
    await removal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(removal).toHaveCount(0);
    await pull(page, "Transcoder", "Add after");
    await moveOnto(page, page.locator(".board-pull").getByRole("button", { name: "Cache" }));
    await page.mouse.up();
    await ready(page);
    await expect(tiles(page)).toHaveCount(22);
    await expect(tile(page, "Cache")).toHaveClass(/selected/);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(tiles(page)).toHaveCount(21);
    // Remove, Undo, add, Undo.
    await expect
      .poll(async () => (await design(page, id)).revision)
      .toBe(before.design.revision + 4);

    // An open module stays open across views.
    await transcoder.click({ position: { x: 20, y: 12 } });
    await inspector.getByRole("button", { name: "Open Packager", exact: true }).click();
    await show(page, "Overview");
    await expect(
      inspector.getByRole("button", { name: "Back to Transcoder", exact: true }),
    ).toBeVisible();

    // Back in the Overview: the same 25 lines and exactly the same tiles; the choice is
    // remembered in this browser, and none of it reached the design or the blueprint.
    await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
    const again = await settled(page);
    expect(again.tiles).toEqual(overview.tiles);
    expect(again.lines).toEqual(overview.lines);
    await show(page, "Detailed");
    await page.reload();
    await ready(page);
    await expect(viewButton(page, "Detailed")).toHaveAttribute("aria-pressed", "true");
    await expect(tile(page, "Transcoder").locator(".lane-container-row")).toHaveCount(5);
    await expect(lines(page)).toHaveCount(YOUTUBE_DETAILED_LINES);
    const after = await design(page, id);
    expect({ ...after, revision: before.design.revision }).toEqual(before.design);
    const blueprintAfter = await blueprint();
    expect({ ...blueprintAfter, revision: before.blueprint.revision }).toEqual(before.blueprint);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

/** The marked rows of the canvas's containers: module → "open" or "partner". */
const marks = (page: Page) =>
  page
    .locator(".board .lane-container-row[data-mark]")
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((row) => [(row as HTMLElement).dataset.module, (row as HTMLElement).dataset.mark]),
      ),
    );
const row = (page: Page, module: string, host = "Transcoder") =>
  tile(page, host).getByRole("button", { name: `Open ${module} in ${host}`, exact: true });
/** The Transcoder's five drawn lines, one per module row. */
const TRANSCODER_LINES = [
  "jobs-transcoder/transcoder-consumer",
  "transcoder-publish/transcoder-done",
  "transcoder-read/transcoder-encoder",
  ...WRITES,
].sort();

test("a module row opens its module and marks its row, its own lines and its partners", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E UI08 module rows", "YouTube · studio study");
  try {
    const blueprint = async () =>
      await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    const before = { design: await design(page, id), blueprint: await blueprint() };
    const inspector = page.locator(".studio-inspector");
    const back = inspector.getByRole("button", { name: "Back to Transcoder", exact: true });
    const name = inspector.getByLabel("Name", { exact: true });
    const transcoder = tile(page, "Transcoder");
    await show(page, "Detailed");
    await expect(row(page, "Packager")).toBeVisible();
    expect(await marks(page)).toEqual({});

    // A row opens its module: the host is selected, with its X, but only the Packager's own line
    // takes the selection colour (not the Thumbnailer's line of the same relationship), its row
    // is marked and so are the rows of the modules it links with inside the Transcoder.
    await row(page, "Packager").click();
    await expect(back).toBeVisible();
    await expect(name).toHaveValue("Packager");
    await expect(transcoder).toHaveClass(/selected/);
    await expect(transcoder.getByRole("button", { name: "Remove Transcoder" })).toBeVisible();
    await expect.poll(() => highlighted(page)).toEqual([WRITES[0]]);
    expect(await marks(page)).toEqual({
      "transcoder-packager": "open",
      "transcoder-encoder": "partner",
      "transcoder-done": "partner",
    });
    await expect(row(page, "Packager")).toHaveAttribute("aria-current", "true");
    await page.getByLabel("Message", { exact: true }).fill("What does this module do?");
    const sent = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().endsWith(`/projects/${id}/chat`),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect((await sent).postDataJSON().selection).toEqual(["transcoder-packager"]);
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/projects/${id}/chat`)).json()).turns.at(-1)?.status,
      )
      .toBe("done");

    // Another row of the same tile moves the marks.
    await row(page, "Segmenter and encoder").click();
    await expect(name).toHaveValue("Segmenter and encoder");
    await expect.poll(() => highlighted(page)).toEqual(["transcoder-read/transcoder-encoder"]);
    expect(await marks(page)).toEqual({
      "transcoder-consumer": "partner",
      "transcoder-encoder": "open",
      "transcoder-packager": "partner",
      "transcoder-thumbnails": "partner",
    });

    // Back clears the marks; the tile is selected again with all of its lines.
    await back.click();
    await expect(back).toHaveCount(0);
    await expect.poll(() => marks(page)).toEqual({});
    await expect.poll(() => highlighted(page)).toEqual(TRANSCODER_LINES);

    // A card in the inspector opens the same module and marks its row; it stays open across views,
    // where the Overview keeps only its host selected, with all of its lines.
    await inspector.getByRole("button", { name: "Open Thumbnailer", exact: true }).click();
    await expect.poll(() => highlighted(page)).toEqual([WRITES[1]]);
    expect(await marks(page)).toEqual({
      "transcoder-thumbnails": "open",
      "transcoder-encoder": "partner",
      "transcoder-done": "partner",
    });
    await show(page, "Overview");
    await expect(back).toBeVisible();
    await expect(transcoder).toHaveClass(/selected/);
    await expect
      .poll(() => highlighted(page))
      .toEqual(["jobs-transcoder", "transcoder-publish", "transcoder-read", "transcoder-write"]);
    await show(page, "Detailed");
    await expect(back).toBeVisible();
    await expect.poll(() => highlighted(page)).toEqual([WRITES[1]]);
    expect(await marks(page)).toEqual({
      "transcoder-thumbnails": "open",
      "transcoder-encoder": "partner",
      "transcoder-done": "partner",
    });

    // Another tile closes the module, and so does empty paper.
    await tile(page, "Completion events").click();
    await expect(back).toHaveCount(0);
    await expect(name).toHaveValue("Completion events");
    expect(await marks(page)).toEqual({});
    await row(page, "Video writer", "Completion handler").click();
    await expect(
      inspector.getByRole("button", { name: "Back to Completion handler", exact: true }),
    ).toBeVisible();
    await expect.poll(() => highlighted(page)).toEqual(["handler-metadata/handler-writer"]);
    expect(await marks(page)).toEqual({
      "handler-consumer": "partner",
      "handler-writer": "open",
    });
    await page.locator(".board .react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(inspector.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
    expect(await marks(page)).toEqual({});
    expect(await highlighted(page)).toEqual([]);

    // In Hand mode a row lets the pointer through: a drag from it pans, and nothing opens.
    await page.getByRole("button", { name: "Hand", exact: true }).click();
    const camera = () =>
      page
        .locator(".board .react-flow__viewport")
        .evaluate((el) => (el as HTMLElement).style.transform);
    const panned = await camera();
    const box = await row(page, "Packager").boundingBox();
    if (!box) throw new Error("The Packager row is not drawn.");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(camera).not.toBe(panned);
    await expect(inspector.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
    await expect(transcoder).not.toHaveClass(/selected/);
    expect(await marks(page)).toEqual({});
    await page.getByRole("button", { name: "Select", exact: true }).click();

    // None of it reached the design, its revision or the blueprint.
    expect(await design(page, id)).toEqual(before.design);
    expect(await blueprint()).toEqual(before.blueprint);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("a Detailed line's X goes through the relationship declarations confirmation", async ({
  page,
  tinyurl: id,
}) => {
  await declareLinks(page);
  await ready(page);
  const saved = await design(page, id);
  await show(page, "Detailed");
  await clickLine(page, "redirect-db/redirect-data");
  await expect(page.locator(".studio-inspector .lane-connection-label")).toHaveText(
    "Reads links on a cache miss",
  );
  await page
    .getByRole("button", { name: "Remove Link reader (Redirect service) to URL database" })
    .click();
  const removal = page.getByRole("dialog", { name: "Remove relationship declarations" });
  await expect(removal).toContainText("dependencies · redirect-db");
  await removal.getByRole("button", { name: "Remove relationship", exact: true }).click();
  await expect(page.locator('.react-flow__edge[data-id="redirect-db/redirect-data"]')).toHaveCount(
    0,
  );
  expect((await design(page, id)).connections.some((c) => c.id === "redirect-db")).toBe(false);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('.react-flow__edge[data-id="redirect-db/redirect-data"]')).toHaveCount(
    1,
  );
  await expect
    .poll(async () => ({ ...(await design(page, id)), revision: 0 }))
    .toEqual({ ...saved, revision: 0 });
});

test("the TinyURL foundation, which has no modules, looks the same in both views", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E UI07 foundation");
  try {
    const overview = await settled(page);
    const detailed = await show(page, "Detailed");
    expect(detailed).toEqual(overview);
    await expect(page.locator(".lane-container")).toHaveCount(0);
    expect(await show(page, "Overview")).toEqual(overview);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("export follows the view: Detailed says so, and the Overview's bytes don't change", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E UI07 export", "YouTube · studio study");
  try {
    await settled(page);
    const first = await exportPng(page);
    expect(first.filenames).toEqual(["E2E-UI07-export-r1.png", "E2E-UI07-export-r1-capture.json"]);
    expect(first.details.view.canvas).toBeUndefined();
    await show(page, "Detailed");
    const detailed = await exportPng(page);
    expect(detailed.filenames).toEqual([
      "E2E-UI07-export-r1-detailed.png",
      "E2E-UI07-export-r1-detailed-capture.json",
    ]);
    expect(detailed.details.view.canvas).toBe("detailed");
    expect(detailed.details.image.filename).toBe("E2E-UI07-export-r1-detailed.png");
    expect(detailed.details.tiles).toHaveLength(21);
    expect(detailed.details.lines).toHaveLength(YOUTUBE_DETAILED_LINES);
    expect(detailed.details.image.sha256).not.toBe(first.details.image.sha256);
    // An open module's marks are the live canvas's, never the export's.
    await row(page, "Packager").click();
    await expect(page.locator('.lane-container-row[data-mark="open"]')).toHaveCount(1);
    await settled(page);
    const marked = await exportPng(page);
    expect(marked.png.equals(detailed.png)).toBe(true);
    expect({ ...marked.details, capturedAt: "" }).toEqual({ ...detailed.details, capturedAt: "" });
    await show(page, "Overview");
    const again = await exportPng(page);
    expect(again.png.equals(first.png)).toBe(true);
    expect({ ...again.details, capturedAt: "" }).toEqual({ ...first.details, capturedAt: "" });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

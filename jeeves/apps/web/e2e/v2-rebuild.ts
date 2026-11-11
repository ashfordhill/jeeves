/**
 * YouTube v2 rebuilt from a blank project by mouse (module authoring plan, MA09): the plan's
 * steps as data, and the helpers that perform them. Only pointer and UI interactions write:
 * clicks, pulls onto a fan item, Connect mode drags and typing into fields. API reads only wait
 * for saves and check results.
 */
import type { Locator, Page } from "@playwright/test";
import { createStudy, design, dragOnto, expect, moveOnto, pull, ready, tile } from "./studio.ts";

/** A tile from an action's or tile's link fan, or a Connect mode drag between two tiles. */
export type V2Step = { from: string; kind: string; tile: string } | { link: [string, string] };
/** v2's tiles and links, in the lane commands fixture's order, plus Upload API → Identity. */
export const V2_TILES: readonly V2Step[] = [
  { from: "Watch", kind: "Microservice", tile: "Watch API" },
  { from: "Watch API", kind: "Cache", tile: "Metadata cache" },
  { from: "Watch API", kind: "Database", tile: "Metadata database" },
  { from: "Watch API", kind: "Database", tile: "View counts" },
  { from: "Watch API", kind: "Message channel", tile: "View events" },
  { from: "View events", kind: "Worker service", tile: "View counter" },
  { link: ["View counter", "View counts"] },
  { from: "Watch", kind: "Microservice", tile: "Search API" },
  { from: "Search API", kind: "Search index", tile: "Search index" },
  { from: "Watch", kind: "CDN", tile: "Local video edge" },
  { from: "Publish", kind: "Identity", tile: "Identity" },
  { from: "Publish", kind: "Uploads", tile: "Upload API" },
  { link: ["Upload API", "Metadata database"] },
  { from: "Upload API", kind: "Object storage", tile: "Original videos" },
  { from: "Upload API", kind: "Message channel", tile: "Upload jobs" },
  { from: "Upload jobs", kind: "Worker service", tile: "Transcoder" },
  { link: ["Transcoder", "Original videos"] },
  { from: "Transcoder", kind: "Object storage", tile: "Transcoded videos" },
  { link: ["Local video edge", "Transcoded videos"] },
  { from: "Transcoder", kind: "Message channel", tile: "Processing events" },
  { from: "Processing events", kind: "Worker service", tile: "Video lifecycle worker" },
  { link: ["Video lifecycle worker", "Metadata database"] },
  { from: "Video lifecycle worker", kind: "Message channel", tile: "Publication events" },
  { from: "Publication events", kind: "Worker service", tile: "Search indexer" },
  { link: ["Search indexer", "Search index"] },
  // Contract question 2: the Creator check's connection is drawn.
  { link: ["Upload API", "Identity"] },
];

type Module = { kind: string; name: string; description: string };
const module = (kind: string, name: string, description: string): Module => ({
  kind,
  name,
  description,
});
/** The 22 modules by tile: each kind from the `+` fan, with the plan's name and description. */
export const V2_MODULES: Readonly<Record<string, readonly Module[]>> = {
  "Watch API": [
    module("Cache reader", "Video details cache", "Serves video details from the cache."),
    module("Data access", "Video details reader", "Reads public video details."),
    module("Data access", "View count reader", "Reads a video's view count."),
    module("Event publisher", "View publisher", "Reports each video play as an event."),
  ],
  "View counter": [
    module("Event consumer", "View consumer", "Receives view events."),
    module("Event counter", "Receipt and increment", "Counts each view event once."),
    module("Data access", "Count writer", "Stores view totals."),
  ],
  "Search API": [module("Search query", "Video search", "Searches published videos.")],
  "Upload API": [
    module("Auth guard", "Creator check", "Allows only signed-in creators."),
    module("Multipart uploads", "Multipart uploads", "Uploads large videos in resumable parts."),
    module(
      "Event publisher",
      "Job outbox publisher",
      "Queues a processing job once an upload completes.",
    ),
    module("Data access", "Upload state writer", "Records each upload's progress."),
  ],
  Transcoder: [
    module("Event consumer", "Job consumer", "Takes the next processing job."),
    module(
      "Video encoder",
      "Segmenter and encoder",
      "Encodes the video into streamable renditions.",
    ),
    module("Video packager", "Packager", "Stores the stream's segments and playlists."),
    module("Video thumbnailer", "Thumbnailer", "Creates the video's thumbnails."),
    module(
      "Event publisher",
      "Processing result publisher",
      "Announces whether processing succeeded.",
    ),
  ],
  "Video lifecycle worker": [
    module("Event consumer", "Processing consumer", "Receives processing results."),
    module("Lifecycle writer", "Lifecycle writer", "Updates each video's processing state."),
    module(
      "Event publisher",
      "Video publication publisher",
      "Announces videos that are ready to watch.",
    ),
  ],
  "Search indexer": [
    module("Event consumer", "Video publication consumer", "Receives newly published videos."),
    module("Index writer", "Index writer", "Adds published videos to the search index."),
  ],
};

/** A drag from a module row's dot onto a tile, or onto another module's row (the loader). */
type Connection = { host: string; module: string } & ({ tile: string } | { row: string });
const to = (host: string, module: string, tile: string): Connection => ({ host, module, tile });
/** Every module connection, in the module fixture's order: the loader third. */
export const V2_CONNECTIONS: readonly Connection[] = [
  to("Watch API", "Video details cache", "Metadata cache"),
  to("Watch API", "Video details reader", "Metadata database"),
  { host: "Watch API", module: "Video details cache", row: "Video details reader" },
  to("Watch API", "View count reader", "View counts"),
  to("Watch API", "View publisher", "View events"),
  to("View counter", "View consumer", "View events"),
  to("View counter", "Count writer", "View counts"),
  to("Search API", "Video search", "Search index"),
  to("Upload API", "Creator check", "Identity"),
  to("Upload API", "Multipart uploads", "Original videos"),
  to("Upload API", "Job outbox publisher", "Upload jobs"),
  to("Upload API", "Job outbox publisher", "Metadata database"),
  to("Upload API", "Upload state writer", "Metadata database"),
  to("Transcoder", "Job consumer", "Upload jobs"),
  to("Transcoder", "Segmenter and encoder", "Original videos"),
  to("Transcoder", "Packager", "Transcoded videos"),
  to("Transcoder", "Thumbnailer", "Transcoded videos"),
  to("Transcoder", "Processing result publisher", "Processing events"),
  to("Video lifecycle worker", "Processing consumer", "Processing events"),
  to("Video lifecycle worker", "Lifecycle writer", "Metadata database"),
  to("Video lifecycle worker", "Video publication publisher", "Publication events"),
  to("Video lifecycle worker", "Video publication publisher", "Metadata database"),
  to("Search indexer", "Video publication consumer", "Publication events"),
  to("Search indexer", "Index writer", "Search index"),
];

/** v2's useful values that differ from the initial ones (MA08): tile, module, field, value. */
export const V2_VALUES: readonly [string, string | undefined, string, number][] = [
  ["Upload API", undefined, "Request timeout", 5000],
  ["Upload API", undefined, "Concurrency limit", 500],
  ["Watch API", undefined, "Concurrency limit", 2000],
  ["Watch API", "Video details reader", "Pool size", 50],
  ["Watch API", "Video details reader", "Statement timeout", 500],
  ["Metadata cache", undefined, "TTL", 3601],
  ["View counter", undefined, "Concurrency", 8],
];

/** The gestures a rebuild takes: clicks, drags (a pull onto a fan item counts as one) and fields typed. */
export type Gestures = { clicks: number; drags: number; typed: number };
export const gestures = (): Gestures => ({ clicks: 0, drags: 0, typed: 0 });

export const fanItem = (page: Page, name: string) =>
  page.locator(".board-pull").getByRole("button", { name, exact: true });
export const inspector = (page: Page) => page.locator(".studio-inspector");
export const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name, exact: true });
export const row = (page: Page, host: string, module: string) =>
  page
    .locator(".board .lane-container-row")
    .filter({ has: page.getByRole("button", { name: `Open ${module} in ${host}`, exact: true }) });
const dot = (page: Page, host: string, module: string) =>
  row(page, host, module).locator(".lane-container-row-dot");

type Saved = Awaited<ReturnType<typeof design>> & {
  architecture: {
    system?: { name: string };
    studio: { componentConnections?: unknown[] };
  };
};
const saved = async (page: Page, id: string) => (await design(page, id)) as Saved;
/** Waits until the saved design names a tile, action or module so. */
async function named(page: Page, id: string, name: string) {
  await expect
    .poll(async () => {
      const { elements, architecture } = await saved(page, id);
      return [
        ...elements,
        ...(architecture.studio.actions ?? []),
        ...(architecture.studio.components ?? []),
      ].some((item) => item.name === name);
    })
    .toBe(true);
}

/** Selects the field's text and types over it, then leaves it, which saves it. */
async function typeOver(page: Page, field: Locator, text: string, log: Gestures) {
  await expect(field).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Tab");
  log.typed += 1;
}

/** Clicks a field and types over its text. */
async function typeInto(page: Page, field: Locator, text: string, log: Gestures) {
  await field.click();
  log.clicks += 1;
  await typeOver(page, field, text, log);
}

/** Pulls the selected tile's tab onto a fan item. */
async function pick(page: Page, from: string, tab: string, item: string, log: Gestures) {
  await pull(page, from, tab, tab === "Add module" ? { x: -60, y: 12 } : undefined);
  await moveOnto(page, fanItem(page, item));
  await page.mouse.up();
  log.drags += 1;
}

async function click(target: Locator, log: Gestures) {
  await target.click();
  log.clicks += 1;
}

/** A Connect mode drag from one tile onto another. */
async function linkTiles(page: Page, id: string, [from, onto]: [string, string], log: Gestures) {
  const before = (await saved(page, id)).connections.length;
  await click(tool(page, "Fit"), log);
  await click(tool(page, "Connect"), log);
  await dragOnto(page, tile(page, from), tile(page, onto));
  await expect(tile(page, onto)).toHaveClass(/is-drop-over/);
  await page.mouse.up();
  log.drags += 1;
  await expect.poll(async () => (await saved(page, id)).connections.length).toBe(before + 1);
  await click(tool(page, "Pointer"), log);
  await ready(page);
}

/**
 * A blank project named `name`, by the project menu, the project's ID. Cleaning up after a
 * failure needs the ID before anything else is built.
 */
export async function createBlank(page: Page, name: string, log: Gestures) {
  const id = await createStudy(page, name, "blank");
  // The project menu, New project, Blank architecture, its name and Create project.
  log.clicks += 4;
  log.typed += 1;
  return id;
}

/** v2's system name, actions, tiles and links, by mouse, in a blank project. */
export async function buildV2Tiles(page: Page, id: string, log: Gestures) {
  // The system's name, on the user's page.
  await click(tile(page, "User"), log);
  await typeInto(page, inspector(page).getByLabel("Name", { exact: true }), "YouTube", log);
  await expect.poll(async () => (await saved(page, id)).architecture?.system?.name).toBe("YouTube");
  // The user's `+`: Consume, named Watch, and Produce, named Publish.
  for (const [item, action] of [
    ["Consume", "Watch"],
    ["Produce", "Publish"],
  ] as const) {
    await click(tile(page, "User"), log);
    await pick(page, "User", "Add action", item, log);
    await typeOver(page, inspector(page).getByLabel("Name", { exact: true }), action, log);
    await named(page, id, action);
    await ready(page);
  }
  for (const step of V2_TILES) {
    if ("link" in step) {
      await linkTiles(page, id, step.link, log);
      continue;
    }
    await click(tile(page, step.from), log);
    await pick(page, step.from, "Add linked tile", step.kind, log);
    await ready(page);
    await typeOver(page, inspector(page).getByLabel("Name", { exact: true }), step.tile, log);
    await named(page, id, step.tile);
    await expect(tile(page, step.tile)).toBeVisible();
  }
}

/**
 * v2's modules from each tile's `+` (named and described as the plan's table), their connections
 * by dot drags in Detailed + Connect, and v2's useful values in the inspector, by mouse.
 */
export async function buildV2Modules(page: Page, id: string, log: Gestures) {
  for (const [host, modules] of Object.entries(V2_MODULES))
    for (const item of modules) {
      await click(tile(page, host), log);
      await pick(page, host, "Add module", item.kind, log);
      await typeOver(page, inspector(page).getByLabel("Name", { exact: true }), item.name, log);
      await typeInto(
        page,
        inspector(page).getByLabel("Description", { exact: true }),
        item.description,
        log,
      );
      await named(page, id, item.name);
    }

  await click(tool(page, "Detailed"), log);
  await ready(page);
  await click(tool(page, "Fit"), log);
  await click(tool(page, "Connect"), log);
  const links = async () => (await saved(page, id)).architecture.studio.componentConnections ?? [];
  for (const connection of V2_CONNECTIONS) {
    const before = (await links()).length;
    const end =
      "tile" in connection
        ? tile(page, connection.tile)
        : row(page, connection.host, connection.row);
    await dragOnto(page, dot(page, connection.host, connection.module), end);
    await page.mouse.up();
    log.drags += 1;
    await expect.poll(async () => (await links()).length).toBe(before + 1);
    await expect(dot(page, connection.host, connection.module)).toHaveAttribute(
      "data-connected",
      "true",
    );
    await ready(page);
  }
  await click(tool(page, "Pointer"), log);
  await click(tool(page, "Simple"), log);
  await ready(page);

  for (const [host, name, field, value] of V2_VALUES) {
    await click(tile(page, host), log);
    if (name)
      await click(inspector(page).getByRole("button", { name: `Open ${name}`, exact: true }), log);
    const input = inspector(page).getByLabel(field, { exact: true });
    await typeInto(page, input, String(value), log);
    await expect(input).toHaveValue(String(value));
  }
  // The last value saves when the page closes.
  await click(tile(page, "User"), log);
}

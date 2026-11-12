// V3-18 scratch: instruments connection-dots' "a dot drag held past the canvas edge pans" under
// CPU throttling, with the old (one read, 60 ms) and new (three reads, 100 ms) camera waits.
// Temporary: deleted before the commit.
import type { Locator, Page } from "@playwright/test";
import { createStudy, expect, moveOnto, ready, test, tile } from "./studio.ts";

const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name, exact: true });
const dot = (page: Page, module: string) =>
  page.locator(`.board .lane-container-row[data-module="${module}"] .lane-container-row-dot`);
const canvas = (page: Page) => page.locator(".board .react-flow");
type Box = { x: number; y: number; width: number; height: number };
const box = async (target: Locator): Promise<Box> => {
  const found = await target.boundingBox();
  if (!found) throw new Error("Not drawn.");
  return found;
};
const read = (page: Page) =>
  page.locator(".board .react-flow__viewport").evaluate((element) => {
    const [x, y, zoom] = ((element as HTMLElement).style.transform.match(/-?[\d.]+/g) ?? []).map(
      Number,
    );
    return { x: x ?? 0, y: y ?? 0, zoom: zoom ?? 1 };
  });
async function cameraOld(page: Page) {
  let last = JSON.stringify(await read(page));
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(60);
    const now = await read(page);
    if (JSON.stringify(now) === last) return now;
    last = JSON.stringify(now);
  }
  throw new Error("never");
}
async function cameraNew(page: Page) {
  let last = JSON.stringify(await read(page));
  for (let same = 0, tries = 0; tries < 60; tries += 1) {
    await page.waitForTimeout(100);
    const now = await read(page);
    same = JSON.stringify(now) === last ? same + 1 : 0;
    if (same === 3) return now;
    last = JSON.stringify(now);
  }
  throw new Error("never");
}
const pressAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const hit = document.elementFromPoint(x as number, y as number);
      const handle = hit?.closest<HTMLElement>("[data-board-end-handle]");
      if (handle) return handle.closest<HTMLElement>("[data-board-end]")?.dataset.boardEnd ?? "?";
      const node = hit?.closest<HTMLElement>(".react-flow__node");
      return node ? `tile:${node.dataset.id}` : hit ? `other:${hit.className}` : "none";
    },
    [x, y],
  );
const inside = (inner: Box, outer: Box, clear: number) =>
  inner.x >= outer.x + clear &&
  inner.y >= outer.y + clear &&
  inner.x + inner.width <= outer.x + outer.width - clear &&
  inner.y + inner.height <= outer.y + outer.height - clear;

/** Delays every animation frame by `window.__frameDelay` ms while the main thread stays idle, as
 * a starved compositor does; installed before the app loads, so d3's timer uses it too. */
const slowFrames = `{
  const raf = window.requestAnimationFrame.bind(window);
  window.__frameDelay = 0;
  window.requestAnimationFrame = (callback) => {
    const delay = window.__frameDelay;
    if (!delay) return raf(callback);
    return setTimeout(() => raf(callback), delay);
  };
}`;
const delays = (process.env.V318_DELAYS ?? "").split(",").filter(Boolean).map(Number);
const rates = (process.env.V318_RATES ?? "1").split(",").map(Number);
const variants = (process.env.V318_CAMERA ?? "new").split(",");
for (const delay of delays.length ? delays : [0])
for (const rate of rates)
  for (const variant of variants)
    test(`edge pan, CPU ${rate}x, frame delay ${delay}, camera ${variant}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.addInitScript(slowFrames);
      const camera = variant === "old" ? cameraOld : cameraNew;
      const id = await createStudy(page, "E2E V318 flake", "YouTube · studio study");
      const notes: Record<string, unknown> = { rate, delay, variant };
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        await page.getByRole("button", { name: "Open inspector" }).click();
        await tool(page, "Detailed").click();
        await ready(page);
        await tool(page, "Connect").click();
        await page.evaluate((ms) => {
          (window as unknown as { __frameDelay: number }).__frameDelay = ms;
        }, delay);
        await tool(page, "Fit").click();
        const fitted = await camera(page);
        notes.fitted = fitted;
        const source = dot(page, "upload-jobs");
        const start = await box(source);
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        notes.underPointerBeforeWheel = await pressAt(
          page,
          start.x + start.width / 2,
          start.y + start.height / 2,
        );
        await page.mouse.wheel(0, -1200);
        const zoomed = await camera(page);
        notes.zoomed = zoomed;
        const target = tile(page, "Metadata");
        const board = await box(canvas(page));
        notes.targetOutside = !inside(await box(target), board, 1);
        const from = await box(source);
        notes.sourceInBoard = inside(from, board, 0);
        notes.underPress = await pressAt(page, from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2 + 20, from.y, { steps: 3 });
        notes.connecting = await page
          .locator(".board")
          .evaluate((el) => el.hasAttribute("data-connecting"));
        const end = await box(target);
        const past = 16;
        const along = (s: number, size: number, f: number, length: number) =>
          f + length > s + size ? s + size + past : f < s ? s - past : f + length / 2;
        const at = {
          x: along(board.x, board.width, end.x, end.width),
          y: along(board.y, board.height, end.y, end.height),
        };
        notes.board = board;
        notes.targetAtHold = end;
        notes.hold = at;
        notes.zoom = zoomed.zoom;
        await page.evaluate(() => {
          const w = window as unknown as {
            __frames: number;
            __stop: boolean;
            __log: [number, number][];
          };
          w.__frames = 0;
          w.__stop = false;
          w.__log = [];
          const vp = document.querySelector<HTMLElement>(".board .react-flow__viewport");
          const tick = (now: number) => {
            w.__frames += 1;
            const x = Number(vp?.style.transform.match(/-?[\d.]+/)?.[0] ?? 0);
            w.__log.push([Math.round(now), Math.round(x * 10) / 10]);
            if (!w.__stop) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const t0 = Date.now();
        await page.mouse.move(at.x, at.y, { steps: 8 });
        let ok = false;
        while (Date.now() - t0 < 120_000) {
          if (inside(await box(target), await box(canvas(page)), 1)) {
            ok = true;
            break;
          }
          await page.waitForTimeout(100);
        }
        notes.panMs = Date.now() - t0;
        notes.reached = ok;
        const log = await page.evaluate(() => {
          const w = window as unknown as {
            __frames: number;
            __stop: boolean;
            __log: [number, number][];
          };
          w.__stop = true;
          return w.__log;
        });
        notes.frames = log.length;
        const moves = log.flatMap((entry, i) =>
          i && entry[1] !== log[i - 1]?.[1]
            ? [[entry[0] - (log[i - 1]?.[0] ?? 0), Math.round((entry[1] - (log[i - 1]?.[1] ?? 0)) * 10) / 10]]
            : [],
        );
        notes.movingFrames = moves.length;
        notes.moves = moves.slice(0, 40);
        notes.firstMoveAt = log.find((entry, i) => i && entry[1] !== log[i - 1]?.[1])?.[0];
        notes.logStart = log[0]?.[0];
        notes.totalDx = Math.round(((log.at(-1)?.[1] ?? 0) - (log[0]?.[1] ?? 0)) * 10) / 10;
        notes.fps = Math.round(((notes.frames as number) / (notes.panMs as number)) * 10000) / 10;
        notes.panned = JSON.stringify(await read(page)) !== JSON.stringify(zoomed);
        await moveOnto(page, target);
        await page.mouse.up();
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      } finally {
        console.log(`V318 ${JSON.stringify(notes)}`);
        await page.request.delete(`/api/projects/${id}`);
      }
      expect(notes.reached).toBe(true);
    });

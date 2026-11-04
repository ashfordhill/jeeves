// SG06 one-off browser inspection of the automatic ELK layout. Owner projects are never written:
// every non-GET request naming an existing project is aborted (the Streamly page aborts all).
// Only the disposable projects created here are written, and they are deleted at the end.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG06";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
// A fresh Vite on 4302 (same source, proxying the 4310 API); see README for why not 4300.
const WEB = process.env.SG06_WEB ?? "http://127.0.0.1:4302";
const before = (await (await fetch(`${API}/projects`)).json()).projects;
const owners = before.map((p) => p.id);
const log = {
  owners,
  blocked: [],
  writes: [],
  created: [],
  deleted: {},
  shots: [],
  errors: [],
  obs: {},
};
const browser = await chromium.launch();
const zoomOf = async (page) =>
  Number(
    (await page.locator(".react-flow__viewport").evaluate((el) => el.style.transform)).match(
      /scale\(([\d.]+)\)/,
    )?.[1],
  );
const shot = async (page, file) => {
  await page.waitForTimeout(700);
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/${file}` });
  log.shots.push(file);
};
const ready = (page) =>
  page.waitForSelector('.studio-graph[data-layout="ready"]', { timeout: 15000 });
const tab = async (page, level) => {
  await page
    .getByRole("navigation", { name: "Architecture depth" })
    .getByRole("button", { name: level, exact: true })
    .click();
  await ready(page);
  await page.waitForTimeout(900);
};
const fitCamera = async (page) => {
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.waitForTimeout(700);
};
const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);
const ys = (page, ids) =>
  Promise.all(ids.map(async (id) => Math.round((await node(page, id).boundingBox())?.y ?? NaN)));
const guard = async (context, all = false) => {
  const page = await context.newPage();
  page.on("pageerror", (e) => log.errors.push(String(e)));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      const entry = `${req.method()} ${new URL(req.url()).pathname}`;
      if (all || owners.some((id) => req.url().includes(id))) {
        log.blocked.push(entry);
        return route.abort();
      }
      log.writes.push(entry);
    }
    return route.continue();
  });
  return page;
};
const writesSince = (mark) => log.writes.slice(mark);
try {
  for (const size of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
  ]) {
    const tag = `${size.w}x${size.h}`;
    const obs = {};
    log.obs[tag] = obs;
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await guard(context);
    await page.goto(`${WEB}/`);
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^Project:/ }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await page.waitForTimeout(800);
    await page.getByLabel("Project name").fill(`SG06 disposable TinyURL ${tag}`);
    await page.getByRole("button", { name: "Create project" }).click();
    await ready(page);
    await page.waitForTimeout(1500);
    const project = new URL(page.url()).searchParams.get("project");
    // Open, switch tabs and select with chat open: no layout write may happen.
    let mark = log.writes.length;
    obs.openedZoom = {};
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      obs.openedZoom[level] = await zoomOf(page);
      await shot(page, `${tag}-${level}-chat-open.png`);
    }
    await tab(page, "C2");
    await node(page, "studio:element:redirect").click();
    await page.waitForTimeout(500);
    await tab(page, "C3");
    await node(page, "studio:component:redirect-cache-reader").click();
    await page.waitForTimeout(500);
    await tab(page, "C1");
    obs.writesOnOpenSelectSwitch = writesSince(mark);
    // Chat collapsed, fitted.
    await page.getByRole("button", { name: "Collapse chat" }).click();
    await page.waitForTimeout(500);
    obs.fitZoom = {};
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
      await fitCamera(page);
      obs.fitZoom[level] = await zoomOf(page);
      await shot(page, `${tag}-${level}-fit.png`);
    }
    obs.writesIncludingFit = writesSince(mark);
    // Within-column reorder by mouse: drag Links database above Link cache at C2.
    await tab(page, "C2");
    await fitCamera(page);
    const column = ["studio:element:link-cache", "studio:element:links-db"];
    obs.reorderBefore = await ys(page, column);
    const from = await node(page, "studio:element:links-db").boundingBox();
    const to = await node(page, "studio:element:link-cache").boundingBox();
    mark = log.writes.length;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++)
      await page.mouse.move(
        from.x + from.width / 2 + i * 2,
        from.y + from.height / 2 + ((to.y - 60 - from.y) * i) / 12,
      );
    await shot(page, `${tag}-C2-reorder-dragging.png`);
    await page.mouse.up();
    await page.waitForTimeout(2000);
    obs.reorderWrites = writesSince(mark);
    obs.reorderAfter = await ys(page, column);
    await shot(page, `${tag}-C2-reordered.png`);
    const { layout } = await (await fetch(`${API}/projects/${project}/layout`)).json();
    obs.savedOrderHead = layout.architecture?.["studio:containers"]?.order?.slice(0, 4);
    obs.savedPositions = layout.architecture?.["studio:containers"]?.positions;
    // Undo restores the previous rows in one step; redo reapplies them.
    mark = log.writes.length;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.waitForTimeout(2500);
    obs.afterUndo = await ys(page, column);
    await shot(page, `${tag}-C2-reorder-undone.png`);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.waitForTimeout(2500);
    obs.afterRedo = await ys(page, column);
    obs.undoRedoWrites = writesSince(mark);
    // The row order persists across reload.
    await page.reload();
    await ready(page);
    await page.waitForTimeout(1500);
    obs.afterReload = await ys(page, column);
    await shot(page, `${tag}-C2-reordered-reloaded.png`);
    // Determinism: a fresh context renders the same node boxes.
    const one = await page.evaluate(() =>
      [...document.querySelectorAll(".react-flow__node")].map(
        (n) => `${n.getAttribute("data-id")} ${n.style.transform}`,
      ),
    );
    const other = await guard(
      await browser.newContext({ viewport: { width: size.w, height: size.h } }),
    );
    await other.goto(page.url());
    await ready(other);
    await other.waitForTimeout(1500);
    const two = await other.evaluate(() =>
      [...document.querySelectorAll(".react-flow__node")].map(
        (n) => `${n.getAttribute("data-id")} ${n.style.transform}`,
      ),
    );
    obs.deterministic = JSON.stringify(one.sort()) === JSON.stringify(two.sort());
    await other.context().close();
    await context.close();
  }
  // Streamly owner project, read-only (every non-GET request aborted).
  const streamly = before.find((p) => p.name.startsWith("Streamly"));
  if (streamly) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await guard(context, true);
    await page.goto(`${WEB}/?project=${streamly.id}#/draw`);
    await ready(page);
    await page.waitForTimeout(1500);
    await page
      .getByRole("button", { name: "Collapse chat" })
      .click()
      .catch(() => {});
    const obs = { name: streamly.name, fitZoom: {} };
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      await fitCamera(page);
      obs.fitZoom[level] = await zoomOf(page);
      await shot(page, `1440x900-streamly-${level}-fit.png`);
    }
    log.obs.streamly = obs;
    await context.close();
  }
} finally {
  await browser.close();
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.created = after
    .filter((p) => !owners.includes(p.id) && p.name.startsWith("SG06 disposable TinyURL"))
    .map((p) => p.id);
  for (const id of log.created)
    log.deleted[id] = (await fetch(`${API}/projects/${id}`, { method: "DELETE" })).status;
  log.ownersUnchanged = before.map((p) => {
    const now = after.find((q) => q.id === p.id);
    return {
      id: p.id,
      same: !!now && now.updatedAt === p.updatedAt && now.revision === p.revision,
    };
  });
  writeFileSync(`${DIR}/capture-log.json`, `${JSON.stringify(log, null, 2)}\n`);
  console.log(JSON.stringify(log, null, 2));
}

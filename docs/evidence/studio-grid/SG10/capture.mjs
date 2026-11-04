// SG10 one-off acceptance capture: final TinyURL C1/C2/C3 fit at both sizes and a full mouse
// walkthrough (tabs, + spawn, drop-to-connect, merged-line chooser, component autosave, row
// reorder, undo/redo, reload, blueprint GET). Owner projects are never written: every non-GET
// request naming an existing project is aborted. Only the disposable projects created here are
// written, and they are deleted at the end.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG10";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
const WEB = process.env.SG10_WEB ?? "http://127.0.0.1:4302";
const SIZES = (process.env.SG10_SIZES ?? "1440x900,1280x800").split(",");
const before = (await (await fetch(`${API}/projects`)).json()).projects;
const owners = before.map((p) => p.id);
const log = {
  owners: owners.length,
  blocked: [],
  writes: [],
  created: [],
  deleted: {},
  shots: [],
  errors: [],
  obs: {},
};
const browser = await chromium.launch();
const wait = (page, ms = 700) => page.waitForTimeout(ms);
const dismiss = async (page) => {
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
};
const shot = async (page, file) => {
  await wait(page);
  await dismiss(page);
  await page.screenshot({ path: `${OUT}/${file}` });
  log.shots.push(file);
};
const ready = (page) =>
  page.waitForSelector('.studio-graph[data-layout="ready"]', { timeout: 15000 });
const zoomOf = async (page) =>
  Number(
    (await page.locator(".react-flow__viewport").evaluate((el) => el.style.transform)).match(
      /scale\(([\d.]+)\)/,
    )?.[1],
  );
const fitView = async (page) => {
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await wait(page);
};
const tab = async (page, level) => {
  await page
    .getByRole("navigation", { name: "Architecture depth" })
    .getByRole("button", { name: level, exact: true })
    .click();
  await ready(page);
  await wait(page, 900);
};
const node = (page, name) =>
  page
    .locator(".react-flow__node")
    .filter({ has: page.locator(`strong:text-is("${name}")`) })
    .last();
const byId = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);
const heading = (page) =>
  page
    .locator(".studio-inspector h2")
    .first()
    .textContent()
    .catch(() => null);
const select = async (page, name) => {
  const box = node(page, name);
  const b = await box.boundingBox();
  if (!b) throw new Error(`No box ${name}`);
  const frame = (await box.getAttribute("class"))?.includes("frame");
  await page.mouse.click(b.x + (frame ? 24 : b.width / 2), b.y + (frame ? 12 : b.height / 2));
  await wait(page, 500);
};
const counts = (page) =>
  page.evaluate(() => ({
    boxes: document.querySelectorAll(".react-flow__node").length,
    lines: document.querySelectorAll(".react-flow__edge").length,
  }));
const pull = async (page, name, side, to) => {
  const box = node(page, name);
  const b = await box.boundingBox();
  await page.mouse.move(b.x + 24, b.y + 12);
  await wait(page, 300);
  const h = await box.locator(`.studio-spawn[data-side="${side}"]`).first().boundingBox();
  if (!h) throw new Error(`No ${side} handle on ${name}`);
  const sx = h.x + h.width / 2,
    sy = h.y + h.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  let tx, ty;
  if (typeof to === "string") {
    const t = await node(page, to).boundingBox();
    tx = t.x + t.width / 2;
    ty = t.y + t.height / 2;
  } else {
    tx = sx + to.dx;
    ty = sy + to.dy;
  }
  await page.mouse.move(tx, ty, { steps: 12 });
  await wait(page, 300);
  const preview = await page.locator(".studio-pull").count();
  await page.mouse.up();
  await wait(page, 500);
  return preview;
};
const pick = async (page, label) => {
  const kinds = await page.locator(".studio-picker .studio-kind").allTextContents();
  await page.locator(".studio-picker .studio-kind", { hasText: label }).first().click();
  await page.waitForFunction(() => !document.querySelector(".studio-picker"), null, {
    timeout: 8000,
  });
  await ready(page);
  await wait(page, 900);
  return kinds;
};
const design = async (id) => (await (await fetch(`${API}/projects/${id}/design`)).json()).design;
const comp = (d, name) => d.architecture.studio.components.find((c) => c.name === name);
const guard = async (context) => {
  const page = await context.newPage();
  page.on("pageerror", (e) => log.errors.push(String(e)));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      const entry = `${req.method()} ${new URL(req.url()).pathname}`;
      if (owners.some((id) => req.url().includes(id))) {
        log.blocked.push(entry);
        return route.abort();
      }
      log.writes.push(entry);
    }
    return route.continue();
  });
  return page;
};
const newProject = async (page, name) => {
  await page.goto(`${WEB}/`);
  await wait(page, 3000);
  await page.getByRole("button", { name: /^Project:/ }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await wait(page, 800);
  await page.getByRole("button", { name: "Choose Architecture study" }).click();
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await ready(page);
  await wait(page, 1500);
  const id = new URL(page.url()).searchParams.get("project");
  log.created.push({ id, name });
  if (await page.getByRole("button", { name: "Collapse chat" }).isVisible()) {
    await page.getByRole("button", { name: "Collapse chat" }).click();
    await wait(page, 400);
  }
  return id;
};
const ys = (page, ids) =>
  Promise.all(ids.map(async (id) => Math.round((await byId(page, id).boundingBox())?.y ?? NaN)));

try {
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number);
    const obs = { fitZoom: {}, fitCounts: {} };
    log.obs[size] = obs;
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await guard(context);
    const id = await newProject(page, `SG10 disposable TinyURL ${size}`);

    // 1. Final fit screenshots of the untouched study.
    let mark = log.writes.length;
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
      await fitView(page);
      obs.fitZoom[level] = await zoomOf(page);
      obs.fitCounts[level] = await counts(page);
      await shot(page, `${size}-final-${level}-fit.png`);
    }
    obs.writesOnOpenTabsFit = log.writes.slice(mark);

    // 2. Tabs keep selection by identity: Redirect service on C2 -> C3 -> C2.
    await tab(page, "C2");
    await fitView(page);
    await select(page, "Redirect service");
    obs.selectC2 = await heading(page);
    await tab(page, "C3");
    obs.carriedToC3 = await heading(page);
    await tab(page, "C2");
    obs.carriedBackToC2 = await heading(page);
    obs.backOrBreadcrumb = {
      back: await page.getByRole("button", { name: /^Back/ }).allTextContents(),
      breadcrumb: await page.getByRole("navigation", { name: /breadcrumb/i }).count(),
      tabs: await page
        .getByRole("navigation", { name: "Architecture depth" })
        .getByRole("button")
        .allTextContents(),
    };

    // 3. Merged line chooser at C2.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
    await fitView(page);
    const merged = page.locator("g[data-merged] text").first();
    obs.mergedLabel = (await merged.locator("tspan").allTextContents()).join(" / ");
    await merged.click();
    await wait(page, 900);
    const chooser = page.getByRole("group", { name: "Connection members" });
    obs.chooserOptions = await chooser.getByRole("button").allTextContents();
    if (size === SIZES[0]) await shot(page, `${size}-walk-merged-chooser.png`);
    await chooser.getByRole("button").first().click();
    await wait(page, 700);
    obs.chooserMemberForm = await page
      .locator('.studio-inspector form[aria-label="Connection settings"]')
      .count();

    // 4. Row reorder by mouse at C2: Links database above Link cache, then undo / redo, reload.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
    await fitView(page);
    const column = ["studio:element:link-cache", "studio:element:links-db"];
    obs.reorderBefore = await ys(page, column);
    const from = await byId(page, "studio:element:links-db").boundingBox();
    const to = await byId(page, "studio:element:link-cache").boundingBox();
    mark = log.writes.length;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++)
      await page.mouse.move(
        from.x + from.width / 2 + i * 2,
        from.y + from.height / 2 + ((to.y - 60 - from.y) * i) / 12,
      );
    await page.mouse.up();
    await wait(page, 2000);
    obs.reorderWrites = log.writes.slice(mark);
    obs.reorderAfter = await ys(page, column);
    if (size === SIZES[0]) await shot(page, `${size}-walk-reordered.png`);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await wait(page, 2500);
    obs.reorderUndo = await ys(page, column);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await wait(page, 2500);
    obs.reorderRedo = await ys(page, column);

    // 5. Spawn by + handle at C2: Shorten API east handle -> Search; undo / redo.
    await fitView(page);
    const c2Before = await counts(page);
    obs.spawnPreview = await pull(page, "Shorten API", "out", { dx: 170, dy: -120 });
    obs.spawnPicker = await pick(page, "Search index");
    obs.spawnAfter = await counts(page);
    obs.spawnInspector = await page
      .locator('.studio-inspector form[aria-label="Connection settings"]')
      .count();
    if (size === SIZES[0]) await shot(page, `${size}-walk-spawned.png`);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.spawnUndo = await counts(page);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.spawnRedo = await counts(page);
    obs.c2Before = c2Before;

    // 6. Drop-to-connect: Analytics worker east handle onto the new Search box.
    await fitView(page);
    obs.dropPreview = await pull(page, "Analytics worker", "out", "Search index");
    const dialog = page.getByRole("dialog", { name: "Connect" });
    obs.dropDialog = {
      open: await dialog.isVisible(),
      source: await dialog.getByLabel("Source").locator("option:checked").textContent(),
      target: await dialog.getByLabel("Target").locator("option:checked").textContent(),
    };
    if (size === SIZES[0]) await shot(page, `${size}-walk-drop-form.png`);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.dropAfter = await counts(page);

    // 7. Component edit autosave at C3, with undo / redo.
    await tab(page, "C3");
    await fitView(page);
    await select(page, "Link writer");
    obs.componentHeading = await heading(page);
    const optionsTab = page
      .locator(".studio-inspector")
      .getByRole("tab", { name: "Options", exact: true });
    if (await optionsTab.count()) await optionsTab.click();
    await wait(page, 200);
    const pool = page.locator(".studio-inspector").getByLabel("Pool size", { exact: true });
    await pool.click();
    await pool.fill("32");
    await wait(page, 1500);
    obs.poolSaved = comp(await design(id), "Link writer").settings.poolSize;
    if (size === SIZES[0]) await shot(page, `${size}-walk-component-autosaved.png`);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await wait(page, 1200);
    obs.poolUndo = comp(await design(id), "Link writer").settings.poolSize;
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await wait(page, 1200);
    obs.poolRedo = comp(await design(id), "Link writer").settings.poolSize;

    // 8. Reload: everything persists.
    await page.reload();
    await ready(page);
    await wait(page, 1500);
    await tab(page, "C2");
    await fitView(page);
    obs.reloadC2 = await counts(page);
    obs.reloadOrder = await ys(page, column);
    obs.reloadSearch = await node(page, "Search index").count();
    if (size === SIZES[0]) await shot(page, `${size}-walk-reloaded-C2.png`);
    await tab(page, "C3");
    await select(page, "Link writer");
    const ot = page.locator(".studio-inspector").getByRole("tab", { name: "Options", exact: true });
    if (await ot.count()) await ot.click();
    obs.reloadPool = await page
      .locator(".studio-inspector")
      .getByLabel("Pool size", { exact: true })
      .inputValue();
    const { layout } = await (await fetch(`${API}/projects/${id}/layout`)).json();
    obs.savedLayout = {
      positions: layout.architecture?.["studio:containers"]?.positions,
      orderHead: layout.architecture?.["studio:containers"]?.order?.slice(0, 4),
    };

    // 9. Blueprint GET (through the web proxy, as a generator would read it).
    const res = await page.request.get(`${WEB}/api/projects/${id}/blueprint`);
    const bp = await res.json();
    obs.blueprint = {
      status: res.status(),
      cacheControl: res.headers()["cache-control"],
      version: bp.blueprint,
      services: bp.services?.map((s) => `${s.name} (${s.components?.length ?? 0} components)`),
      resources: bp.resources?.map((r) => r.name),
      externals: bp.externals?.map((e) => e.name),
      connections: bp.connections?.length,
      componentLinks: bp.componentLinks?.length,
      linkWriterPool: bp.services
        ?.flatMap((s) => s.components ?? [])
        .find((c) => c.name === "Link writer")?.settings.poolSize,
      omitted: bp.omitted?.length,
      hasLayoutKeys: ["layout", "positions", "viewport", "history"].filter((k) =>
        JSON.stringify(bp).includes(`"${k}"`),
      ),
    };
    if (size === SIZES[0])
      writeFileSync(`${DIR}/blueprint-after-walkthrough.json`, `${JSON.stringify(bp, null, 2)}\n`);
    await context.close();
  }
} catch (e) {
  log.errors.push(`script: ${e.stack ?? e}`);
} finally {
  for (const { id } of log.created) {
    const r = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    log.deleted[id] = r.status;
  }
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.ownerUnchanged = before.every((p) => {
    const a = after.find((x) => x.id === p.id);
    return a && a.updatedAt === p.updatedAt && a.revision === p.revision;
  });
  log.projectCountRestored = after.length === before.length;
  await browser.close();
  writeFileSync(`${DIR}/capture-log.json`, `${JSON.stringify(log, null, 2)}\n`);
  console.log(JSON.stringify(log, null, 2));
}

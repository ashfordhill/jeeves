// SG08 one-off browser inspection: `+` handle spawn, drop-to-connect, New island, first box.
// Real mouse moves/down/up. Owner projects are never written: every non-GET request naming an
// existing project is aborted. Only the disposable projects created here are written, and they
// are deleted at the end.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG08";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
// A separate Vite on 4302 (same checkout, proxying the 4310 API).
const WEB = process.env.SG08_WEB ?? "http://127.0.0.1:4302";
const SIZES = (process.env.SG08_SIZES ?? "1440x900,1280x800").split(",");
const RECORD = process.env.SG08_RECORD !== "0";
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
const shot = async (page, file) => {
  await wait(page);
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
  await wait(page, 900);
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await wait(page);
};
const node = (page, name) =>
  page
    .locator(".react-flow__node")
    .filter({ has: page.locator(`strong:text-is("${name}")`) })
    .first();
const notice = async (page) => (await page.locator(".studio-notice").allTextContents()).join(" | ");
const dismiss = async (page) => {
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
};
/** Hover the box, press its handle, drag (to a point or onto a box) with real mouse steps. */
const pull = async (page, name, side, to, file) => {
  const box = node(page, name);
  await box.hover();
  await wait(page, 300);
  const handle = box.locator(`.studio-spawn[data-side="${side}"]`);
  const h = await handle.boundingBox();
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
  if (file) await shot(page, file);
  const preview = await page.locator(".studio-pull").count();
  await page.mouse.up();
  await wait(page, 500);
  return preview;
};
const pickKind = async (page, label) => {
  const dialog = page.locator(".studio-picker");
  const kinds = await dialog.locator(".studio-kind").allTextContents();
  await dialog.locator(".studio-kind", { hasText: label }).first().click();
  await page.waitForFunction(() => !document.querySelector(".studio-picker"), null, {
    timeout: 8000,
  });
  await ready(page);
  await wait(page, 900);
  return kinds;
};
const inspector = async (page) => ({
  heading: await page
    .locator(".studio-inspector h2")
    .first()
    .textContent()
    .catch(() => null),
  connectionForm: await page
    .locator('.studio-inspector form[aria-label="Connection settings"]')
    .count(),
  action: await page
    .locator(".studio-inspector form input")
    .first()
    .inputValue()
    .catch(() => null),
});
const counts = (page) =>
  page.evaluate(() => ({
    boxes: document.querySelectorAll(".react-flow__node").length,
    lines: document.querySelectorAll(".react-flow__edge").length,
  }));
const design = async (id) => await (await fetch(`${API}/projects/${id}/design`)).json();
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
const newProject = async (page, name, choice) => {
  await page.goto(`${WEB}/`);
  await wait(page, 3000);
  await page.getByRole("button", { name: /^Project:/ }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await wait(page, 800);
  await page.getByRole("button", { name: `Choose ${choice}` }).click();
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
try {
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number);
    const obs = {};
    log.obs[size] = obs;
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      ...(RECORD &&
        size === SIZES[0] && {
          recordVideo: { dir: `${DIR}/video`, size: { width: w, height: h } },
        }),
    });
    const page = await guard(context);
    // --- TinyURL study ---
    const tiny = await newProject(page, `SG08 disposable TinyURL ${size}`, "Architecture study");
    // C1: spawn an external system after the system.
    await tab(page, "C1");
    await shot(page, `${size}-tiny-C1-before.png`);
    const c1Before = await counts(page);
    obs.c1Preview = await pull(
      page,
      "TinyURL",
      "out",
      { dx: 160, dy: 140 },
      `${size}-tiny-C1-pulling.png`,
    );
    obs.c1Picker = await page.locator(".studio-picker .studio-kind").allTextContents();
    await shot(page, `${size}-tiny-C1-picker.png`);
    await pickKind(page, "External system");
    obs.c1After = { before: c1Before, after: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-tiny-C1-spawned.png`);
    // C2: spawn a cache from Shorten API, then undo / redo it.
    await tab(page, "C2");
    const c2Before = await counts(page);
    obs.c2Preview = await pull(
      page,
      "Shorten API",
      "out",
      { dx: 170, dy: -120 },
      `${size}-tiny-C2-pulling.png`,
    );
    obs.c2Picker = await page.locator(".studio-picker .studio-kind").allTextContents();
    await shot(page, `${size}-tiny-C2-picker.png`);
    await pickKind(page, "Cache");
    obs.c2After = { before: c2Before, after: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-tiny-C2-spawned.png`);
    const rev1 = (await design(tiny)).design.revision;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.c2Undo = {
      counts: await counts(page),
      revisionBefore: rev1,
      cacheCards: await node(page, "Cache").count(),
    };
    await shot(page, `${size}-tiny-C2-undone.png`);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.c2Redo = { counts: await counts(page), cacheCards: await node(page, "Cache").count() };
    // West handle: spawn a source (picker kinds differ by side).
    await pull(page, "Links database", "in", { dx: -160, dy: 150 });
    obs.c2WestPicker = await page.locator(".studio-picker .studio-kind").allTextContents();
    await shot(page, `${size}-tiny-C2-west-picker.png`);
    await page.keyboard.press("Escape");
    await wait(page, 300);
    obs.c2EscapeClosesPicker = (await page.locator(".studio-picker").count()) === 0;
    // Drop on an existing box: Analytics worker -> Cache opens the prefilled connection form.
    obs.dropPreview = await pull(
      page,
      "Analytics worker",
      "out",
      "Cache",
      `${size}-tiny-C2-drop-hover.png`,
    );
    const dialog = page.getByRole("dialog", { name: "Connect" });
    obs.dropDialog = {
      open: await dialog.isVisible(),
      source: await dialog.getByLabel("Source").locator("option:checked").textContent(),
      target: await dialog.getByLabel("Target").locator("option:checked").textContent(),
      action: await dialog.getByLabel("Action", { exact: true }).inputValue(),
    };
    await shot(page, `${size}-tiny-C2-drop-form.png`);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    obs.dropAfter = { counts: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-tiny-C2-dropped.png`);
    // C3: from a component, spawn another component, then a data store through the host.
    await tab(page, "C3");
    const c3Before = await counts(page);
    await pull(page, "Rate limiter", "out", { dx: 120, dy: 160 }, `${size}-tiny-C3-pulling.png`);
    obs.c3ComponentPicker = await page.locator(".studio-picker .studio-kind").allTextContents();
    await shot(page, `${size}-tiny-C3-picker.png`);
    await pickKind(page, "Auth guard");
    obs.c3Component = {
      before: c3Before,
      after: await counts(page),
      inspector: await inspector(page),
    };
    await shot(page, `${size}-tiny-C3-component-spawned.png`);
    // A data-access component targets databases only; the new database is owned by its host.
    await pull(page, "Link writer", "out", { dx: 150, dy: 160 });
    obs.c3DataAccessPickerElements = await page
      .locator(".studio-picker .studio-kind-group")
      .nth(1)
      .locator(".studio-kind")
      .allTextContents();
    await pickKind(page, "Database");
    obs.c3Element = { after: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-tiny-C3-resource-spawned.png`);
    // C3 drop: Auth guard -> Link writer (same application) links them directly.
    await pull(page, "Auth guard", "out", "Link writer");
    obs.c3Drop = { after: await counts(page), notice: await notice(page) };
    await dismiss(page);
    // New island at C3 (no owner selected: no queue).
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
    await page.getByRole("button", { name: "New island" }).click();
    await wait(page, 300);
    obs.c3IslandKinds = await page.locator(".studio-picker .studio-kind").allTextContents();
    await shot(page, `${size}-tiny-C3-island-picker.png`);
    await pickKind(page, "Object storage");
    obs.c3Island = await counts(page);
    await shot(page, `${size}-tiny-C3-island.png`);
    // Reload and confirm persistence.
    await page.reload();
    await ready(page);
    await wait(page, 1500);
    await tab(page, "C3");
    obs.reloadC3 = await counts(page);
    await shot(page, `${size}-tiny-C3-reloaded.png`);
    const saved = (await design(tiny)).design;
    obs.saved = {
      elements: saved.elements.map((e) => e.name),
      components: saved.architecture?.studio?.components?.map((c) => c.name),
      connections: saved.connections.length,
      componentLinks: saved.architecture?.studio?.componentConnections?.length,
      contextNodes: saved.architecture?.nodes.map((n) => n.name),
    };
    // Shortcuts still work.
    await page.keyboard.press("h");
    obs.handAfterH = await page
      .getByRole("button", { name: "Hand", exact: true })
      .getAttribute("aria-pressed");
    obs.handlesInHand = await node(page, "Rate limiter")
      .hover()
      .then(() => node(page, "Rate limiter").locator(".studio-spawn").count());
    await page.keyboard.press("v");
    obs.selectAfterV = await page
      .getByRole("button", { name: "Select", exact: true })
      .getAttribute("aria-pressed");
    // --- Blank architecture ---
    const blank = await newProject(page, `SG08 disposable Blank ${size}`, "Blank architecture");
    await tab(page, "C2");
    obs.blankEmpty = await page.locator(".studio-empty").isVisible();
    obs.blankKinds = await page.locator(".studio-empty .studio-kind").allTextContents();
    await shot(page, `${size}-blank-C2-empty.png`);
    await page.locator(".studio-empty .studio-kind", { hasText: "Microservice" }).click();
    await ready(page);
    await wait(page, 1200);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await pull(page, "Microservice", "out", { dx: 170, dy: 0 });
    await pickKind(page, "Database");
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await page.getByRole("button", { name: "New island" }).click();
    await pickKind(page, "Browser app");
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    obs.blankC2 = { counts: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-blank-C2-island.png`);
    // Connect the island by handle drop: Browser app -> Microservice.
    await pull(page, "Browser app", "out", "Microservice");
    const bd = page.getByRole("dialog", { name: "Connect" });
    obs.blankDropAction = await bd.getByLabel("Action", { exact: true }).inputValue();
    await bd.getByRole("button", { name: "Connect", exact: true }).click();
    await ready(page);
    await wait(page, 1200);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    obs.blankConnected = await counts(page);
    await shot(page, `${size}-blank-C2-connected.png`);
    await tab(page, "C3");
    obs.blankC3 = await counts(page);
    // C3 from the application: queue owned by it.
    await pull(page, "Microservice", "out", { dx: 160, dy: 120 });
    obs.blankC3Picker = await page.locator(".studio-picker .studio-kind").allTextContents();
    await pickKind(page, "Queue");
    obs.blankC3Queue = { counts: await counts(page), inspector: await inspector(page) };
    await shot(page, `${size}-blank-C3-queue.png`);
    const bsaved = (await design(blank)).design;
    obs.blankSaved = {
      queueOwner: bsaved.architecture?.studio?.elements.find((e) => e.settings.kind === "queue")
        ?.owner,
      connections: bsaved.connections.map((c) => `${c.planned?.label} ${c.planned?.protocol}`),
    };
    await context.close();
  }
} finally {
  for (const { id } of log.created) {
    const r = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    log.deleted[id] = r.status;
  }
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.ownerUnchanged = before.every((p) => {
    const a = after.find((x) => x.id === p.id);
    return a && a.updatedAt === p.updatedAt;
  });
  await browser.close();
  writeFileSync(`${DIR}/capture-log.json`, `${JSON.stringify(log, null, 2)}\n`);
}

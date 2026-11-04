// SG05 one-off browser inspection. Owner projects are never written: every non-GET request that
// names an existing project is aborted. Only the disposable projects created here are written and
// then deleted.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG05";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
const WEB = "http://127.0.0.1:4300";
const before = (await (await fetch(`${API}/projects`)).json()).projects;
const owners = before.map((p) => p.id);
const log = {
  owners,
  blocked: [],
  created: [],
  deleted: {},
  shots: [],
  errors: [],
  observations: {},
};
const browser = await chromium.launch();
const shot = async (page, file) => {
  await page.waitForTimeout(900);
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/${file}` });
  log.shots.push(file);
};
const graph = (page) =>
  page.locator(".studio-graph").evaluate((el) => ({
    scope: el.getAttribute("data-scope"),
    label: el.getAttribute("aria-label"),
    nodes: el.querySelectorAll(".react-flow__node").length,
    frames: [...el.querySelectorAll(".studio-frame strong")].map((n) => n.textContent),
    components: el.querySelectorAll('.studio-card[data-kind="component"]').length,
    queues: el.querySelectorAll('.studio-card[data-kind="queue"]').length,
    edges: el.querySelectorAll(".react-flow__edge").length,
    selected: [...el.querySelectorAll(".react-flow__node.selected")].map((n) =>
      n.getAttribute("data-id"),
    ),
  }));
const tab = async (page, level) => {
  await page
    .getByRole("navigation", { name: "Architecture depth" })
    .getByRole("button", { name: level, exact: true })
    .click();
  await page.waitForTimeout(1800);
};
const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);
const guard = async (context, all = false) => {
  const page = await context.newPage();
  page.on("pageerror", (e) => log.errors.push(String(e)));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method()) &&
      (all || owners.some((id) => req.url().includes(id)))
    ) {
      log.blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    return route.continue();
  });
  return page;
};
try {
  for (const size of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
  ]) {
    const tag = `${size.w}x${size.h}`;
    const obs = {};
    log.observations[tag] = obs;
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await guard(context);
    await page.goto(`${WEB}/`);
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^Project:/ }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await page.waitForTimeout(800);
    await page.getByLabel("Project name").fill(`SG05 disposable TinyURL ${tag}`);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForTimeout(4000);
    obs.tabs = await page
      .getByRole("navigation", { name: "Architecture depth" })
      .getByRole("button")
      .allTextContents();
    obs.breadcrumb = await page.locator(".studio-breadcrumb").count();
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      obs[level] = await graph(page);
      await shot(page, `${tag}-${level}.png`);
    }
    // Selection persists by identity: Redirect service at C2 → C3 frame → C2.
    await tab(page, "C2");
    await node(page, "studio:element:redirect").click();
    await page.waitForTimeout(600);
    obs.selectC2 = (await graph(page)).selected;
    await tab(page, "C3");
    obs.carriedToC3 = (await graph(page)).selected;
    await shot(page, `${tag}-C3-redirect-selected.png`);
    await node(page, "studio:component:redirect-cache-reader").click();
    await page.waitForTimeout(600);
    obs.selectComponent = (await graph(page)).selected;
    obs.componentInspector = await page
      .locator(".studio-inspector .studio-selection-summary")
      .innerText()
      .catch(() => "");
    await shot(page, `${tag}-C3-component-selected.png`);
    await tab(page, "C2");
    obs.componentCarriedToC2 = (await graph(page)).selected;
    await tab(page, "C1");
    obs.atC1 = (await graph(page)).selected;
    await tab(page, "C3");
    obs.backAtC3 = (await graph(page)).selected;
    // Double-click no longer drills.
    await tab(page, "C2");
    await node(page, "studio:element:shorten-api").dblclick();
    await page.waitForTimeout(1200);
    obs.afterDoubleClickC2 = (await graph(page)).scope;
    await tab(page, "C3");
    await node(page, "studio:element:redirect").dblclick({ position: { x: 8, y: 4 } });
    await page.waitForTimeout(1200);
    obs.afterDoubleClickC3 = (await graph(page)).scope;
    // Zoom toward a frame by mouse wheel to show card legibility.
    for (const [level, id, file] of [
      ["C3", "studio:element:redirect", "C3-zoomed-redirect"],
      ["C2", "studio:package:link-platform", "C2-zoomed-package"],
    ]) {
      await tab(page, level);
      const box = await node(page, id).boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 6; i++) {
          await page.mouse.wheel(0, -120);
          await page.waitForTimeout(150);
        }
      }
      await shot(page, `${tag}-${file}.png`);
    }
    // Old saved detail-scope URL and preferences open the whole-system C3 without errors.
    const url = new URL(page.url());
    const project = url.searchParams.get("project");
    obs.project = project;
    await page.evaluate((id) => {
      const key = `jeeves.studio.ui.v1:${id}`;
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      saved.scope = "studio:service:redirect";
      saved.cameras = {
        ...saved.cameras,
        "studio:service:redirect": { x: 10, y: 10, zoom: 0.8 },
        "studio:package:link-platform": { x: 0, y: 0, zoom: 1 },
      };
      localStorage.setItem(key, JSON.stringify(saved));
    }, project);
    url.searchParams.delete("studioScope");
    url.searchParams.delete("studioTarget");
    await page.goto(url.toString());
    await page.waitForTimeout(3500);
    obs.legacyPreference = await graph(page);
    url.searchParams.set("studioScope", "studio:package:link-platform");
    await page.goto(url.toString());
    await page.waitForTimeout(3500);
    obs.legacyUrl = await graph(page);
    await context.close();
  }
  // A legacy owner project still opens read-only (every non-GET request aborted).
  const legacy = before[0];
  if (legacy) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await guard(context, true);
    await page.goto(`${WEB}/?project=${legacy.id}#/draw`);
    await page.waitForTimeout(4000);
    const obs = { name: legacy.name };
    for (const level of ["C2", "C3"]) {
      await tab(page, level);
      obs[level] = await graph(page);
      await shot(page, `1440x900-owner-legacy-${level}.png`);
    }
    log.observations.ownerLegacy = obs;
    await context.close();
  }
} finally {
  await browser.close();
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.created = after
    .filter((p) => !owners.includes(p.id) && p.name.startsWith("SG05 disposable TinyURL"))
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

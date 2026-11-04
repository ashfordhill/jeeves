// SG07 one-off browser inspection: merged lines, short labels, constant-width strokes.
// Owner projects are never written: every non-GET request naming an existing project is aborted
// (the Streamly page aborts all). Only the disposable projects created here are written, and they
// are deleted at the end.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG07";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
// A separate Vite on 4302 (same checkout, proxying the 4310 API); see README.
const WEB = process.env.SG07_WEB ?? "http://127.0.0.1:4302";
const PREFIX = "SG07 disposable TinyURL";
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
const shot = async (page, file, clip) => {
  await page.waitForTimeout(700);
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/${file}`, ...(clip && { clip }) });
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
/** Lines, labels and overlaps as drawn on screen. */
const lines = (page) =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".react-flow__node-studio")].map((n) =>
      n.getBoundingClientRect(),
    );
    const texts = [...document.querySelectorAll(".studio-relation-text")];
    const read = (t) => [...t.querySelectorAll("tspan")].map((x) => x.textContent).join(" / ");
    const hit = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const boxes = texts.map((t) => t.getBoundingClientRect());
    const path = document.querySelector(".react-flow__edge-path");
    const style = path && getComputedStyle(path);
    const arrow = document.querySelector(".studio-arrow")?.getBoundingClientRect();
    return {
      lines: document.querySelectorAll(".react-flow__edge").length,
      merged: [...document.querySelectorAll("[data-merged]")]
        .filter((g) => g.tagName === "g")
        .map((g) => {
          const t = g.querySelector("text");
          return `${g.getAttribute("data-merged")} | ${t ? read(t) : "(label hidden)"}`;
        }),
      labelsShown: texts.length,
      labels: texts.map(read),
      labelScreenFontPx:
        Math.round(
          12 *
            Number(
              document
                .querySelector(".react-flow__viewport")
                .style.transform.match(/scale\(([\d.]+)\)/)?.[1],
            ) *
            10,
        ) / 10,
      labelOverBox: boxes.filter((b) => nodes.some((n) => hit(b, n))).length,
      labelOverLabel: boxes.filter((b, i) => boxes.some((o, j) => j !== i && hit(b, o))).length,
      strokeWidth: style?.strokeWidth,
      vectorEffect: style?.vectorEffect,
      arrowPx: arrow ? [Math.round(arrow.width), Math.round(arrow.height)] : undefined,
    };
  });
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
try {
  for (const size of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
  ]) {
    const tag = `${size.w}x${size.h}`;
    const obs = { fitZoom: {}, fit: {} };
    log.obs[tag] = obs;
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await guard(context);
    await page.goto(`${WEB}/`);
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^Project:/ }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await page.waitForTimeout(800);
    await page.getByLabel("Project name").fill(`${PREFIX} ${tag}`);
    await page.getByRole("button", { name: "Create project" }).click();
    await ready(page);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Collapse chat" }).click();
    await page.waitForTimeout(500);
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
      await fitCamera(page);
      obs.fitZoom[level] = await zoomOf(page);
      obs.fit[level] = await lines(page);
      await shot(page, `${tag}-${level}-fit.png`);
    }
    // Close-up of the fitted C3 at screen scale: line thickness and arrowheads at fit.
    const graph = await page.locator(".studio-graph").boundingBox();
    await shot(page, `${tag}-C3-fit-closeup.png`, {
      x: graph.x + graph.width * 0.3,
      y: graph.y + graph.height * 0.25,
      width: 520,
      height: 320,
    });
    // Merged line at C2: click its count label; the inspector opens the member chooser.
    await tab(page, "C2");
    await fitCamera(page);
    const merged = page.locator("g[data-merged] text").first();
    obs.mergedLabel = (await merged.locator("tspan").allTextContents()).join(" / ");
    await merged.click();
    await page.waitForTimeout(900);
    const chooser = page.getByRole("group", { name: "Connection members" });
    obs.chooserVisible = await chooser.isVisible();
    obs.chooserOptions = await chooser.getByRole("button").allTextContents();
    obs.selectedStroke = await page
      .locator(".react-flow__edge.selected .react-flow__edge-path")
      .first()
      .evaluate((el) => getComputedStyle(el).strokeWidth)
      .catch(() => undefined);
    await shot(page, `${tag}-C2-merged-chooser.png`);
    await chooser.getByRole("button").first().click();
    await page.waitForTimeout(700);
    obs.memberFormOpen = await page
      .locator(".studio-inspector form, .studio-inspector fieldset")
      .count();
    await shot(page, `${tag}-C2-merged-member.png`);
    // Zoomed in (about 1.0): strokes keep 2px on screen; labels at full size.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 300 } });
    await tab(page, "C3");
    await fitCamera(page);
    await page.mouse.move(graph.x + graph.width / 2, graph.y + graph.height / 2);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(250);
    }
    obs.zoomedC3 = { zoom: await zoomOf(page), ...(await lines(page)) };
    await shot(page, `${tag}-C3-zoomed.png`);
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
    const obs = { name: streamly.name, fitZoom: {}, fit: {} };
    for (const level of ["C1", "C2", "C3"]) {
      await tab(page, level);
      await fitCamera(page);
      obs.fitZoom[level] = await zoomOf(page);
      obs.fit[level] = await lines(page);
      await shot(page, `1440x900-streamly-${level}-fit.png`);
    }
    log.obs.streamly = obs;
    await context.close();
  }
} finally {
  await browser.close();
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.created = after
    .filter((p) => !owners.includes(p.id) && p.name.startsWith(PREFIX))
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

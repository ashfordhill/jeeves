import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const OUT = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG01/screenshots";
mkdirSync(OUT, { recursive: true });
const projects = [
  { slug: "mattermost", name: "Mattermost · backend design review" },
  { slug: "streamly", name: "Streamly · video platform" },
];
const sizes = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
];
const log = { blocked: [], shots: [], scopes: {} };
const browser = await chromium.launch();

async function bounds(page) {
  return page.evaluate(() => {
    const pane = document.querySelector(".react-flow").getBoundingClientRect();
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const el of document.querySelectorAll(
      ".react-flow__node, .react-flow__edge path, .react-flow__edgelabel-renderer > *",
    )) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    }
    return {
      pane: { x: pane.left, y: pane.top, w: pane.width, h: pane.height },
      box: { x0, y0, x1, y1 },
    };
  });
}
async function fitContent(page) {
  for (let i = 0; i < 30; i++) {
    const { pane, box } = await bounds(page);
    const margin = 90; // keep clear of the floating toolbar
    const fits = box.x1 - box.x0 <= pane.w - 40 && box.y1 - box.y0 <= pane.h - margin - 20;
    const cx = pane.x + pane.w / 2,
      cy = pane.y + pane.h / 2;
    if (fits) {
      // centre the content below the toolbar using a middle-button drag
      const dx = pane.x + pane.w / 2 - (box.x0 + box.x1) / 2;
      const dy = pane.y + margin + (pane.h - margin) / 2 - (box.y0 + box.y1) / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
      await page.mouse.up({ button: "middle" });
      await page.waitForTimeout(400);
      return;
    }
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(250);
  }
}
async function shot(page, file) {
  await page.waitForTimeout(800);
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${file}` });
  log.shots.push(file);
}

for (const size of sizes) {
  for (const project of projects) {
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await context.newPage();
    await page.route("**/*", (route) => {
      const m = route.request().method();
      if (!["GET", "HEAD", "OPTIONS"].includes(m)) {
        log.blocked.push(`${m} ${route.request().url()}`);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto("http://127.0.0.1:4300/");
    await page.waitForTimeout(3000);
    const current = await page
      .getByRole("button", { name: /^Project:/ })
      .getAttribute("aria-label");
    if (!current.includes(project.name)) {
      await page.getByRole("button", { name: /^Project:/ }).click();
      await page.getByRole("menuitem", { name: project.name, exact: true }).click();
      await page.waitForTimeout(3000);
    }
    const tag = `${project.slug}-${size.w}x${size.h}`;
    for (const level of ["C1", "C2"]) {
      await page.getByRole("button", { name: level, exact: true }).click();
      await page.waitForTimeout(2000);
      await shot(page, `${tag}-${level}-opened.png`);
      await fitContent(page);
      await shot(page, `${tag}-${level}-fit.png`);
    }
    // C2 is now fitted; find services that open a C3 detail scope
    const ids = await page
      .locator(".react-flow__node")
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("data-id")).filter((id) => id.startsWith("studio:element:")),
      );
    const expandable = [];
    for (const id of ids) {
      await page.locator(`.react-flow__node[data-id="${id}"]`).click({ force: true });
      await page.waitForTimeout(300);
      const c3 = page.locator('nav[aria-label="Architecture depth"] button[title^="Open "]');
      if (!(await c3.count())) continue;
      const title = await c3.getAttribute("title");
      const text = await page.locator(`.react-flow__node[data-id="${id}"]`).textContent();
      if (text.includes(title.slice(5)) && !expandable.some((e) => e.title === title))
        expandable.push({ id, title });
    }
    log.scopes[tag] = expandable;
    for (const { id, title } of expandable) {
      await page.getByRole("button", { name: "C2", exact: true }).click();
      await page.waitForTimeout(1200);
      await page.locator(`.react-flow__node[data-id="${id}"]`).click({ force: true });
      await page.waitForTimeout(300);
      await page.locator(`nav[aria-label="Architecture depth"] button[title="${title}"]`).click();
      await page.waitForTimeout(2000);
      const crumb = await page
        .locator('nav[aria-label="Detail breadcrumb"] [aria-current="page"]')
        .textContent();
      if (!crumb.includes(title.slice(5).slice(0, 12)))
        log.mismatch = [...(log.mismatch ?? []), `${tag} ${id} ${crumb}`];
      const short = id.replace("studio:element:", "");
      await shot(page, `${tag}-C3-${short}-opened.png`);
      await fitContent(page);
      await shot(page, `${tag}-C3-${short}-fit.png`);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync("capture-log.json", JSON.stringify(log, null, 2));
console.log(
  JSON.stringify(log.scopes, null, 1),
  "blocked:",
  log.blocked.length,
  "shots:",
  log.shots.length,
);

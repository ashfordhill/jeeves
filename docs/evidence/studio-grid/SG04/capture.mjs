// SG04 one-off browser inspection. Owner projects are never written: every non-GET request that
// names an existing project is aborted. Only the disposable projects created here are written and
// then deleted.
import { writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG04";
const OUT = `${DIR}/screenshots`;
const API = "http://127.0.0.1:4310";
const owners = (await (await fetch(`${API}/projects`)).json()).projects.map((p) => p.id);
const log = { owners, blocked: [], created: [], deleted: {}, shots: [], observations: {} };
const browser = await chromium.launch();
const shot = async (page, file) => {
  await page.waitForTimeout(800);
  for (const b of await page.getByRole("button", { name: "Dismiss notice" }).all())
    await b.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/${file}` });
  log.shots.push(file);
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
    const page = await context.newPage();
    await page.route("**/*", (route) => {
      const req = route.request();
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method()) &&
        owners.some((id) => req.url().includes(id))
      ) {
        log.blocked.push(`${req.method()} ${req.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto("http://127.0.0.1:4300/");
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^Project:/ }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await page.waitForTimeout(800);
    const select = page.getByLabel("Study", { exact: true });
    obs.studyOptions = await select.locator("option").allTextContents();
    obs.selected = await select.inputValue();
    obs.projectName = await page.getByLabel("Project name").inputValue();
    await shot(page, `${tag}-chooser.png`);
    await page.getByLabel("Project name").fill(`SG04 disposable TinyURL ${tag}`);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForTimeout(4000);
    for (const level of ["C1", "C2"]) {
      await page.getByRole("button", { name: level, exact: true }).click();
      await page.waitForTimeout(2000);
      obs[level] = await page
        .locator(".react-flow__node")
        .evaluateAll((els) =>
          els.map((e) => `${e.getAttribute("data-id")} | ${e.textContent.slice(0, 60)}`),
        );
      obs[`${level}edges`] = await page.locator(".react-flow__edge").count();
      await shot(page, `${tag}-${level}.png`);
    }
    // Library Examples: TinyURL is the only study.
    const lib = page.getByRole("button", { name: /library/i }).first();
    if (await lib.count()) {
      await lib.click();
      await page.waitForTimeout(800);
      const ex = page
        .getByRole("tab", { name: "Examples" })
        .or(page.getByRole("button", { name: "Examples", exact: true }));
      if (await ex.count()) {
        await ex.first().click();
        await page.waitForTimeout(600);
        obs.libraryExamples = await page
          .locator(".studio-library button strong")
          .allTextContents()
          .catch(() => []);
        await shot(page, `${tag}-library-examples.png`);
      } else obs.libraryExamples = "no Examples tab found";
    } else obs.libraryExamples = "no Library button found";
    await context.close();
  }
} finally {
  await browser.close();
  // Delete exactly the disposable projects this run created (by name, never an owner id).
  const after = (await (await fetch(`${API}/projects`)).json()).projects;
  log.created = after
    .filter((p) => !owners.includes(p.id) && p.name.startsWith("SG04 disposable TinyURL"))
    .map((p) => p.id);
  for (const id of log.created) {
    log.deleted[id] = (await fetch(`${API}/projects/${id}`, { method: "DELETE" })).status;
  }
  writeFileSync(`${DIR}/capture-log.json`, `${JSON.stringify(log, null, 2)}\n`);
  console.log(JSON.stringify(log, null, 2));
}

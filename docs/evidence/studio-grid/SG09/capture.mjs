// SG09 one-off browser inspection: component and performance inspector forms.
// Real mouse clicks select boxes, tabs, selects and buttons; values are typed into inputs.
// Owner projects are never written: every non-GET request naming an existing project is aborted.
// Only the disposable projects created here are written, and they are deleted at the end.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const DIR = "/home/ash/github/jeeves/docs/evidence/studio-grid/SG09";
const OUT = `${DIR}/screenshots`;
mkdirSync(OUT, { recursive: true });
const API = "http://127.0.0.1:4310";
const WEB = process.env.SG09_WEB ?? "http://127.0.0.1:4302";
const SIZES = (process.env.SG09_SIZES ?? "1440x900,1280x800").split(",");
const before = (await (await fetch(`${API}/projects`)).json()).projects;
const owners = before.map((p) => p.id);
const log = {
  owners: owners.length,
  blocked: [],
  writes: 0,
  created: [],
  deleted: {},
  shots: [],
  errors: [],
  obs: {},
};
const browser = await chromium.launch();
const wait = (page, ms = 700) => page.waitForTimeout(ms);
const shot = async (page, file, full) => {
  await wait(page, 400);
  await page.screenshot({ path: `${OUT}/${file}`, ...(full && { clip: full }) });
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
    .last();
const inspector = (page) => page.locator(".studio-inspector");
const select = async (page, name) => {
  const box = node(page, name);
  const b = await box.boundingBox();
  if (!b) throw new Error(`No box ${name}`);
  // Frames: click their header strip; cards: their centre.
  const frame = (await box.getAttribute("class"))?.includes("frame");
  await page.mouse.click(b.x + (frame ? 24 : b.width / 2), b.y + (frame ? 12 : b.height / 2));
  await wait(page, 500);
  const heading = await inspector(page)
    .locator("h2")
    .first()
    .textContent()
    .catch(() => null);
  if (heading !== name) throw new Error(`Selected ${heading}, wanted ${name}`);
};
const openTab = async (page, name) => {
  const t = inspector(page).getByRole("tab", { name, exact: true });
  if (await t.count()) await t.click();
  await wait(page, 200);
};
const field = (page, label) => inspector(page).getByLabel(label, { exact: true });
const typeInto = async (page, label, value) => {
  const input = field(page, label);
  await input.click();
  await input.fill(String(value));
  await wait(page, 900); // 500 ms debounce, then the save
};
const choose = async (page, label, value) => {
  await field(page, label).selectOption(value);
  await wait(page, 900);
};
const settle = async (page) => {
  await page
    .waitForFunction(() => !document.querySelector(".studio-draft-feedback [role=status]"), null, {
      timeout: 8000,
    })
    .catch(() => {});
  await wait(page, 600);
};
const design = async (id) => (await (await fetch(`${API}/projects/${id}/design`)).json()).design;
const comp = (d, name) => d.architecture.studio.components.find((c) => c.name === name);
const bind = (d, name) => {
  const el = d.elements.find((e) => e.name === name);
  return d.architecture.studio.elements.find((b) => b.element === el?.id)?.settings;
};
const inspectorShot = async (page, file) => {
  const b = await inspector(page).boundingBox();
  await shot(page, file, b ?? undefined);
};
const guard = async (context) => {
  const page = await context.newPage();
  page.on("pageerror", (e) => log.errors.push(String(e)));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      if (owners.some((id) => req.url().includes(id))) {
        log.blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
        return route.abort();
      }
      log.writes++;
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
const pull = async (page, name, side, dx, dy) => {
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
  // dx = dy = 0: a plain click on the handle opens the picker beside it.
  if (dx || dy) await page.mouse.move(sx + dx, sy + dy, { steps: 12 });
  await page.mouse.up();
  await wait(page, 500);
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

try {
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number);
    const obs = {};
    log.obs[size] = obs;
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await guard(context);
    const id = await newProject(page, `SG09 disposable TinyURL ${size}`);

    // ---- C2: service, worker and resource performance settings ----
    await tab(page, "C2");
    await select(page, "Shorten API");
    await openTab(page, "Options");
    await inspectorShot(page, `${size}-service-options-before.png`);
    await typeInto(page, "Minimum replicas", 2);
    await typeInto(page, "Maximum replicas", 10);
    await choose(page, "Autoscale on", "requests-per-second");
    await typeInto(page, "Request timeout", 3000);
    await typeInto(page, "Concurrency limit", 500);
    await settle(page);
    // Invalid cross-field value: maximum below minimum stays local and correctable.
    await typeInto(page, "Maximum replicas", 1);
    obs.invalidReplicas = {
      error: await inspector(page).locator(".studio-field-error").allTextContents(),
      saved: bind(await design(id), "Shorten API").maxReplicas,
    };
    await inspectorShot(page, `${size}-service-options-invalid.png`);
    await typeInto(page, "Maximum replicas", 12);
    await settle(page);
    await inspectorShot(page, `${size}-service-options.png`);
    const svc = bind(await design(id), "Shorten API");
    obs.service = {
      min: svc.minReplicas,
      max: svc.maxReplicas,
      autoscaleOn: svc.autoscaleOn,
      timeout: svc.requestTimeoutMs,
      concurrency: svc.concurrencyLimit,
    };

    await select(page, "Analytics worker");
    await openTab(page, "Options");
    await typeInto(page, "Maximum replicas", 6);
    await settle(page);
    await inspectorShot(page, `${size}-worker-options.png`);
    obs.worker = { max: bind(await design(id), "Analytics worker").maxReplicas };

    await select(page, "Links database");
    await openTab(page, "Options");
    await typeInto(page, "Read replicas", 3);
    await typeInto(page, "Partition key", "bad key");
    obs.invalidPartition = await inspector(page).locator(".studio-field-error").allTextContents();
    await typeInto(page, "Partition key", "link_code");
    await settle(page);
    await inspectorShot(page, `${size}-database-options.png`);
    const db = bind(await design(id), "Links database");
    obs.database = { readReplicas: db.readReplicas, partitionKey: db.partitionKey };

    await select(page, "Link cache");
    await openTab(page, "Options");
    await choose(page, "Topology", "standalone");
    await choose(page, "Eviction", "lfu");
    await settle(page);
    await inspectorShot(page, `${size}-cache-options.png`);
    const cache = bind(await design(id), "Link cache");
    obs.cache = { topology: cache.topology, eviction: cache.eviction };

    await select(page, "CDN");
    await openTab(page, "Options");
    await choose(page, "Cache redirects", "");
    await settle(page);
    obs.cdnCleared = bind(await design(id), "CDN").cacheRedirects ?? "absent";
    await choose(page, "Cache redirects", "enabled");
    await settle(page);
    await inspectorShot(page, `${size}-cdn-options.png`);
    obs.cdn = bind(await design(id), "CDN").cacheRedirects;

    // Gateway: spawn one from Web app's east handle, then edit a gateway performance setting.
    await pull(page, "Web app", "out", 0, 0);
    obs.gatewayPicker = (await pick(page, "Gateway")).length;
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await wait(page);
    await select(page, "Gateway");
    await openTab(page, "Options");
    await choose(page, "Gateway product", "envoy");
    await typeInto(page, "Minimum replicas", 2);
    await typeInto(page, "Maximum replicas", 4);
    await settle(page);
    await inspectorShot(page, `${size}-gateway-options.png`);
    const gw = bind(await design(id), "Gateway");
    obs.gateway = { provider: gw.provider, min: gw.minReplicas, max: gw.maxReplicas };

    // ---- C3: queue partitions and every component kind ----
    await tab(page, "C3");
    await shot(page, `${size}-C3-before.png`);
    await select(page, "Click events");
    await openTab(page, "Options");
    await typeInto(page, "Partitions or shards", 24);
    await settle(page);
    await inspectorShot(page, `${size}-queue-options.png`);
    obs.queue = bind(await design(id), "Click events").partitions;

    const edits = [
      [
        "Rate limiter",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Limit per window", 120);
          await typeInto(page, "Window", 60);
        },
      ],
      [
        "Reputation check",
        async () => {
          await openTab(page, "Options");
          await choose(page, "Circuit breaker", "disabled");
        },
      ],
      [
        "ID generator",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Minimum length", 99);
          obs.invalidMinLength = {
            error: await inspector(page).locator(".studio-field-error").allTextContents(),
            saved: comp(await design(id), "ID generator").settings.minLength ?? "absent",
          };
          await inspectorShot(page, `${size}-component-id-generator-invalid.png`);
          await typeInto(page, "Minimum length", 7);
          await typeInto(page, "Block size", 500);
        },
      ],
      [
        "Link writer",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Pool size", 20);
        },
      ],
      [
        "Link cache reader",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Shared cache TTL", 3600);
        },
      ],
      [
        "Redirect responder",
        async () => {
          await openTab(page, "Options");
          await choose(page, "Status", "307");
          await typeInto(page, "Edge max-age", 120);
        },
      ],
      [
        "Click publisher",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Linger", 50);
        },
      ],
      [
        "Click consumer",
        async () => {
          await openTab(page, "Options");
          await typeInto(page, "Retry limit", 5);
        },
      ],
      [
        "Click aggregation",
        async () => {
          await typeInto(page, "Purpose", "");
          await settle(page);
          obs.customGap = await inspector(page).locator(".studio-readiness li").allTextContents();
          await inspectorShot(page, `${size}-component-custom-gap.png`);
          await typeInto(page, "Purpose", "Rolls clicks up per link and hour.");
        },
      ],
    ];
    for (const [name, edit] of edits) {
      await select(page, name);
      await edit();
      await settle(page);
      const slug = name.toLowerCase().replaceAll(" ", "-");
      await inspectorShot(page, `${size}-component-${slug}.png`);
    }
    // External call: the traced connection's timeout/retry on the Connections tab.
    await select(page, "Reputation check");
    await openTab(page, "Connections");
    obs.externalLinks = await inspector(page).locator(".studio-dependency-row").allTextContents();
    await inspectorShot(page, `${size}-component-reputation-connections.png`);
    const d1 = await design(id);
    obs.components = Object.fromEntries(
      d1.architecture.studio.components.map((c) => [
        c.name,
        { ...c.settings, ...(c.settings.kind === "custom" && { purpose: c.description }) },
      ]),
    );

    // Undo/redo of one component edit.
    await select(page, "Link writer");
    await openTab(page, "Options");
    await typeInto(page, "Pool size", 32);
    await settle(page);
    const undoBefore = comp(await design(id), "Link writer").settings.poolSize;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await wait(page, 1200);
    const undone = comp(await design(id), "Link writer").settings.poolSize;
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await wait(page, 1200);
    obs.undoRedo = {
      before: undoBefore,
      undone,
      redone: comp(await design(id), "Link writer").settings.poolSize,
    };

    // First component on Web app (a card at C3) through its `+` handle.
    await pull(page, "Web app", "out", 0, 0);
    obs.webPicker = await page.locator(".studio-picker .studio-kind-group").allTextContents();
    await shot(page, `${size}-web-app-picker.png`);
    await pick(page, "Auth guard");
    obs.webFrame = await page
      .locator(".react-flow__node")
      .filter({ has: page.locator('strong:text-is("Web app")') })
      .first()
      .getAttribute("class");
    await inspectorShot(page, `${size}-component-auth-guard.png`);
    await openTab(page, "Options");
    await choose(page, "Credential", "session");
    await settle(page);
    await shot(page, `${size}-C3-web-app-frame.png`);
    const guardDesign = comp(await design(id), "Auth guard");
    obs.authGuard = {
      host: (await design(id)).elements.find((e) => e.id === guardDesign?.host)?.name,
      credential: guardDesign?.settings.credential,
    };

    // Reload: values survive.
    await page.reload();
    await ready(page);
    await wait(page, 1500);
    await tab(page, "C3");
    await select(page, "Rate limiter");
    await openTab(page, "Options");
    obs.reloadRateLimit = await field(page, "Limit per window").inputValue();
    await select(page, "Auth guard");
    await openTab(page, "Options");
    obs.reloadCredential = await field(page, "Credential").inputValue();

    // Blueprint reflects the edits.
    const bp = await (await fetch(`${API}/projects/${id}/blueprint`)).json();
    const bpService = bp.services.find((s) => s.name === "Shorten API");
    obs.blueprint = {
      shortenSettings: {
        minReplicas: bpService?.settings.minReplicas,
        maxReplicas: bpService?.settings.maxReplicas,
        requestTimeoutMs: bpService?.settings.requestTimeoutMs,
      },
      rateLimiter: bpService?.components.find((c) => c.name === "Rate limiter")?.settings,
      webComponents: bp.services
        .find((s) => s.name === "Web app")
        ?.components.map((c) => `${c.name}:${c.settings.credential}`),
      database: bp.resources.find((r) => r.name === "Links database")?.settings,
    };

    // Remove a component from the inspector.
    await openTab(page, "General");
    await inspector(page).getByRole("button", { name: "Remove component" }).click();
    await wait(page, 1500);
    await ready(page);
    obs.removed = {
      stored: !!comp(await design(id), "Auth guard"),
      boxes: await node(page, "Auth guard").count(),
    };
    await shot(page, `${size}-C3-after-remove.png`);
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
  log.ownerUnchanged = before.every(
    (p) => after.find((x) => x.id === p.id)?.updatedAt === p.updatedAt,
  );
  await browser.close();
  writeFileSync(`${DIR}/capture-log.json`, `${JSON.stringify(log, null, 2)}\n`);
}

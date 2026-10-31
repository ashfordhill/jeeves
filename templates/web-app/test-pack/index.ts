import { join } from "node:path";
import type { TestPack, TestPackContext } from "@jeeves/template-kit";
import { contractPath, restClientTargets } from "@jeeves/template-kit";
import { assertNoPageProblems, type PageProblems, withPage } from "@jeeves/template-kit/browser";
import { sampleCallFor } from "@jeeves/template-rest-api-client/test-pack";
import { apiPath } from "../generate.ts";

/** What the runtime exposes on `window.__JEEVES__` (`@jeeves/web-runtime`). */
interface JeevesGlobal {
  app: string;
  config: { title: string; apis: Record<string, { url: string }> };
}

/**
 * Checks for one web-app element in a running project (PLAN §8 test pack), in headless Chromium
 * against the app's container.
 */
export const testPack: TestPack = {
  template: "web-app",
  checks: [
    {
      id: "page-loads",
      title: "the page loads and renders without console errors",
      async run(ctx) {
        const url = await appUrl(ctx);
        await withPage(async (page, problems) => {
          const finish = expectInitialSessionProbes(ctx, url, problems);
          await page.goto(`${url}/`, { waitUntil: "networkidle" });
          finish();
          const rendered = await page.locator("#root > *").count();
          if (rendered === 0) throw new Error("Nothing was rendered into #root");
          assertNoPageProblems(problems, "The app's page");
        });
      },
    },
    {
      id: "client-routes",
      title: "any other path serves the app, for client-side routing",
      async run(ctx) {
        const response = await fetch(`${await appUrl(ctx)}/some/client/route`);
        const text = await response.text();
        if (response.status !== 200 || !text.includes('id="root"')) {
          throw new Error(`/some/client/route returned ${response.status}, not the app`);
        }
      },
    },
    {
      id: "runtime-config",
      title: "the runtime config comes from the container's environment and is applied",
      async run(ctx) {
        const url = await appUrl(ctx);
        const expected = {
          title: String(ctx.subject.config.title),
          apis: Object.fromEntries(
            restClientTargets(ctx.subject).map((t) => [t.target.id, { url: apiPath(t.target.id) }]),
          ),
        };
        const served = await (await fetch(`${url}/jeeves-config.json`)).json();
        if (JSON.stringify(served) !== JSON.stringify(expected)) {
          throw new Error(
            `/jeeves-config.json is ${JSON.stringify(served)}; expected ${JSON.stringify(expected)}`,
          );
        }
        await withPage(async (page, problems) => {
          const finish = expectInitialSessionProbes(ctx, url, problems);
          await page.goto(`${url}/`, { waitUntil: "networkidle" });
          finish();
          await page.waitForFunction(() => "__JEEVES__" in globalThis, undefined, {
            timeout: 15_000,
          });
          const global = await page.evaluate(
            () => (globalThis as unknown as { __JEEVES__: JeevesGlobal }).__JEEVES__,
          );
          if (JSON.stringify(global.config) !== JSON.stringify(expected)) {
            throw new Error(`The page loaded the config ${JSON.stringify(global.config)}`);
          }
          const title = await page.title();
          if (title !== expected.title) {
            throw new Error(`The page title is "${title}", not "${expected.title}"`);
          }
          assertNoPageProblems(problems, "The runtime-config page");
        });
      },
    },
    {
      id: "sample-call",
      title: "with a connected service, a sample call renders its result",
      async run(ctx) {
        const targets = restClientTargets(ctx.subject);
        if (targets.length === 0) {
          ctx.log("the app calls no APIs");
          return;
        }
        const url = await appUrl(ctx);
        for (const { target } of targets) {
          const sample = sampleCallFor(join(ctx.projectDir, contractPath(target.id)));
          if (!sample) {
            ctx.log(`${target.id}'s contract has no GET operation with examples to call`);
            continue;
          }
          const query = new URLSearchParams(sample.query).toString();
          const path = query ? `${sample.path}?${query}` : sample.path;
          const status = `${url}/_jeeves/status?${new URLSearchParams({ api: target.id, path })}`;
          await withPage(async (page, problems) => {
            await page.goto(status);
            const result = page.locator(`[data-jeeves-result="${target.id}"]`);
            await result.waitFor({ timeout: 15_000 });
            const text = (await result.textContent()) ?? "";
            if ((await result.getAttribute("data-jeeves-ok")) !== "true") {
              throw new Error(
                `${sample.operationId} (GET ${path}) through the app failed: ${text}`,
              );
            }
            ctx.log(`${target.id} ${sample.operationId} → ${text.replaceAll(/\s+/g, " ")}`);
            assertNoPageProblems(problems, "The status page");
          });
        }
      },
    },
  ],
};

/** The app's base URL on the host. Looked up each time: a restart can change the port. */
export async function appUrl(ctx: TestPackContext): Promise<string> {
  const id = ctx.subject.element.id;
  const port = Number(ctx.compose.services[id]?.environment?.PORT ?? ctx.subject.config.port);
  const { host, port: published } = await ctx.service(id).endpoint(port);
  return `http://${host}:${published}`;
}

/**
 * A fresh context has no session. Only the generated session operation may return 401 during
 * initial load, at most once per service. Scaffolds need not implement a session probe yet;
 * required auth journeys (e.g. QR-09) assert the probe and UI explicitly instead.
 * The internal sample-call page has no auth gate and gets no exception.
 */
function expectInitialSessionProbes(ctx: TestPackContext, url: string, problems: PageProblems) {
  const probes = restClientTargets(ctx.subject)
    .filter(({ server }) => server.auth === "session" && server.attachment.config.model)
    .map(({ target }) =>
      problems.expectHttp(
        {
          scenario: "initial signed-out page load: readSession",
          method: "GET",
          url: `${url}${apiPath(target.id)}/auth/session`,
          resourceType: "fetch",
          status: 401,
        },
        { ifRequested: true },
      ),
    );
  return () => {
    for (const probe of probes) probe.finish();
  };
}

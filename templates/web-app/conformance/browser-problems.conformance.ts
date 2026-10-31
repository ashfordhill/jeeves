import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createGenerateContext, type TestPackContext } from "@jeeves/template-kit";
import { assertNoPageProblems, withPage } from "@jeeves/template-kit/browser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPack } from "../test-pack/index.ts";
import { lookup, WEB_TITLE, webDesign } from "./fixtures/design.ts";

let mode = "good";
let status = 401;
let url: string;
const config = { title: WEB_TITLE, apis: { links: { url: "/_api/links" } } };
const server = createServer((request, response) => {
  const path = request.url ?? "/";
  if (path === "/slow") return;
  if (path === "/transport") return request.socket.destroy();
  if (path === "/jeeves-config.json") {
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify(config));
  }
  if (path === "/_api/links/auth/session" || path === "/wrong-session") {
    response.writeHead(status, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ error: "signed out" }));
  }
  if (path === "/validate") {
    response.writeHead(400, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ error: "invalid destination" }));
  }
  if (path.startsWith("/unexpected/")) {
    response.writeHead(Number(path.split("/").at(-1)));
    return response.end("unexpected failure");
  }
  if (path === "/missing.js" || path === "/favicon.ico") {
    response.writeHead(404, { "Content-Type": "text/javascript" });
    return response.end("");
  }
  response.setHeader("Content-Type", "text/html");
  response.end(`<!doctype html><html><head><title>Fixture</title>
    <link rel="icon" href="data:,"></head><body><div id="root">Loading</div>
    <button id="validate">Validate</button><output id="validation"></output>
    <script type="module">
      const mode = ${JSON.stringify(mode)};
      const config = ${JSON.stringify(config)};
      window.__JEEVES__ = { app: "web", config };
      document.title = config.title;
      // Ordinary window.fetch: no Worker, interception, or console replacement.
      const session = await fetch(mode === "wrong route" ? "/wrong-session" : "/_api/links/auth/session");
      document.querySelector("#root").innerHTML = session.status === 401 ? "<h1>Signed out</h1>" : "<h1>Unexpected session</h1>";
      document.querySelector("#validate").onclick = async () => {
        const result = await fetch("/validate", { method: "POST", body: "{}" });
        document.querySelector("#validation").textContent = result.status + ": " + (await result.json()).error;
      };
      if (mode.startsWith("unexpected/")) await fetch("/" + mode);
      if (mode === "transport") await fetch("/transport").catch(() => {});
      if (mode === "script") {
        const script = document.createElement("script"); script.src = "/missing.js"; document.body.append(script);
      }
      // Headless Chromium may omit automatic favicon requests. Load it as an explicit image
      // so the regression always exercises a real broken asset with "favicon" in its URL.
      if (mode === "favicon") {
        const icon = document.createElement("img"); icon.src = "/favicon.ico"; document.body.append(icon);
      }
      if (mode === "exception") throw new Error("fixture uncaught exception");
      if (mode === "rejection") Promise.reject(new Error("fixture unhandled rejection"));
      if (mode === "console") console.error("fixture application error");
      if (mode === "imitated console") console.error("Failed to load resource: the server responded with a status of 401 (Unauthorized)");
    </script></body></html>`);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const sessionExpectation = () => ({
  scenario: "fresh signed-out fixture",
  method: "GET",
  url: `${url}/_api/links/auth/session`,
  resourceType: "fetch" as const,
  status: 401,
});

describe("Chromium network and console classification with normal fetch", () => {
  it("accepts a signed-out page and an explicitly exercised validation error without a Worker", async () => {
    mode = "good";
    status = 401;
    await withPage(async (page, problems) => {
      const workers: string[] = [];
      const nativeErrors: string[] = [];
      page.on("worker", (worker) => workers.push(worker.url()));
      page.on("console", (message) => {
        if (message.type() === "error" && message.args().length === 0)
          nativeErrors.push(message.text());
      });
      const signedOut = problems.expectHttp(sessionExpectation());
      await page.goto(url, { waitUntil: "networkidle" });
      expect(await page.locator("#root").textContent()).toBe("Signed out");
      signedOut.finish();
      const validation = problems.expectHttp({
        scenario: "invalid destination submission",
        method: "POST",
        url: `${url}/validate`,
        resourceType: "fetch",
        status: 400,
      });
      await page.locator("#validate").click();
      await page.waitForFunction(
        "document.querySelector('#validation').textContent === '400: invalid destination'",
      );
      validation.finish();
      expect(workers).toEqual([]);
      expect(nativeErrors.some((text) => text.includes("status of 401"))).toBe(true);
      expect(nativeErrors.some((text) => text.includes("status of 400"))).toBe(true);
      assertNoPageProblems(problems, "normal fetch");
    });
  });

  it.each([
    ["wrong route", "GET", 401],
    ["good", "→ 403", 403],
    ["unexpected/401", "/unexpected/401 → 401", 401],
    ["unexpected/403", "/unexpected/403 → 403", 401],
    ["unexpected/404", "/unexpected/404 → 404", 401],
    ["unexpected/500", "/unexpected/500 → 500", 401],
    ["script", "/missing.js → 404", 401],
    ["favicon", "favicon.ico", 401],
    ["transport", "/transport → net::ERR_EMPTY_RESPONSE", 401],
    ["exception", "uncaught: fixture uncaught exception", 401],
    ["rejection", "uncaught: fixture unhandled rejection", 401],
    ["console", "console.error: fixture application error", 401],
    ["imitated console", "console.error: Failed to load resource", 401],
  ])("detects %s for the correct reason", async (scenario, evidence, code) => {
    mode = scenario;
    status = code;
    await withPage(async (page, problems) => {
      problems.expectHttp(sessionExpectation());
      await page.goto(url, { waitUntil: "networkidle" });
      expect(() => assertNoPageProblems(problems, scenario)).toThrow(evidence);
    });
  });

  it("requires a negative response to occur and limits it to one scenario", async () => {
    mode = "good";
    status = 401;
    await withPage(async (page, problems) => {
      const signedOut = problems.expectHttp(sessionExpectation());
      await page.goto(url, { waitUntil: "networkidle" });
      signedOut.finish();
      const missing = problems.expectHttp({ ...sessionExpectation(), scenario: "missing probe" });
      expect(missing.finish).toThrow("started 0, matched 0");
      await page.evaluate("fetch('/_api/links/auth/session')");
      expect(() => assertNoPageProblems(problems, "later session")).toThrow("→ 401");
    });
  });

  it("distinguishes a deliberate AbortController cancellation from an unexpected abort", async () => {
    mode = "good";
    status = 401;
    await withPage(async (page, problems) => {
      const signedOut = problems.expectHttp(sessionExpectation());
      await page.goto(url, { waitUntil: "networkidle" });
      signedOut.finish();
      const abort = problems.expectCancellation({
        scenario: "cancel pending preview",
        method: "GET",
        url: `${url}/slow`,
        resourceType: "fetch",
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = page.waitForRequest(`${url}/slow`);
        await page.evaluate(
          "window.controller = new AbortController(); void fetch('/slow', { signal: controller.signal }).catch(() => {})",
        );
        await started;
        const failed = page.waitForEvent(
          "requestfailed",
          (request) => request.url() === `${url}/slow`,
        );
        await page.evaluate("controller.abort()");
        await failed;
        if (attempt === 0) {
          abort.finish();
          assertNoPageProblems(problems, "deliberate cancellation");
        } else {
          expect(() => assertNoPageProblems(problems, "unexpected cancellation")).toThrow(
            "net::ERR_ABORTED",
          );
        }
      }
    });
  });
});

describe("web-app pack signed-out load policy", () => {
  const context = (): TestPackContext => {
    const design = webDesign();
    const api = design.elements[0]?.attachments[0];
    if (!api) throw new Error("Missing fixture API");
    api.config = {
      basePath: "/api",
      auth: "session",
      model: { resources: [], extensions: [] },
    };
    return {
      projectDir: "/unused",
      subject: createGenerateContext(design, lookup, "web"),
      compose: { services: {} },
      service: () => ({
        name: "web",
        endpoint: async () => ({ host: "127.0.0.1", port: (server.address() as AddressInfo).port }),
        exec: async () => {
          throw new Error("unused");
        },
        restart: async () => {
          throw new Error("unused");
        },
        start: async () => {
          throw new Error("unused");
        },
        stop: async () => {
          throw new Error("unused");
        },
        run: async () => {
          throw new Error("unused");
        },
      }),
      log: () => {},
    };
  };
  const check = (id: string) => {
    const found = testPack.checks.find((item) => item.id === id);
    if (!found) throw new Error(`Missing check ${id}`);
    return found;
  };
  it.each(["page-loads", "runtime-config"])(
    "%s accepts the normal-fetch session gate",
    async (id) => {
      mode = "good";
      status = 401;
      await check(id).run(context());
    },
  );
  it("does not allow another protected request's 401 during page load", async () => {
    mode = "unexpected/401";
    status = 401;
    await expect(check("page-loads").run(context())).rejects.toThrow("/unexpected/401 → 401");
  });
});

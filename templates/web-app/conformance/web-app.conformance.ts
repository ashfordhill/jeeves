import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpServiceTemplate } from "@jeeves/template-http-service/template";
import { createGenerateContext, type TestPack, type TestPackContext } from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
import {
  buildProject,
  type StartedProject,
  startProject,
  vendorRuntimes,
} from "@jeeves/template-kit/harness";
import { restApiClientTemplate } from "@jeeves/template-rest-api-client/template";
import { restApiServerTemplate } from "@jeeves/template-rest-api-server/template";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { envRef } from "../generate.ts";
import { webAppTemplate } from "../template.ts";
import { lookup, WEB_TITLE, webDesign } from "./fixtures/design.ts";

const modules = [httpServiceTemplate, restApiServerTemplate, restApiClientTemplate, webAppTemplate];
const design = webDesign();
const dir = mkdtempSync(join(tmpdir(), "jeeves-web-app-"));
let project: StartedProject;

beforeAll(async () => {
  // A page as an agent would have written it; scaffolding leaves it alone.
  cpSync(new URL("./fixtures/web-app", import.meta.url), join(dir, "frontends/web"), {
    recursive: true,
  });
  vendorRuntimes(dir, modules);
  buildProject({ dir, design, lookup, modules });
  for (const app of ["frontends/web", "frontends/docs"])
    npm(app, "install", "--no-audit", "--no-fund");
  project = await startProject(dir, { projectName: `jeeves-web-app-${process.pid}` });
});

afterAll(async () => {
  await project?.down({ volumes: true, images: true });
  rmSync(dir, { recursive: true, force: true });
});

function npm(elementDir: string, ...args: string[]): string {
  return execFileSync("npm", args, { cwd: join(dir, elementDir), stdio: "pipe", encoding: "utf8" });
}

function packContext(element: string, attachment?: string): TestPackContext {
  return {
    projectDir: dir,
    subject: createGenerateContext(design, lookup, element, attachment),
    compose: project.compose,
    service: (name) => project.service(name),
    log: () => {},
  };
}

const runPack = (pack: TestPack, element: string, attachment?: string) => {
  for (const check of pack.checks) {
    it(check.title, () => check.run(packContext(element, attachment)));
  }
};

async function webUrl(): Promise<string> {
  const { host, port } = await project.service("web").endpoint(5173);
  return `http://${host}:${port}`;
}

describe("conformance: a web-app calling a service through a generated client", () => {
  it("generates the wiring, the proxy, the runtime config template, and the compose service", () => {
    const read = (path: string) => readFileSync(join(dir, path), "utf8");
    expect(read("frontends/web/src/jeeves.generated.ts")).toContain('"links": linksClient,');
    const nginx = read("frontends/web/nginx/default.conf.template");
    expect(nginx).toContain("location /_api/links/ {");
    expect(nginx).toContain(`proxy_set_header Authorization "Bearer \${API_LINKS_TOKEN}";`);
    expect(JSON.parse(read("frontends/web/nginx/jeeves-config.json.template"))).toEqual({
      title: envRef("APP_TITLE"),
      apis: { links: { url: "/_api/links" } },
    });
    const pkg = JSON.parse(read("frontends/web/package.json"));
    expect(Object.keys(pkg.dependencies)).toEqual([
      "@jeeves/rest-client",
      "@jeeves/web-runtime",
      "react",
      "react-dom",
    ]);
    expect(project.compose.services.web).toMatchObject({
      environment: {
        PORT: "5173",
        APP_TITLE: 'Links & "Co" $$5 <beta>',
        API_LINKS_URL: "http://links:8080",
        API_LINKS_TOKEN: "links-local-token",
      },
      depends_on: { links: { condition: "service_healthy" } },
    });
  });

  it("the page shows data from the service, fetched through the generated client", async () => {
    const url = await webUrl();
    await withPage(async (page) => {
      await page.goto(`${url}/`);
      await expect(page.getByTestId("ping").textContent({ timeout: 15_000 })).resolves.toBe(
        "from-the-browser",
      );
      expect(await page.title()).toBe(WEB_TITLE);
    });
  });

  it("the proxy finds the service again after it restarts", async () => {
    await project.service("links").restart();
    const url = `${await webUrl()}/_api/links/v1/ping?message=again`;
    let last = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(url).catch((error: Error) => error);
      if (!(response instanceof Error) && response.ok) {
        expect(await response.json()).toEqual({ message: "again" });
        return;
      }
      last = response instanceof Error ? response.message : String(response.status);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`The proxy didn't recover: ${last}`);
  });

  describe("web-app test pack for web", () => {
    runPack(webAppTemplate.testPack, "web");
  });

  describe("rest-api-client test pack for web's client", () => {
    runPack(restApiClientTemplate.testPack, "web", "web-links");
  });

  describe("web-app test pack for docs (no APIs)", () => {
    runPack(webAppTemplate.testPack, "docs");
  });

  it("both apps type-check, the client against the service's contract", () => {
    npm("frontends/web", "run", "typecheck");
    npm("frontends/docs", "run", "typecheck");
  });
});

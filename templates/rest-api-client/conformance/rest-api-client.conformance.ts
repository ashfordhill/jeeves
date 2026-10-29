import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpServiceTemplate } from "@jeeves/template-http-service/template";
import { createGenerateContext, type TestPack, type TestPackContext } from "@jeeves/template-kit";
import {
  buildProject,
  type StartedProject,
  startProject,
  vendorRuntimes,
} from "@jeeves/template-kit/harness";
import { restApiServerTemplate } from "@jeeves/template-rest-api-server/template";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restApiClientTemplate } from "../template.ts";
import { clientDesign, lookup } from "./fixtures/design.ts";

const modules = [httpServiceTemplate, restApiServerTemplate, restApiClientTemplate];
const design = clientDesign({ timeoutMs: 1000, retries: 1 });
const dir = mkdtempSync(join(tmpdir(), "jeeves-rest-api-client-"));
const fixtures = new URL("./fixtures/", import.meta.url);
const contract = join(dir, "contracts/links.openapi.yaml");
let project: StartedProject;

beforeAll(async () => {
  // Project-owned files as an agent would have written them; scaffolding leaves them alone.
  mkdirSync(join(dir, "contracts"), { recursive: true });
  cpSync(new URL("links.openapi.yaml", fixtures), contract);
  cpSync(new URL("links-service", fixtures), join(dir, "services/links"), { recursive: true });
  cpSync(new URL("stats-service", fixtures), join(dir, "services/stats"), { recursive: true });
  vendorRuntimes(dir, modules);
  buildProject({ dir, design, lookup, modules });
  // The `types` check runs `npm run typecheck` on the host, as Jeeves does after installing.
  npm("services/stats", "install", "--no-audit", "--no-fund");
  project = await startProject(dir, { projectName: `jeeves-rest-api-client-${process.pid}` });
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

describe("conformance: an http-service calling another through a rest-api-client", () => {
  it("generates the client, its runtime, the types script, and the compose wiring", () => {
    const client = readFileSync(join(dir, "services/stats/src/clients/links.generated.ts"), "utf8");
    expect(client).toContain("export const linksClient = serviceRestClient<paths>({");
    const pkg = JSON.parse(readFileSync(join(dir, "services/stats/package.json"), "utf8"));
    expect(pkg.dependencies["@jeeves/rest-client"]).toBe(
      "file:../../vendor/jeeves/jeeves-rest-client-0.1.0.tgz",
    );
    expect(pkg.scripts.pretypecheck).toBe("jeeves-rest-client-types");
    const wiring = readFileSync(join(dir, "services/stats/src/jeeves.generated.ts"), "utf8");
    expect(wiring).toContain("linksClient.plugin,");
    expect(project.compose.services.stats).toMatchObject({
      environment: { API_LINKS_URL: "http://links:8080", API_LINKS_TOKEN: "links-local-token" },
      depends_on: { links: { condition: "service_healthy" } },
    });
  });

  it("forwards the request ID and the bearer token on calls a request makes", async () => {
    const { host, port } = await project.service("stats").endpoint(8081);
    const response = await fetch(`http://${host}:${port}/relay`, {
      headers: { "x-request-id": "conformance-1" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ seenByLinks: "conformance-1" });
  });

  describe("rest-api-client test pack", () => {
    runPack(restApiClientTemplate.testPack, "stats", "stats-links");
  });

  describe("http-service test pack for the calling service", () => {
    runPack(httpServiceTemplate.testPack, "stats");
  });

  it("the generated types follow the contract: a removed operation becomes a type error", () => {
    const original = readFileSync(contract, "utf8");
    writeFileSync(contract, original.replace("/request-id:", "/request-ids:"));
    try {
      let output = "";
      try {
        npm("services/stats", "run", "typecheck");
      } catch (error) {
        output = String((error as { stdout?: string }).stdout);
      }
      expect(output).toContain("src/features/relay/index.ts");
      expect(output).toContain('"/request-id"');
    } finally {
      writeFileSync(contract, original);
    }
    npm("services/stats", "run", "typecheck");
  });
});

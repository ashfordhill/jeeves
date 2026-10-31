import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restApiServerTemplate } from "../template.ts";
import { lookup, serverDesign } from "./fixtures/design.ts";

const modules = [httpServiceTemplate, restApiServerTemplate];
const design = serverDesign({ basePath: "/v1" });
const dir = mkdtempSync(join(tmpdir(), "jeeves-rest-api-server-"));
let project: StartedProject;

beforeAll(async () => {
  vendorRuntimes(dir, modules);
  buildProject({ dir, design, lookup, modules });
  project = await startProject(dir, { projectName: `jeeves-rest-api-server-${process.pid}` });
});

afterAll(async () => {
  await project?.down({ volumes: true, images: true });
  rmSync(dir, { recursive: true, force: true });
});

function packContext(attachment?: string): TestPackContext {
  return {
    projectDir: dir,
    subject: createGenerateContext(design, lookup, "links", attachment),
    compose: project.compose,
    service: (name) => project.service(name),
    log: () => {},
  };
}

const runPack = (pack: TestPack, attachment?: string) => {
  for (const check of pack.checks) {
    it(check.title, () => check.run(packContext(attachment)));
  }
};

describe("conformance: http-service with a rest-api-server attachment", () => {
  it("scaffolds the contract and wires the server into the service", () => {
    const wiring = readFileSync(join(dir, "services/links/src/jeeves.generated.ts"), "utf8");
    expect(wiring).toContain('contract: path("../../../contracts/links.openapi.yaml"),');
    expect(wiring).toContain('basePath: "/v1",');
    const pkg = JSON.parse(readFileSync(join(dir, "services/links/package.json"), "utf8"));
    expect(pkg.dependencies["@jeeves/rest-server"]).toBe(
      "file:../../vendor/jeeves/jeeves-rest-server-0.2.0.tgz",
    );
  });

  it("the ping operation answers under the base path", async () => {
    const { host, port } = await project.service("links").endpoint(8080);
    const response = await fetch(`http://${host}:${port}/v1/ping?message=hi`);
    expect(await response.json()).toEqual({ message: "hi" });
  });

  describe("rest-api-server test pack", () => {
    runPack(restApiServerTemplate.testPack, "links-api");
  });

  describe("http-service test pack", () => {
    runPack(httpServiceTemplate.testPack);
  });

  it("the service with its API type-checks", () => {
    const cwd = join(dir, "services/links");
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd, stdio: "pipe" });
    execFileSync("npm", ["run", "typecheck"], { cwd, stdio: "pipe" });
  });
});

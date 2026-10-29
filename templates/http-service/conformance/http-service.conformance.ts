import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGenerateContext, type TestPackContext } from "@jeeves/template-kit";
import {
  type BuiltProject,
  buildProject,
  type StartedProject,
  startProject,
  vendorRuntimes,
} from "@jeeves/template-kit/harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { httpServiceTemplate } from "../template.ts";
import { lookup, serviceDesign } from "./fixtures/design.ts";

const dir = mkdtempSync(join(tmpdir(), "jeeves-http-service-"));
const design = serviceDesign();
let built: BuiltProject;
let project: StartedProject;

beforeAll(async () => {
  vendorRuntimes(dir, [httpServiceTemplate]);
  built = buildProject({ dir, design, lookup, modules: [httpServiceTemplate] });
  project = await startProject(dir, { projectName: `jeeves-http-service-${process.pid}` });
});

afterAll(async () => {
  await project?.down({ volumes: true, images: true });
  rmSync(dir, { recursive: true, force: true });
});

function packContext(): TestPackContext {
  return {
    projectDir: dir,
    subject: createGenerateContext(design, lookup, "links"),
    compose: project.compose,
    service: (name) => project.service(name),
    log: () => {},
  };
}

describe("http-service conformance: a service alone", () => {
  it("references the vendored runtime from the service's package.json", () => {
    expect(built.written).toContain("services/links/package.json");
    const pkg = readFileSync(join(dir, "services/links/package.json"), "utf8");
    expect(JSON.parse(pkg).dependencies).toEqual({
      "@jeeves/service-runtime": "file:../../vendor/jeeves/jeeves-service-runtime-0.1.0.tgz",
    });
  });

  describe("test pack", () => {
    for (const check of httpServiceTemplate.testPack.checks) {
      it(check.title, () => check.run(packContext()));
    }
  });

  it("the generated service type-checks against the packed runtime", () => {
    const cwd = join(dir, "services/links");
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd, stdio: "pipe" });
    execFileSync("npm", ["run", "typecheck"], { cwd, stdio: "pipe" });
  });
});

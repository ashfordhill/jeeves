import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptanceCaseCoverageProblems,
  acceptanceCoverageProblems,
  acceptanceFiles,
  acceptancePath,
  type FixedAcceptance,
} from "./acceptance.ts";
import {
  assertExecutedTests,
  assertGeneratedIntegrity,
  fixtureCompose,
} from "./baseline/behavior.ts";
import { runCommand } from "./exec.ts";
import { generateProject } from "./generate.ts";
import { readLock } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const suite: FixedAcceptance = {
  id: "activity",
  service: "links",
  operationIds: ["qrActivity"],
  acceptanceIds: ["ACT-01"],
  source: 'import test from "node:test"; test("fixed activity",()=>{});\n',
};
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-fixed-"));
  dirs.push(dir);
  return dir;
};
const design = fixtureDesign("resources");
const plan = planProject(design, templateSet(), {
  projectName: "Verification",
  fixedAcceptance: [suite],
});

describe("independent fixed acceptance", () => {
  it("does not inherit ambient credentials when executing an independent suite", async () => {
    const previous = process.env.JEEVES_VERIFY_TEST_SECRET;
    process.env.JEEVES_VERIFY_TEST_SECRET = "must-not-reach-fixture";
    try {
      const result = await runCommand(
        process.execPath,
        [
          "-e",
          'console.log(JSON.stringify({hasSecret:Object.hasOwn(process.env,"JEEVES_VERIFY_TEST_SECRET"),url:process.env.JEEVES_TEST_URL}))',
        ],
        { cwd: temp(), inheritEnv: false, env: { JEEVES_TEST_URL: "http://127.0.0.1:1" } },
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.output)).toEqual({ hasSecret: false, url: "http://127.0.0.1:1" });
    } finally {
      if (previous === undefined) delete process.env.JEEVES_VERIFY_TEST_SECRET;
      else process.env.JEEVES_VERIFY_TEST_SECRET = previous;
    }
  });
  it("validates references and reports every uncovered required operation/reference", () => {
    expect(acceptanceCoverageProblems(plan.resourceModels!, [], { links: ["qrActivity"] })).toEqual(
      ["links/qrActivity: uncovered required acceptance ACT-01"],
    );
    expect(
      acceptanceCoverageProblems(plan.resourceModels!, plan.fixedAcceptance!, {
        links: ["qrActivity"],
      }),
    ).toEqual([]);
    expect(() =>
      acceptanceFiles([{ ...suite, operationIds: ["invented"] }], plan.resourceModels!),
    ).toThrow("unknown extension operation invented");
    expect(() => acceptanceFiles([suite, suite], plan.resourceModels!)).toThrow("Duplicate");
  });
  it("hashes fixed suites, preserves them on regeneration, and blocks edited expectations", async () => {
    const dir = temp();
    const options = { dir, design, projectName: "Verification", git: false, vendor: fakeVendor };
    const generated = await generateProject({ ...options, fixedAcceptance: [suite] });
    expect(generated.ok).toBe(true);
    const lock = readLock(dir)!;
    expect(lock.fixedAcceptance).toMatchObject([{ id: "activity", operationIds: ["qrActivity"] }]);
    expect(lock.files[acceptancePath(suite)]).toMatch(/^sha256-/);
    assertGeneratedIntegrity(dir, lock);
    expect((await generateProject(options)).ok).toBe(true);
    expect(readFileSync(join(dir, acceptancePath(suite)), "utf8")).toBe(suite.source);
    writeFileSync(join(dir, acceptancePath(suite)), "// weakened test");
    expect(() => assertGeneratedIntegrity(dir, lock)).toThrow("Protected artifact changed");
    expect(await generateProject(options)).toMatchObject({ ok: false, reason: "ownership" });
  });
  it("rejects symlinked expectations", async () => {
    const dir = temp();
    await generateProject({
      dir,
      design,
      projectName: "Verification",
      git: false,
      vendor: fakeVendor,
      fixedAcceptance: [suite],
    });
    const lock = readLock(dir)!;
    const outside = temp();
    mkdirSync(join(outside, "links"));
    writeFileSync(join(outside, "links/activity.test.ts"), suite.source);
    rmSync(join(dir, "tests/acceptance"), { recursive: true });
    symlinkSync(outside, join(dir, "tests/acceptance"));
    expect(() => assertGeneratedIntegrity(dir, lock)).toThrow("symlink");
  });
  it("uses fresh named volumes, loopback ports and fixture secrets instead of deployment values", () => {
    const fixture = fixtureCompose(plan.compose, {
      ...readableLock(),
      resourceModels: plan.resourceModels,
    });
    expect(fixture.services.links?.environment?.PUBLIC_ORIGIN).toBe("http://127.0.0.1:1");
    expect(fixture.services.links?.environment?.DATABASE_PASSWORD).not.toContain("${");
    expect(fixture.services.links?.ports).toEqual(["127.0.0.1::8080"]);
    expect(fixture.volumes).toEqual({ "links-db-data": {} });
    const bad = structuredClone(plan.compose);
    bad.services.links!.volumes = ["/production:/data"];
    expect(() => fixtureCompose(bad, readableLock())).toThrow("Writable bind");
  });
  it("publishes the fixture web app on its reserved port and makes it the public origin", () => {
    const fixture = fixtureCompose(
      plan.compose,
      {
        ...readableLock(),
        resourceModels: plan.resourceModels,
        elements: [
          { id: "web", template: "web-app@0.1.0", dir: "frontends/web", ownedPaths: [] },
          { id: "links", template: "http-service@0.1.0", dir: "services/links", ownedPaths: [] },
        ],
      },
      { publicOrigin: "http://127.0.0.1:7777", webPorts: { web: 7777 } },
    );
    expect(fixture.services.web?.ports).toEqual(["127.0.0.1:7777:5173"]);
    expect(fixture.services.links?.environment?.PUBLIC_ORIGIN).toBe("http://127.0.0.1:7777");
  });
  it("emits generated-owned support files and exact test dependencies", async () => {
    const dir = temp();
    const withSupport: FixedAcceptance = {
      ...suite,
      files: [{ path: "_support/qr.ts", contents: "export const decoded = true;\n" }],
      dependencies: [{ name: "jsqr", version: "1.4.0" }],
    };
    const options = { dir, design, projectName: "Verification", git: false, vendor: fakeVendor };
    expect((await generateProject({ ...options, fixedAcceptance: [withSupport] })).ok).toBe(true);
    expect(readFileSync(join(dir, "tests/acceptance/links/_support/qr.ts"), "utf8")).toBe(
      "export const decoded = true;\n",
    );
    expect(
      JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).devDependencies,
    ).toMatchObject({ jsqr: "1.4.0" });
    expect(readLock(dir)!.fixedAcceptance?.[0]?.files).toEqual([{ path: "_support/qr.ts" }]);
    expect((await generateProject(options)).ok).toBe(true);
    expect(readFileSync(join(dir, "tests/acceptance/links/_support/qr.ts"), "utf8")).toBe(
      "export const decoded = true;\n",
    );
    expect(readLock(dir)!.fixedAcceptance).toHaveLength(1);
  });
  it("requires every declared acceptance case to have a registered suite", () => {
    expect(acceptanceCaseCoverageProblems(plan.resourceModels!, [])).toEqual([
      "links/ACT-01: no fixed acceptance suite is registered",
    ]);
    expect(acceptanceCaseCoverageProblems(plan.resourceModels!, plan.fixedAcceptance!)).toEqual([]);
  });
  it("rejects empty and skipped independent suites even when their command exited zero", () => {
    expect(() => assertExecutedTests("# tests 0\n# pass 0")).toThrow("nonempty");
    expect(() => assertExecutedTests("# tests 1\n# pass 0\n# skipped 1")).toThrow("nonempty");
    expect(() => assertExecutedTests("# tests 1\n# pass 1\n# skipped 0")).not.toThrow();
  });
});

function readableLock() {
  return {
    lockVersion: 1 as const,
    generator: "0.1.0",
    designRevision: 0,
    templates: [],
    runtimes: [],
    elements: [],
    files: {},
  };
}

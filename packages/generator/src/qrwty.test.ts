import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateDesign } from "@jeeves/spec";
import { afterEach, describe, expect, it } from "vitest";
import { qrwtyAcceptance } from "../../../fixtures/acceptance/qrwty/manifest.ts";
import { acceptanceCaseCoverageProblems } from "./acceptance.ts";
import { generateProject } from "./generate.ts";
import { readLock } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const design = fixtureDesign("qrwty");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-qrwty-"));
  dirs.push(dir);
  return dir;
};

describe("qrwty acceptance enablement", () => {
  it("validates the reviewed fixture with zero findings", () => {
    expect(validateDesign(design, templateSet().lookup)).toEqual([]);
    const model = design.elements[0]!.attachments[0]!.config.model as {
      acceptanceCases: string[];
    };
    expect(model.acceptanceCases).toEqual([
      "QR-01",
      "QR-02",
      "QR-03",
      "QR-04",
      "QR-05",
      "QR-06",
      "QR-07",
      "QR-08",
      "QR-09",
    ]);
  });

  it("plans six suites, the fixed port and exact dependencies", () => {
    const plan = planProject(design, templateSet(), {
      projectName: "qrwty",
      fixedAcceptance: qrwtyAcceptance,
    });
    expect(plan.fixedAcceptance?.map((suite) => suite.id).sort()).toEqual([
      "activity",
      "browser",
      "core",
      "qr-image",
      "redirect",
      "restart",
    ]);
    expect(acceptanceCaseCoverageProblems(plan.resourceModels!, plan.fixedAcceptance!)).toEqual([]);
    expect(plan.compose.services?.["qrwty-web"]?.ports).toEqual(["127.0.0.1:5173:5173"]);
    const servicePackage = plan.packageEdits.find((edit) => edit.element === "qrwty");
    expect(servicePackage?.dependencies).toContainEqual({
      name: "qrcode",
      spec: "1.5.4",
    });
    const testDeps = plan.fixedAcceptance!.flatMap((suite) => suite.dependencies ?? []);
    expect(testDeps).toContainEqual({ name: "@playwright/test", version: "1.63.0" });
    expect(testDeps).toContainEqual({ name: "jsqr", version: "1.4.0" });
    expect(testDeps).toContainEqual({ name: "pngjs", version: "7.0.0" });
  });

  it("writes every suite and preserves them when a later generation omits fixedAcceptance", async () => {
    const dir = temp();
    const generated = await generateProject({
      dir,
      design,
      projectName: "qrwty",
      fixedAcceptance: qrwtyAcceptance,
      vendor: fakeVendor,
      git: false,
    });
    expect(generated.ok).toBe(true);
    const lock = readLock(dir)!;
    expect(lock.fixedAcceptance).toHaveLength(6);
    for (const suite of lock.fixedAcceptance!) {
      expect(Object.keys(lock.files)).toContain(`tests/acceptance/qrwty/${suite.id}.test.ts`);
    }
    expect(
      JSON.parse(readFileSync(join(dir, "services/qrwty/package.json"), "utf8")),
    ).toMatchObject({
      dependencies: { qrcode: "1.5.4" },
    });
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))).toMatchObject({
      devDependencies: {
        "@playwright/test": "1.63.0",
        jsqr: "1.4.0",
        pngjs: "7.0.0",
      },
    });

    const again = await generateProject({
      dir,
      design,
      projectName: "qrwty",
      vendor: fakeVendor,
      git: false,
    });
    expect(again.ok).toBe(true);
    expect(readLock(dir)!.fixedAcceptance).toHaveLength(6);
    expect(readFileSync(join(dir, "tests/acceptance/qrwty/browser.test.ts"), "utf8")).toContain(
      "QR-09",
    );
  });
});

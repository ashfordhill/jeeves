import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResourceConfig } from "@jeeves/spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FixedAcceptance } from "../src/acceptance.ts";
import { type CheckOutcome, runBaseline, verifyBehavior } from "../src/baseline/index.ts";
import { generateProject } from "../src/generate.ts";
import type { Lock } from "../src/lock.ts";
import { fixtureDesign } from "../src/test-support.ts";

// Technical fixtures demonstrate the harness; these are not qrwty acceptance cases.
const design = fixtureDesign("resources");
design.elements = design.elements.filter((e) => e.id !== "web");
design.connections = design.connections.filter((c) => c.kind !== "calls");
const model = design.elements[0]!.attachments[0]!.config.model as ResourceConfig;
model.acceptanceCases.push("IMAGE-01", "REDIRECT-01");
model.extensions.push({
  id: "image",
  operationId: "image",
  method: "GET",
  path: "/image",
  access: "public",
  acceptance: ["IMAGE-01"],
  notes: "Technical PNG fixture",
  contract: {
    parameters: [],
    responses: {
      "200": {
        description: "PNG",
        content: { "image/png": { schema: { type: "string", format: "binary" } } },
      },
    },
  },
});
model.extensions.push({
  id: "redirect",
  operationId: "redirect",
  method: "GET",
  path: "/redirect",
  access: "public",
  acceptance: ["REDIRECT-01"],
  notes: "Technical redirect fixture",
  contract: {
    parameters: [],
    responses: {
      "302": {
        description: "Redirect",
        headers: {
          Location: {
            required: true,
            schema: { type: "string", const: "https://example.test/current" },
          },
          "Cache-Control": { required: true, schema: { type: "string", const: "no-store" } },
        },
      },
    },
  },
});
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const suites: FixedAcceptance[] = [
  {
    id: "activity",
    service: "links",
    operationIds: ["qrActivity"],
    acceptanceIds: ["ACT-01"],
    source: `import test from "node:test"; import assert from "node:assert/strict"; import {randomUUID} from "node:crypto";
test("fixed activity response in an authenticated fixture",async()=>{
  assert.equal(process.env.JEEVES_TEST_ISOLATED,"1");
  const base=process.env.JEEVES_TEST_URL,origin=process.env.JEEVES_TEST_PUBLIC_ORIGIN;
  const registration=await fetch(base+"/auth/register",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({email:randomUUID()+"@example.test",password:"isolated-test-password"})});
  assert.equal(registration.status,201);
  const response=await fetch(base+"/api/qr/00000000-0000-4000-8000-000000000000/activity",{headers:{cookie:registration.headers.get("set-cookie").split(";")[0]}});
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{total:0});
});`,
  },
  {
    id: "image",
    service: "links",
    operationIds: ["image"],
    acceptanceIds: ["IMAGE-01"],
    source: `import test from "node:test"; import assert from "node:assert/strict";
test("fixed PNG bytes",async()=>{const response=await fetch(process.env.JEEVES_TEST_URL+"/image"); assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"image/png"); assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from("${png}","base64"));});`,
  },
  {
    id: "redirect",
    service: "links",
    operationIds: ["redirect"],
    acceptanceIds: ["REDIRECT-01"],
    source: `import test from "node:test"; import assert from "node:assert/strict";
test("fixed redirect and cache policy, without following",async()=>{const response=await fetch(process.env.JEEVES_TEST_URL+"/redirect",{redirect:"manual"}); assert.equal(response.status,302); assert.equal(response.headers.get("location"),"https://example.test/current"); assert.equal(response.headers.get("cache-control"),"no-store");});`,
  },
];
const dir = mkdtempSync(join(tmpdir(), "jeeves-p4-verification-"));
let lock: Lock;
const logs: string[] = [];
const fixtureNames: string[] = [];
const log = (line: string) => {
  if (line.startsWith("Disposable fixture: "))
    fixtureNames.push(line.slice("Disposable fixture: ".length));
  logs.push(line);
  if (logs.length > 100) logs.shift();
};
beforeAll(async () => {
  const result = await generateProject({
    dir,
    design,
    projectName: "Independent verification",
    git: false,
    fixedAcceptance: suites,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  lock = result.lock;
  execFileSync("pnpm", ["install", "--ignore-scripts"], { cwd: dir, stdio: "pipe" });
  for (const [id, operation] of [
    ["activity", "qrActivity"],
    ["image", "image"],
    ["redirect", "redirect"],
  ]) {
    const result =
      id === "activity"
        ? "{status:200,body:{total:0}}"
        : id === "image"
          ? `{status:200,headers:{"content-type":"image/png"},body:Buffer.from("${png}","base64")}`
          : '{status:302,headers:{Location:"https://example.test/current","Cache-Control":"no-store"}}';
    const path = join(dir, `services/links/src/features/${id}/index.ts`);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(
      path,
      `import { defineFeature } from "@jeeves/service-runtime"; export default defineFeature({name:"${id}",operations:{${operation}:()=>(${result})}});`,
    );
  }
});
afterAll(() => {
  execFileSync("docker", ["compose", "down", "--volumes", "--rmi", "local"], {
    cwd: dir,
    stdio: "pipe",
    env: {
      ...process.env,
      DB_LINKS_PASSWORD: "isolated-baseline-password",
      LINKS_PUBLIC_ORIGIN: "http://127.0.0.1:1",
    },
  });
  rmSync(dir, { recursive: true, force: true });
});

describe("independent run verification", () => {
  it("runs standard behavior plus fixed PNG, redirect and authenticated acceptance in fresh volumes", async () => {
    const checks: CheckOutcome[] = [];
    try {
      await verifyBehavior({
        dir,
        lock,
        required: { links: ["qrActivity", "image", "redirect"] },
        log,
        onCheck: (c) => checks.push(c),
      });
    } catch (error) {
      throw new Error(String(error) + "\n" + logs.join("\n"));
    }
    expect(checks.filter((c) => c.layer === "template").map((c) => [c.id, c.status])).toEqual([
      ["_session", "passed"],
      ["qr", "passed"],
    ]);
    expect(checks.filter((c) => c.layer === "application").map((c) => [c.id, c.status])).toEqual([
      ["activity", "passed"],
      ["image", "passed"],
      ["redirect", "passed"],
    ]);
    const containers = execFileSync(
      "docker",
      ["ps", "-a", "--filter", "label=com.docker.compose.project", "--format", "{{.Names}}"],
      { encoding: "utf8" },
    );
    expect(containers).not.toContain(fixtureNames.at(-1));
  });
  it("integrates independent tests into a green generated baseline while deferring unfinished extensions", async () => {
    writeFileSync(
      join(dir, "services/links/src/features/activity/index.ts"),
      'import {defineFeature} from "@jeeves/service-runtime";export default defineFeature({name:"activity",operations:{}});',
    );
    const previousPassword = process.env.DB_LINKS_PASSWORD;
    const previousOrigin = process.env.LINKS_PUBLIC_ORIGIN;
    process.env.DB_LINKS_PASSWORD = "isolated-baseline-password";
    process.env.LINKS_PUBLIC_ORIGIN = "http://127.0.0.1:1";
    try {
      const result = await runBaseline({
        dir,
        design,
        subjects: [
          { element: "links", attachment: "links-api", template: "rest-api-server@0.1.0" },
          { element: "links", template: "http-service@0.1.0" },
          { element: "links-db", template: "postgres@0.1.0" },
        ],
        onEvent: (e) => {
          if (e.type === "log") log(e.line);
        },
      });
      if (!result.ok)
        throw new Error(
          JSON.stringify(result.steps) +
            "\n" +
            JSON.stringify(result.checks) +
            "\n" +
            logs.join("\n"),
        );
      expect(result.steps.find((s) => s.step === "behavior")?.status).toBe("passed");
      expect(result.checks.find((c) => c.layer === "application")).toMatchObject({
        status: "skipped",
        reason: expect.stringContaining("links/qrActivity"),
      });
      expect(result.checks.find((c) => c.subject === "links" && c.id === "qr")?.status).toBe(
        "passed",
      );
    } finally {
      if (previousPassword === undefined) delete process.env.DB_LINKS_PASSWORD;
      else process.env.DB_LINKS_PASSWORD = previousPassword;
      if (previousOrigin === undefined) delete process.env.LINKS_PUBLIC_ORIGIN;
      else process.env.LINKS_PUBLIC_ORIGIN = previousOrigin;
    }
  });
  it("fails fixed expectations independently of a green template and cleans its volumes on failure", async () => {
    writeFileSync(
      join(dir, "services/links/src/features/activity/index.ts"),
      'import {defineFeature} from "@jeeves/service-runtime";export default defineFeature({name:"activity",operations:{qrActivity:()=>({status:200,body:{total:7}})}});',
    );
    const checks: CheckOutcome[] = [];
    await expect(
      verifyBehavior({
        dir,
        lock,
        required: { links: ["qrActivity"] },
        log,
        onCheck: (c) => checks.push(c),
      }),
    ).rejects.toThrow("Independent suite failed");
    expect(checks.find((c) => c.id === "activity")).toMatchObject({
      layer: "application",
      status: "failed",
    });
    expect(checks.filter((c) => c.layer === "template").every((c) => c.status === "passed")).toBe(
      true,
    );
    expect(checks.find((c) => c.id === "deferred")?.reason).toContain("links/image");
    const volumes = execFileSync("docker", ["volume", "ls", "--format", "{{.Name}}"], {
      encoding: "utf8",
    });
    expect(volumes).not.toContain(fixtureNames.at(-1));
  });
  it("rejects changed protected tests before starting install or Docker", async () => {
    writeFileSync(join(dir, "tests/generated/links/qr.test.ts"), "// weakened");
    const events: string[] = [];
    const result = await runBaseline({
      dir,
      design,
      subjects: [],
      unitTests: true,
      onEvent: (e) => events.push(JSON.stringify(e)),
    });
    expect(result.ok).toBe(false);
    expect(result.steps.find((s) => s.step === "install")?.message).toContain(
      "Protected artifact changed",
    );
    expect(result.steps.find((s) => s.step === "compose-up")?.status).toBe("skipped");
    expect(readFileSync(join(dir, "tests/acceptance/links/activity.test.ts"), "utf8")).toBe(
      suites[0]!.source,
    );
  });
});

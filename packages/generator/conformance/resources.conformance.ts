import { execFileSync as rawExecFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResourceConfig } from "@jeeves/spec";
import { type StartedProject, startProject } from "@jeeves/template-kit/harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateProject } from "../src/generate.ts";
import { fixtureDesign } from "../src/test-support.ts";

const execFileSync: typeof rawExecFileSync = ((...args: Parameters<typeof rawExecFileSync>) => {
  try {
    return rawExecFileSync(...args);
  } catch (error) {
    const failure = error as Error & { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      failure.message + "\n" + String(failure.stdout ?? "") + String(failure.stderr ?? ""),
    );
  }
}) as typeof rawExecFileSync;
const design = fixtureDesign("resources");
design.elements.push({
  id: "consumer",
  name: "Consumer",
  template: { id: "http-service", version: "0.1.0" },
  config: {},
  notes: "",
  attachments: [
    {
      id: "consumer-client",
      template: { id: "rest-api-client", version: "0.1.0" },
      config: {},
      notes: "",
    },
  ],
});
const resourceModel = design.elements[0]!.attachments[0]!.config.model as ResourceConfig;
resourceModel.resources.push({
  id: "memo",
  name: "memo",
  access: "owner",
  fields: [{ id: "body", name: "body", type: "text", required: true, maxLength: 100 }],
  belongsTo: [{ id: "qr-parent", resource: "qr", required: true }],
  operations: ["create", "read", "update", "list"],
});
resourceModel.acceptanceCases.push("PUB-01");
resourceModel.extensions.push({
  id: "public-link",
  operationId: "followPublic",
  method: "GET",
  path: "/q/{id}",
  access: "public",
  acceptance: ["PUB-01"],
  notes: "Fixture public redirect",
  contract: {
    parameters: [
      { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
    ],
    responses: {
      "302": {
        description: "Redirect",
        headers: {
          Location: { required: true, schema: { type: "string", format: "uri" } },
          "Cache-Control": { required: true, schema: { type: "string" } },
        },
      },
    },
  },
});
design.connections.push({
  id: "consumer-calls-links",
  kind: "calls",
  from: { element: "consumer" },
  to: { element: "links" },
  config: { fromCapability: "consumer-client", toCapability: "links-api" },
});
const dir = mkdtempSync(join(tmpdir(), "jeeves-resource-conformance-"));
const projectName = "jeeves-resource-" + process.pid;
const origin = "http://127.0.0.1:9999";
const previousPassword = process.env.DB_LINKS_PASSWORD,
  previousOrigin = process.env.LINKS_PUBLIC_ORIGIN;
let project: StartedProject;
let base: string;
let web: string;
let id: string;
const accounts: Record<string, Record<string, string>> = {};
const compose = (...args: string[]) =>
  execFileSync("docker", ["compose", "-p", projectName, ...args], {
    cwd: dir,
    encoding: "utf8",
    stdio: "pipe",
  });
beforeAll(async () => {
  process.env.DB_LINKS_PASSWORD = "isolated:password@with/slashes";
  process.env.LINKS_PUBLIC_ORIGIN = origin;
  const result = await generateProject({
    dir,
    design,
    projectName: "Resource conformance",
    git: false,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  writeFileSync(
    join(dir, "services/links/src/features/public-link/index.ts"),
    'import { defineFeature } from "@jeeves/service-runtime"; export default defineFeature({name:"public-link",operations:{followPublic:async () => ({status:302,headers:{Location:"http://127.0.0.1/destination","Cache-Control":"no-store"}})}});\n',
  );
  project = await startProject(dir, { projectName, startupTimeoutMs: 180000 });
  const endpoint = await project.service("links").endpoint(8080);
  base = "http://" + endpoint.host + ":" + endpoint.port;
  const frontend = await project.service("web").endpoint(5173);
  web = "http://" + frontend.host + ":" + frontend.port;
});
afterAll(async () => {
  await project?.down({ volumes: true, images: true });
  if (previousPassword === undefined) delete process.env.DB_LINKS_PASSWORD;
  else process.env.DB_LINKS_PASSWORD = previousPassword;
  if (previousOrigin === undefined) delete process.env.LINKS_PUBLIC_ORIGIN;
  else process.env.LINKS_PUBLIC_ORIGIN = previousOrigin;
  rmSync(dir, { recursive: true, force: true });
});
describe("structured resources: generated project", () => {
  it("type checks its generated client/server and executes its independent generated tests", () => {
    execFileSync("pnpm", ["install", "--ignore-scripts"], { cwd: dir, stdio: "pipe" });
    execFileSync("pnpm", ["typecheck"], { cwd: dir, stdio: "pipe" });
    execFileSync(
      "node",
      ["--test", "tests/generated/links/qr.test.ts", "tests/generated/links/memo.test.ts"],
      {
        cwd: dir,
        env: {
          ...process.env,
          JEEVES_TEST_ISOLATED: "1",
          JEEVES_TEST_URL: base,
          JEEVES_TEST_PUBLIC_ORIGIN: origin,
        },
        stdio: "pipe",
      },
    );
  });
  it("persists owners and serves same-origin proxy calls, validates sessions and isolated database roles", async () => {
    for (const user of ["alice", "bob"]) {
      const response = await fetch(base + "/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: user + "@example.test", password: "conformance-password" }),
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as { csrfToken: string };
      accounts[user] = {
        cookie: response.headers.get("set-cookie")!.split(";")[0]!,
        "x-csrf-token": body.csrfToken,
        origin,
        "content-type": "application/json",
      };
    }
    const created = await fetch(web + "/_api/links/api/qr", {
      method: "POST",
      headers: accounts.alice,
      body: JSON.stringify({ destination: "https://example.test/first" }),
    });
    expect(created.status).toBe(201);
    id = ((await created.json()) as { id: string }).id;
    expect(
      (
        await fetch(base + "/api/memo", {
          method: "POST",
          headers: accounts.bob,
          body: JSON.stringify({ body: "forbidden parent", qrId: id }),
        })
      ).status,
    ).toBe(404);
    const redirect = await fetch(web + "/q/" + id, { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("http://127.0.0.1/destination");
    expect(redirect.headers.get("cache-control")).toBe("no-store");
    const memo = await fetch(base + "/api/memo", {
      method: "POST",
      headers: accounts.alice,
      body: JSON.stringify({ body: "owned child", qrId: id }),
    });
    expect(memo.status).toBe(201);

    expect((await fetch(base + "/api/qr/" + id, { headers: accounts.bob })).status).toBe(404);
    const clientScript =
      'import assert from "node:assert/strict"; import { linksClient } from "./services/consumer/src/clients/links.generated.ts"; const result=await linksClient.GET("/api/qr/{id}",{params:{path:{id:process.env.RESOURCE_ID}},headers:{cookie:process.env.OWNER_COOKIE}}); assert.equal(result.response.status,200); assert.equal(result.data.id,process.env.RESOURCE_ID);';
    execFileSync("node", ["--input-type=module", "-e", clientScript], {
      cwd: dir,
      env: {
        ...process.env,
        API_LINKS_URL: base,
        RESOURCE_ID: id,
        OWNER_COOKIE: accounts.alice?.cookie,
      },
      stdio: "pipe",
    });

    execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        'import assert from "node:assert/strict"; import { linksClient } from "./services/consumer/src/clients/links.generated.ts"; await assert.rejects(() => linksClient.GET("/api/qr"), error => error.code === "NETWORK");',
      ],
      { cwd: dir, env: { ...process.env, API_LINKS_URL: "http://127.0.0.1:1" }, stdio: "pipe" },
    );
    const rows = (await (await fetch(base + "/api/qr", { headers: accounts.bob })).json()) as {
      items: { id: string }[];
    };
    expect(rows.items.some((row) => row.id === id)).toBe(false);
    const role = await project
      .service("links-db")
      .exec([
        "psql",
        "-U",
        "postgres",
        "-d",
        "links",
        "-tAc",
        "SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='links'",
      ]);
    expect(role.output.trim()).toBe("f|f|f");
    const forbidden = await project
      .service("links-db")
      .exec([
        "sh",
        "-c",
        'PGPASSWORD="isolated:password@with/slashes" psql -h 127.0.0.1 -U links -d postgres -c "SELECT 1"',
      ]);
    expect(forbidden.exitCode).not.toBe(0);
    expect((await fetch(base + "/api/scan", { headers: accounts.alice })).status).toBe(404);
  });
  it("authenticates login, expires opaque sessions, and paginates without repeats", async () => {
    const login = (password: string) =>
      fetch(base + "/auth/login", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ email: "bob@example.test", password }),
      });
    expect((await login("incorrect-password")).status).toBe(401);
    expect((await login("conformance-password")).status).toBe(200);
    await project
      .service("links-db")
      .exec([
        "psql",
        "-U",
        "postgres",
        "-d",
        "links",
        "-c",
        "UPDATE app_session SET expires_at = now()-interval '1 second' WHERE user_id IN (SELECT id FROM app_user WHERE email='bob@example.test')",
      ]);
    expect((await fetch(base + "/auth/session", { headers: accounts.bob })).status).toBe(401);
    for (let n = 0; n < 4; n++)
      expect(
        (
          await fetch(base + "/api/qr", {
            method: "POST",
            headers: accounts.alice,
            body: JSON.stringify({ destination: "https://example.test/page/" + n }),
          })
        ).status,
      ).toBe(201);
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const result = (await (
        await fetch(base + "/api/qr?limit=2" + (cursor ? "&cursor=" + cursor : ""), {
          headers: accounts.alice,
        })
      ).json()) as { items: { id: string }[]; nextCursor: string | null };
      for (const row of result.items) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
      cursor = result.nextCursor;
    } while (cursor);
    expect(seen.size).toBe(5);
  });
  it("restarts both services, runs migrations twice, and preserves saved records/sessions", async () => {
    await project.service("links-db").restart();
    await project.service("links").restart();
    const endpoint = await project.service("links").endpoint(8080);
    base = "http://" + endpoint.host + ":" + endpoint.port;
    const response = await fetch(base + "/api/qr/" + id, { headers: accounts.alice });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      destination: "https://example.test/first",
      title: null,
    });
    const migrations = await project
      .service("links-db")
      .exec([
        "psql",
        "-U",
        "postgres",
        "-d",
        "links",
        "-tAc",
        "SELECT count(*) FROM jeeves_resource_migrations",
      ]);
    expect(migrations.output.trim()).toBe("1");
  });
  it("regenerates an additive field and stable-ID rename, preserves custom code and existing data", async () => {
    const feature = join(dir, "services/links/src/features/activity/index.ts");
    const original = readFileSync(feature, "utf8");
    writeFileSync(feature, original + "\n// retained custom work\n");
    const model = design.elements[0]!.attachments[0]!.config.model as ResourceConfig;
    model.resources[0]!.name = "code";
    model.resources[0]!.fields.push({
      id: "label",
      name: "label",
      type: "text",
      required: false,
      maxLength: 50,
    });
    design.revision++;
    const result = await generateProject({
      dir,
      design,
      projectName: "Resource conformance",
      git: false,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(readFileSync(feature, "utf8")).toContain("retained custom work");
    compose("up", "--build", "--wait");
    const currentPort = compose("port", "links", "8080").trim().split(":").at(-1);
    base = "http://127.0.0.1:" + currentPort;
    const response = await fetch(base + "/api/code/" + id, { headers: accounts.alice });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      label: null,
      destination: "https://example.test/first",
    });
    const sql = readFileSync(join(dir, "services/links/resource-migrations/0001.sql"), "utf8");
    expect(sql).not.toContain("DROP TABLE");
    const next = await generateProject({
      dir,
      design,
      projectName: "Resource conformance",
      git: false,
    });
    expect(next.ok && next.written).toEqual([]);
  });
});

import { execFileSync as rawExecFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResourceConfig } from "@jeeves/spec";
import { type StartedProject, startProject } from "@jeeves/template-kit/harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resourceDescriptor } from "../../../templates/rest-api-server/resources.ts";
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
  fields: [
    { id: "body", name: "body", type: "text", required: true, maxLength: 100 },
    { id: "copies", name: "copies", type: "integer", required: false, minimum: 1, maximum: 100 },
    { id: "style", name: "style", type: "enum", required: false, values: ["plain", "rounded"] },
  ],
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
resourceModel.acceptanceCases.push("CMD-01");
resourceModel.extensions.push({
  id: "publish-memo",
  operationId: "publishMemo",
  method: "POST",
  path: "/api/memo/{id}/publish",
  access: "owner",
  acceptance: ["CMD-01"],
  notes: "Publish an owned memo using bounded settings",
  contract: {
    parameters: [
      { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["copies", "style"],
            properties: {
              copies: { type: "integer", minimum: 1, maximum: 100 },
              style: { type: "string", enum: ["plain", "rounded"] },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Saved settings",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["id", "copies", "style"],
              properties: {
                id: { type: "string", format: "uuid" },
                copies: { type: "integer", minimum: 1, maximum: 100 },
                style: { type: "string", enum: ["plain", "rounded"] },
              },
            },
          },
        },
      },
      "404": { description: "Not found" },
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
let memoId: string;
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
  writeFileSync(
    join(dir, "services/links/src/features/publish-memo/index.ts"),
    `
import { defineFeature } from "@jeeves/service-runtime";
import { sessionPrincipal } from "@jeeves/rest-server";
import { database } from "../../jeeves.generated.ts";
import memo from "../../generated/resources/memo.ts";
const copies = memo.fields.find(f => f.name === "copies")!.column;
const style = memo.fields.find(f => f.name === "style")!.column;
export default defineFeature({ name: "publish-memo", operations: { publishMemo: async request => {
  const input = request.body as { copies: number; style: string };
  const { rows } = await database.pool.query('UPDATE "' + memo.table + '" SET "' + copies + '"=$1,"' + style + '"=$2 WHERE id=$3 AND owner_id=$4 RETURNING id,"' + copies + '" AS copies,"' + style + '" AS style', [input.copies, input.style, request.params.id, sessionPrincipal(request.request)!.id]);
  return rows[0] ? { status: 200, body: rows[0] } : { status: 404, body: { error: "NOT_FOUND", message: "No owned memo" } };
} } });
`,
  );
  writeFileSync(
    join(dir, "services/consumer/src/command-typecheck.ts"),
    `
import { linksClient } from "./clients/links.generated.ts";
export const good = () => linksClient.POST("/api/memo/{id}/publish", { params: { path: { id: "fixture" } }, body: { copies: 17, style: "rounded" } });
// @ts-expect-error the generated client must reject string quantities and unknown enum values
export const bad = () => linksClient.POST("/api/memo/{id}/publish", { params: { path: { id: "fixture" } }, body: { copies: "17", style: "arbitrary" } });
`,
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
    memoId = ((await memo.json()) as { id: string }).id;

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
  it("validates owner commands and persists bounded settings with database constraints", async () => {
    const url = base + "/api/memo/" + memoId + "/publish";
    const call = (headers = accounts.alice, value: unknown = { copies: 17, style: "rounded" }) =>
      fetch(url, { method: "POST", headers, body: JSON.stringify(value) });
    expect((await call({ "content-type": "application/json" })).status).toBe(401);
    expect((await call({ ...accounts.alice, "x-csrf-token": "wrong" })).status).toBe(403);
    expect((await call({ ...accounts.alice, origin: "http://evil.test" })).status).toBe(403);
    expect((await call(accounts.bob)).status).toBe(404);
    for (const invalid of [
      { copies: 0, style: "plain" },
      { copies: 101, style: "plain" },
      { copies: "17", style: "plain" },
      { copies: 1, style: "invalid" },
      { copies: 1, style: "plain", ownerId: "caller" },
    ])
      expect((await call(accounts.alice, invalid)).status).toBe(400);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            cookie: accounts.alice!.cookie!,
            origin,
            "x-csrf-token": accounts.alice!["x-csrf-token"]!,
          },
        })
      ).status,
    ).toBe(400);
    const saved = await call();
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ id: memoId, copies: 17, style: "rounded" });
    const descriptor = resourceDescriptor(
      resourceModel.resources.find((r) => r.id === "memo")!,
      resourceModel,
    );
    for (const [field, value] of [
      ["copies", "101"],
      ["style", "'invalid'"],
    ]) {
      const column = descriptor.fields.find((f) => f.name === field)!.column;
      const invalid = await project
        .service("links-db")
        .exec([
          "psql",
          "-U",
          "postgres",
          "-d",
          "links",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `UPDATE "${descriptor.table}" SET "${column}"=${value} WHERE id='${memoId}'`,
        ]);
      expect(invalid.exitCode).not.toBe(0);
      expect(invalid.output).toMatch(/check constraint/i);
    }
    const clientScript =
      'import assert from "node:assert/strict"; import { linksClient } from "./services/consumer/src/clients/links.generated.ts"; const result=await linksClient.POST("/api/memo/{id}/publish",{params:{path:{id:process.env.MEMO_ID}},headers:JSON.parse(process.env.OWNER_HEADERS),body:{copies:17,style:"rounded"}}); assert.equal(result.response.status,200); assert.deepEqual(result.data,{id:process.env.MEMO_ID,copies:17,style:"rounded"});';
    execFileSync("node", ["--input-type=module", "-e", clientScript], {
      cwd: dir,
      env: {
        ...process.env,
        API_LINKS_URL: base,
        MEMO_ID: memoId,
        OWNER_HEADERS: JSON.stringify(accounts.alice),
      },
      stdio: "pipe",
    });
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
    expect(
      await (await fetch(base + "/api/memo/" + memoId, { headers: accounts.alice })).json(),
    ).toMatchObject({ id: memoId, copies: 17, style: "rounded" });
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

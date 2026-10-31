import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createService, type Service } from "@jeeves/service-runtime";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { legacyRuntime } from "../test-fixtures/legacy-runtime.ts";
import { type ResourceDatabase, type ResourceDefinition, resourceServer } from "./resources.ts";
import { sessionCookieName } from "./sessions.ts";

const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002";
const resource: ResourceDefinition = {
  id: "qr",
  name: "qr",
  table: "qr",
  access: "owner",
  fields: [
    {
      id: "destination",
      name: "destination",
      column: "destination",
      type: "http-url",
      required: true,
    },
    { id: "title", name: "title", column: "title", type: "text", required: false, maxLength: 120 },
  ],
  belongsTo: [],
  operations: ["create", "read", "update", "list"],
};
const uuid = { type: "string", format: "uuid" };
const object = {
  type: "object",
  additionalProperties: false,
  required: ["destination"],
  properties: {
    destination: { type: "string", format: "uri" },
    title: { type: ["string", "null"], maxLength: 120 },
  },
};
const response = {
  description: "Success",
  content: { "application/json": { schema: { type: "object" } } },
};
const paths = {
  "/auth/register": { post: { operationId: "registerAccount", responses: { "201": response } } },
  "/auth/login": { post: { operationId: "login", responses: { "200": response } } },
  "/auth/logout": {
    post: { operationId: "logout", responses: { "204": { description: "Logged out" } } },
  },
  "/auth/session": { get: { operationId: "readSession", responses: { "200": response } } },
  "/api/qr": {
    post: {
      operationId: "createQr",
      requestBody: { required: true, content: { "application/json": { schema: object } } },
      responses: { "201": response, "400": response, "404": response },
    },
    get: {
      operationId: "listQr",
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        { name: "cursor", in: "query", schema: { type: "string" } },
      ],
      responses: { "200": response, "400": response },
    },
  },
  "/api/qr/{id}": {
    parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
    get: { operationId: "readQr", responses: { "200": response, "404": response } },
    patch: {
      operationId: "updateQr",
      requestBody: { required: true, content: { "application/json": { schema: object } } },
      responses: { "200": response, "400": response, "404": response },
    },
  },
};
let service: Service | undefined;
const dirs: string[] = [];
afterEach(async () => {
  await service?.stop();
  service = undefined;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const origin = "http://127.0.0.1:9999";
const token = (letter: string) => letter.repeat(64);
const legacy = await legacyRuntime();
afterAll(legacy.cleanup);
let cookieName = sessionCookieName(origin);
let selectedServer = resourceServer;
const headers = (letter = "a") => ({
  cookie: cookieName + "=" + token(letter),
  origin,
  "x-csrf-token": "csrf",
});
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-resource-api-"));
  dirs.push(dir);
  const contract = join(dir, "api.json");
  writeFileSync(
    contract,
    JSON.stringify({ openapi: "3.1.0", info: { title: "Test", version: "1" }, paths }),
  );
  const row = {
    id: "20000000-0000-4000-8000-000000000001",
    destination: "https://example.test",
    title: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const query = vi.fn<ResourceDatabase["query"]>(async (sql, values = []) => {
    if (sql.includes("FROM app_session"))
      return {
        rows: [
          {
            user_id:
              values[0] === createHash("sha256").update(token("a")).digest("hex") ? alice : bob,
            csrf_token: "csrf",
          },
        ],
      };
    if (values[0] === bob) return { rows: [] };
    return { rows: [row] };
  });
  service = await createService(
    {
      name: "test",
      plugins: [
        selectedServer({
          contract,
          database: () => ({ query }),
          resources: [resource],
          extensions: [],
        }),
      ],
    },
    { env: { PUBLIC_ORIGIN: origin }, logger: false },
  );
  return { app: service.app, query, row };
}
describe.each([
  ["legacy compiled 0.2.0", legacy.resourceServer, "jeeves_session"],
  ["current source 0.3.0", resourceServer, sessionCookieName(origin)],
] as const)("generated resource runtime: %s", (_version, server, name) => {
  beforeEach(() => {
    selectedServer = server;
    cookieName = name;
  });
  it("authenticates before validation or resource storage and rejects caller-supplied owners", async () => {
    const { app, query } = await setup();
    expect(
      (await app.inject({ method: "POST", url: "/api/qr", payload: { ownerId: bob } })).statusCode,
    ).toBe(401);
    expect(query).not.toHaveBeenCalled();
    for (const payload of [
      { destination: "https://example.test", ownerId: bob },
      { destination: "https://example.test", unknown: true },
      { destination: "ftp://example.test" },
      { destination: "https://user:pass@example.test" },
      {},
    ]) {
      expect(
        (await app.inject({ method: "POST", url: "/api/qr", headers: headers(), payload }))
          .statusCode,
      ).toBe(400);
    }
    expect(query.mock.calls.every(([sql]) => sql.includes("FROM app_session"))).toBe(true);
  });
  it("uses server principal, parameterized SQL and owner predicates for reads and updates", async () => {
    const { app, query, row } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: headers(),
      payload: { destination: "https://example.test" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().createdAt).toBe("2026-01-01T00:00:00.000Z");
    const insertion = query.mock.calls.find(([sql]) => sql.startsWith("INSERT"))!;
    expect(insertion[0]).toContain("owner_id");
    expect(insertion[1]![0]).toBe(alice);
    expect(insertion[0]).not.toContain(alice);
    expect((await app.inject({ url: "/api/qr/" + row.id, headers: headers("b") })).statusCode).toBe(
      404,
    );
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/qr/" + row.id,
          headers: headers("b"),
          payload: { destination: "https://elsewhere.test" },
        })
      ).statusCode,
    ).toBe(404);
    const update = query.mock.calls.find(([sql]) => sql.startsWith("UPDATE"))!;
    expect(update[0]).toContain("WHERE owner_id = $1 AND id =");
    expect(update[1]![0]).toBe(bob);
  });
  it("applies PATCH as a partial update and preserves an omitted optional title", async () => {
    const { app, query, row } = await setup();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/qr/" + row.id,
      headers: headers(),
      payload: { destination: "https://elsewhere.test" },
    });
    expect(response.statusCode).toBe(200);
    const update = query.mock.calls.find(([sql]) => sql.startsWith("UPDATE"))!;
    expect(update[0]).toContain("destination");
    expect(update[0].split("WHERE")[0]).not.toContain("title");
  });
  it("enforces CSRF, validates IDs/cursors, and bounds list pagination", async () => {
    const { app, query } = await setup();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/qr",
          headers: { ...headers(), origin: "https://attacker.test" },
          payload: { destination: "https://example.test" },
        })
      ).statusCode,
    ).toBe(403);
    for (const url of ["/api/qr/bad-id", "/api/qr?cursor=invalid", "/api/qr?limit=101"])
      expect((await app.inject({ url, headers: headers() })).statusCode).toBe(400);
    query.mockClear();
    expect((await app.inject({ url: "/api/qr?limit=2", headers: headers() })).statusCode).toBe(200);
    expect(query.mock.calls[1]![0]).toContain("ORDER BY created_at DESC, id DESC LIMIT $2");
    expect(query.mock.calls[1]![1]).toEqual([alice, 3]);
  });
});

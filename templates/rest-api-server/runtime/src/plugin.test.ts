import { fileURLToPath } from "node:url";
import {
  createService,
  defineFeature,
  defineService,
  type OperationHandler,
  type Service,
} from "@jeeves/service-runtime";
import { afterEach, describe, expect, it } from "vitest";
import { ContractError, parseContract } from "./contract.ts";
import { type RestServerOptions, restServer } from "./plugin.ts";

const contract = fileURLToPath(new URL("../test-fixtures/links.openapi.yaml", import.meta.url));

const links = new Map<string, string>([["jv", "https://example.com"]]);
const handlers: Record<string, OperationHandler> = {
  listLinks: ({ query }) => ({
    status: 200,
    body: [...links].slice(0, Number(query.limit)).map(([code, target]) => ({ code, target })),
  }),
  createLink: ({ body }) => {
    const { target } = body as { target: string };
    links.set("new", target);
    return { status: 201, body: { code: "new", target } };
  },
  getLink: ({ params }) => {
    const target = links.get(String(params.code));
    if (!target) return { status: 404, body: { error: "NOT_FOUND", message: "No such link" } };
    // A response the contract doesn't allow, to test response validation.
    if (params.code === "broken") return { status: 200, body: { code: 7 } };
    return { status: 200, body: { code: params.code, target } };
  },
};

const services: Service[] = [];
async function build(
  options: Partial<RestServerOptions> = {},
  operations: Record<string, OperationHandler> = handlers,
  env: Record<string, string> = {},
) {
  const service = await createService(
    defineService({
      name: "links",
      plugins: [restServer({ contract, basePath: "/api", ...options })],
    }),
    { logger: false, env, features: [defineFeature({ name: "links", operations })] },
  );
  services.push(service);
  return service.app;
}
afterEach(async () => {
  await Promise.all(services.splice(0).map((s) => s.stop()));
});

describe("restServer", () => {
  it("routes operations under the base path, coercing and defaulting parameters", async () => {
    const app = await build();
    const list = await app.inject("/api/links");
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([{ code: "jv", target: "https://example.com" }]);
    expect((await app.inject("/api/links/jv")).json()).toEqual({
      code: "jv",
      target: "https://example.com",
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/links",
      payload: { target: "https://jeeves.dev" },
    });
    expect(created.statusCode).toBe(201);
  });

  it("rejects invalid requests with 400 and where each problem is", async () => {
    const app = await build();
    const query = await app.inject("/api/links?limit=500");
    expect(query.statusCode).toBe(400);
    expect(query.json()).toEqual({
      error: "REQUEST_INVALID",
      message: "The request doesn't match the API contract",
      details: [{ in: "query", path: "/limit", message: "must be <= 100" }],
    });
    const path = await app.inject("/api/links/NOT_A_CODE");
    expect(path.json().details[0]).toMatchObject({ in: "path", path: "/code" });

    const body = await app.inject({ method: "POST", url: "/api/links", payload: { url: "x" } });
    expect(body.statusCode).toBe(400);
    expect(body.json().details).toEqual([
      { in: "body", path: "/target", message: "must have required property 'target'" },
      { in: "body", path: "/url", message: "isn't allowed" },
    ]);

    const missing = await app.inject({ method: "POST", url: "/api/links" });
    expect(missing.json().details).toEqual([{ in: "body", path: "", message: "is required" }]);

    const malformed = await app.inject({
      method: "POST",
      url: "/api/links",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error).toBe("REQUEST_INVALID");
  });

  it("answers 500 RESPONSE_INVALID when a handler breaks the contract", async () => {
    links.set("broken", "https://example.com");
    const app = await build();
    const response = await app.inject("/api/links/broken");
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "RESPONSE_INVALID" });
    expect(response.json().details).toContainEqual({
      in: "response",
      path: "/code",
      message: "must be string",
    });

    const warned = await build({ responseValidation: "warn" });
    expect((await warned.inject("/api/links/broken")).json()).toEqual({ code: 7 });
  });

  it("refuses an undocumented status", async () => {
    const app = await build({}, { ...handlers, getLink: () => ({ status: 418 }) });
    expect((await app.inject("/api/links/jv")).json().details).toEqual([
      { in: "response", path: "", message: "status 418 isn't documented" },
    ]);
  });

  it("answers 501 for operations with no handler and reports them", async () => {
    const app = await build();
    const response = await app.inject({ method: "DELETE", url: "/api/links/jv" });
    expect(response.statusCode).toBe(501);
    expect(response.json().error).toBe("NOT_IMPLEMENTED");
    const report = (await app.inject("/_jeeves/operations")).json();
    expect(report.basePath).toBe("/api");
    expect(report.operations).toContainEqual({
      operationId: "deleteLink",
      method: "DELETE",
      path: "/api/links/{code}",
      implemented: false,
    });
    expect(report.operations).toContainEqual({
      operationId: "getLink",
      method: "GET",
      path: "/api/links/{code}",
      implemented: true,
      feature: "links",
    });
  });

  it("refuses a handler for an operation the contract doesn't have", async () => {
    await expect(build({}, { ...handlers, shortenLink: () => ({ status: 200 }) })).rejects.toThrow(
      'Feature "links" handles operation "shortenLink", which isn\'t in',
    );
  });

  it("serves the contract at /openapi.json with the real base path", async () => {
    const app = await build({ basePath: "/v1/" });
    const document = (await app.inject("/openapi.json")).json();
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "/v1" }]);
    expect((await app.inject("/v1/links/jv")).statusCode).toBe(200);
    expect((await app.inject("/v1/nothing")).json().error).toBe("NOT_FOUND");
  });

  it("requires the bearer token when auth is bearer", async () => {
    await expect(build({ auth: "bearer" })).rejects.toThrow(
      "REST_BEARER_TOKEN is required when the API uses bearer auth",
    );
    const app = await build({ auth: "bearer" }, handlers, { REST_BEARER_TOKEN: "s3cret" });
    expect((await app.inject("/api/links")).statusCode).toBe(401);
    const wrong = await app.inject({ url: "/api/links", headers: { authorization: "Bearer no" } });
    expect(wrong.statusCode).toBe(401);
    const right = await app.inject({
      url: "/api/links",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(right.statusCode).toBe(200);
  });
});

describe("parseContract", () => {
  const problems = (text: string) => {
    try {
      parseContract(text);
    } catch (error) {
      return (error as ContractError).problems;
    }
    return [];
  };

  it("requires OpenAPI 3.1 and an operationId on every operation", () => {
    expect(problems("openapi: 3.0.3\npaths:\n  /a:\n    get:\n      responses: {}\n")).toEqual([
      '"openapi" must be 3.1.x (got "3.0.3")',
      "GET /a has no operationId",
    ]);
  });

  it("refuses duplicate operation IDs and unreadable YAML", () => {
    const twice =
      "openapi: 3.1.0\npaths:\n  /a:\n    get: { operationId: x }\n    post: { operationId: x }\n";
    expect(problems(twice)).toEqual(['operationId "x" is used twice']);
    expect(problems("openapi: [")[0]).toMatch(/^not valid YAML/);
  });

  it("is a ContractError", () => {
    expect(() => parseContract("nope")).toThrow(ContractError);
  });
});

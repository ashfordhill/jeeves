import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const serverRequire = createRequire(
  new URL("../../../jeeves/apps/server/package.json", import.meta.url),
);
const urls = new Map<string, string>();
function load(name: string): string {
  const old = urls.get(name);
  if (old) return old;
  const source = readFileSync(
    new URL(`../../templates/local-v2/assets/src/${name}.ts.template`, import.meta.url),
    "utf8",
  );
  const url = `data:text/javascript;base64,${Buffer.from(
    stripTypeScriptTypes(source)
      .replace(/from "\.\/(.+)\.ts"/g, (_m, dep: string) => `from "${load(`runtime/${dep}`)}"`)
      .replace(
        /from "\.\.\/runtime\/(.+)\.ts"/g,
        (_m, dep: string) => `from "${load(`runtime/${dep}`)}"`,
      )
      .replace('from "fastify"', `from "${pathToFileURL(serverRequire.resolve("fastify")).href}"`),
  ).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { createHttpService, HttpError } = await import(load("runtime/http"));
const { createTileGuard } = await import(load("runtime/tile-guard"));
const { OperationError } = await import(load("runtime/operation"));
const { defineRoutes } = await import(load("modules/entry"));
const { stubRoutes, notImplementedRoutes } = await import(load("runtime/tile-http"));
const closed: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(closed.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});
type Request = { body: Buffer; rawBody?: Buffer };
interface Reply {
  code(status: number): Reply;
  header(name: string, value: string): Reply;
}
interface Routes {
  route(route: {
    method: string;
    url: string;
    bodyLimit?: number;
    rawBody?: boolean;
    handler(request: Request, reply: Reply): Promise<unknown>;
  }): void;
}
const service = async (
  configure: (routes: Routes) => void,
  extra: Record<string, unknown> = {},
) => {
  const app = await createHttpService({
    id: "probe",
    settings: { requestTimeoutMs: 60, concurrencyLimit: 1 },
    configure,
    initialize: async () => {},
    ...extra,
  });
  closed.push(app);
  await app.start({ host: "127.0.0.1", port: 0 });
  return app;
};
const shaped = (e: { code: string; message: string; retryable: boolean; requestId: string }) => ({
  problem: { code: e.code, message: e.message, retryable: e.retryable },
  requestId: e.requestId,
});

describe("RG04 shared HTTP contract", () => {
  it("formats guard, validation, framework parsing, table and template failures with generated status/headers", async () => {
    const guard = createTileGuard({
      signIn: "required",
      verify: async () => {
        throw Object.assign(Error("token secret"), {
          code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
        });
      },
    });
    const app = await service(
      (routes) => {
        guard
          .routes(routes)
          .route({ method: "GET", url: "/guard", handler: async () => ({ ok: true }) });
        routes.route({
          method: "POST",
          url: "/validate",
          handler: async () => {
            throw new HttpError(422, "PRODUCT_INPUT", "Choose an item.");
          },
        });
        notImplementedRoutes(routes, () => {}, "template").route({
          method: "GET",
          url: "/template",
          handler: async () => {
            throw Error("Not implemented: template policy");
          },
        });
        routes.route({
          method: "GET",
          url: "/failure",
          handler: async () => {
            throw Error("postgres password=secret");
          },
        });
        const table = defineRoutes({ "GET /item": async () => ({ body: { ok: true } }) });
        stubRoutes(
          routes,
          () => {},
          "table",
          (r: unknown) => table(r, undefined),
          { deadlineMs: 60 },
        );
      },
      { formatError: shaped },
    );
    for (const [method, url, status, code, payload] of [
      ["GET", "/guard", 401, "SIGN_IN_REQUIRED"],
      ["POST", "/validate", 422, "PRODUCT_INPUT", "{}"],
      ["POST", "/validate", 400, "INVALID_REQUEST", "{"],
      ["GET", "/template", 501, "NOT_IMPLEMENTED"],
      ["GET", "/failure", 503, "UNAVAILABLE"],
      ["POST", "/modules/table/item", 405, "METHOD_NOT_ALLOWED"],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        ...(payload ? { headers: { "content-type": "application/json" }, payload } : {}),
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ problem: { code }, requestId: expect.any(String) });
      expect(response.headers["cache-control"]).toBe("no-store");
      if (status === 401) expect(response.headers["www-authenticate"]).toBe("Bearer");
      if (status === 405) expect(response.headers.allow).toBe("GET, HEAD");
      if (url === "/failure") {
        expect(response.body).not.toContain("secret");
        expect(response.headers["retry-after"]).toBeUndefined();
      }
    }
  });

  it("keeps classification and mandatory headers when a formatter throws, returns promises or attempts status changes", async () => {
    for (const formatter of [
      () => {
        throw Error("secret formatter exception");
      },
      () => Promise.resolve({ error: "oops" }),
      () => Promise.reject(Error("secret async formatter exception")),
      () => ({ status: 200, headers: {}, custom: true }),
    ]) {
      const app = await service(
        (routes) =>
          routes.route({
            method: "GET",
            url: "/refuse",
            handler: async (_r: unknown, reply: Reply) => {
              reply.header("Retry-After", "999");
              throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
            },
          }),
        { formatError: formatter },
      );
      const response = await app.inject({ method: "GET", url: "/refuse" });
      expect(response.statusCode).toBe(401);
      expect(response.headers["www-authenticate"]).toBe("Bearer");
      expect(response.headers["retry-after"]).toBeUndefined();
      expect(response.body).not.toContain("secret");
      expect(response.json()).toEqual(
        formatter.toString().includes("custom")
          ? { status: 200, headers: {}, custom: true }
          : { error: "SIGN_IN_REQUIRED", message: "Sign in to continue." },
      );
    }
  });

  it("preserves raw bytes before decoding, enforces finite route bounds on streamed and declared bodies", async () => {
    const received: Buffer[] = [];
    const app = await service((routes) => {
      routes.route({
        method: "POST",
        url: "/raw",
        rawBody: true,
        bodyLimit: 1024,
        handler: async (r: Request) => {
          received.push(r.body);
          expect(r.rawBody).toEqual(r.body);
          return { ok: true };
        },
      });
      routes.route({
        method: "POST",
        url: "/large",
        bodyLimit: 1048576,
        handler: async () => ({ ok: true }),
      });
    });
    const bytes = Buffer.concat([
      Buffer.from('{ malformed json\r\n "café":'),
      Buffer.from([0xff, 0, 1]),
    ]);
    for (const type of ["application/json", "application/octet-stream"]) {
      const response = await app.inject({
        method: "POST",
        url: "/raw",
        headers: { "content-type": type },
        payload: bytes,
      });
      expect(response.statusCode).toBe(200);
    }
    expect(received).toEqual([bytes, bytes]);
    const { Readable } = await import("node:stream");
    for (const payload of [
      Buffer.alloc(1025),
      Readable.from([Buffer.alloc(700), Buffer.alloc(325)]),
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/raw",
        headers: { "content-type": "application/octet-stream" },
        payload,
      });
      expect(response.statusCode).toBe(413);
    }
    expect(received).toHaveLength(2);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/large",
          headers: { "content-type": "text/plain" },
          payload: "a".repeat(65537),
        })
      ).statusCode,
    ).toBe(200);
    await expect(
      createHttpService({
        id: "bad",
        settings: { requestTimeoutMs: 60, concurrencyLimit: 1 },
        initialize: async () => {},
        configure: (r: Routes) =>
          r.route({ method: "POST", url: "/bad", bodyLimit: Infinity, handler: async () => ({}) }),
      }),
    ).rejects.toThrow("Invalid HTTP body declaration");
  });

  it("bounds a stalled body on a real socket and never dispatches an expired handler", async () => {
    const { request } = await import("node:http");
    let calls = 0;
    const app = await createHttpService({
      id: "slow-body",
      settings: { requestTimeoutMs: 60, concurrencyLimit: 1 },
      initialize: async () => {},
      configure: (r: Routes) =>
        r.route({
          method: "POST",
          url: "/body",
          handler: async () => {
            calls += 1;
            return { ok: true };
          },
        }),
    });
    closed.push(app);
    const address = await app.start({ host: "127.0.0.1", port: 0 });
    const result = await new Promise<{ status: number | undefined; body: string }>(
      (resolve, reject) => {
        const client = request(
          `${address}/body`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "content-length": "100" },
          },
          (response) => {
            let body = "";
            response.on("data", (data) => {
              body += data;
            });
            response.on("end", () => {
              client.destroy();
              resolve({ status: response.statusCode, body });
            });
          },
        );
        client.on("error", reject);
        client.write('{"incomplete":');
      },
    );
    expect(result.status).toBe(503);
    expect(JSON.parse(result.body)).toEqual({
      error: "DEADLINE",
      message: "Request deadline exceeded; check status before retrying.",
    });
    expect(calls).toBe(0);
  });

  it("distinguishes invalid-token 401 from transient JWKS/native dependency 503 without provider details", async () => {
    for (const [error, status] of [
      [
        Object.assign(Error("bad signature"), { code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" }),
        401,
      ],
      [
        Object.assign(Error("jwks secret url"), {
          code: "ERR_JWKS_TIMEOUT",
          outcome: "definite-failure",
        }),
        503,
      ],
      [
        Object.assign(Error("socket secret"), { code: "ECONNRESET", outcome: "definite-failure" }),
        503,
      ],
      [new OperationError("definite-failure", "INTERRUPTED"), 503],
    ] as const) {
      const guard = createTileGuard({
        signIn: "optional",
        verify: async () => {
          throw error;
        },
      });
      const app = await service((r) =>
        guard.routes(r).route({ method: "GET", url: "/private", handler: async () => ({}) }),
      );
      const response = await app.inject({
        method: "GET",
        url: "/private",
        headers: { authorization: "Bearer secret-token" },
      });
      expect(response.statusCode).toBe(status);
      expect(response.body).not.toContain("secret");
    }
  });

  it("authorizes retry for pre-dispatch overload only, preserving deadlines/unknown outcomes and safe correlated logs", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line) => lines.push(String(line)));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const app = await service(
      (r) => {
        r.route({ method: "POST", url: "/held", handler: () => gate });
        r.route({
          method: "GET",
          url: "/unknown",
          handler: async () => {
            throw new OperationError("unknown", "INTERRUPTED");
          },
        });
        r.route({
          method: "POST",
          url: "/returned",
          handler: async (_r: unknown, reply: Reply) => {
            reply.code(503).header("Retry-After", "999");
            return {
              error: "OVERLOADED",
              message: "provider password=secret-returned",
              secret: "secret",
            };
          },
        });
        r.route({
          method: "GET",
          url: "/provider",
          handler: async () => {
            throw Object.assign(Error("provider secret"), { statusCode: 400 });
          },
        });
      },
      { formatError: shaped },
    );
    const pending = app.inject({
      method: "POST",
      url: "/held?password=secret-query",
      headers: {
        "x-correlation-id": "correlation-1",
        authorization: "Bearer secret-auth",
        cookie: "secret-cookie",
        "content-type": "text/plain",
      },
      payload: "secret-body",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const overloaded = await app.inject({ method: "POST", url: "/held" });
    expect(overloaded.statusCode).toBe(503);
    expect(overloaded.headers["retry-after"]).toBe("1");
    expect(overloaded.json().problem.retryable).toBe(true);
    const deadline = await pending;
    expect(deadline.json().problem.code).toBe("DEADLINE");
    expect(deadline.json().problem.retryable).toBe(false);
    expect(deadline.headers["retry-after"]).toBeUndefined();
    release();
    await new Promise((resolve) => setTimeout(resolve, 1));
    for (const url of ["/unknown", "/provider"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(503);
      expect(response.headers["retry-after"]).toBeUndefined();
      expect(response.json().problem.retryable).toBe(false);
    }
    const returned = await app.inject({ method: "POST", url: "/returned" });
    expect(returned.statusCode).toBe(503);
    expect(returned.headers["retry-after"]).toBeUndefined();
    expect(returned.json().problem).toEqual({
      code: "UNAVAILABLE",
      message: "Service unavailable.",
      retryable: false,
    });
    expect(returned.body).not.toContain("secret");
    app.stop();
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(503);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/livez",
          headers: { "x-jeeves-remaining-ms": "invalid" },
        })
      ).statusCode,
    ).toBe(200);
    const log = lines
      .map((line) => JSON.parse(line))
      .find((line) => line.correlationId === "correlation-1");
    expect(log).toMatchObject({
      event: "request-failed",
      route: "/held",
      status: 503,
      code: "DEADLINE",
      requestId: deadline.headers["x-request-id"],
    });
    expect(lines.join("\n")).not.toContain("secret");
    await app.close();
    expect(lines.map((line) => JSON.parse(line).event)).toContain("http-drained");
  });
});

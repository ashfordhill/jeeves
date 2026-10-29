import { describe, expect, it } from "vitest";
import type { paths } from "../test-fixtures/links.openapi.ts";
import { createRestClient, type RestClientOptions } from "./client.ts";
import { RestClientNetworkError, RestClientTimeoutError } from "./errors.ts";

type Handler = (request: Request) => Response | Promise<Response>;

function setup(handler: Handler, options: Partial<RestClientOptions> = {}) {
  const requests: Request[] = [];
  const client = createRestClient<paths>({
    name: "links",
    baseUrl: "http://links:8080/v1",
    fetch: async (request) => {
      requests.push(request.clone());
      return handler(request);
    },
    ...options,
  });
  return { client, requests };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Never answers; rejects when the request is aborted, like fetch does. */
const hang: Handler = (request) =>
  new Promise((_resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(request.signal.reason));
  });

describe("createRestClient", () => {
  it("calls the contract path under the base URL and returns typed data", async () => {
    const { client, requests } = setup(() => json({ message: "hi" }));
    const { data, response } = await client.GET("/ping", { params: { query: { message: "hi" } } });
    expect(data).toEqual({ message: "hi" });
    expect(response.status).toBe(200);
    expect(requests[0]?.url).toBe("http://links:8080/v1/ping?message=hi");
  });

  it("returns error statuses as { error } instead of throwing", async () => {
    const { client } = setup(() => json({ error: "REQUEST_INVALID", message: "no" }, 400));
    const result = await client.POST("/links", { body: { url: "x" } });
    expect(result.error).toEqual({ error: "REQUEST_INVALID", message: "no" });
  });

  it("resolves a function base URL on every call", async () => {
    let base = "http://one/v1";
    const { client, requests } = setup(() => json({ message: "ok" }), { baseUrl: () => base });
    await client.GET("/ping");
    base = "http://two/v1";
    await client.GET("/ping");
    expect(requests.map((r) => r.url)).toEqual(["http://one/v1/ping", "http://two/v1/ping"]);
    expect(client.baseUrl()).toBe("http://two/v1");
  });

  it("adds headers and a request ID, keeping ones the caller set", async () => {
    const { client, requests } = setup(() => json({ message: "ok" }), {
      headers: () => ({ authorization: "Bearer t" }),
      requestId: () => "from-context",
    });
    await client.GET("/ping");
    await client.GET("/ping", {
      headers: { "x-request-id": "mine", authorization: "Bearer other" },
    });
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer t");
    expect(requests[0]?.headers.get("x-request-id")).toBe("from-context");
    expect(requests[1]?.headers.get("x-request-id")).toBe("mine");
    expect(requests[1]?.headers.get("authorization")).toBe("Bearer other");
  });

  it("gives each call a new request ID when there is no context", async () => {
    const { client, requests } = setup(() => json({ message: "ok" }));
    await client.GET("/ping");
    await client.GET("/ping");
    const [a, b] = requests.map((r) => r.headers.get("x-request-id"));
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it("throws a typed timeout error when no response arrives in time", async () => {
    const { client, requests } = setup(hang, { timeoutMs: 30 });
    const error = await client.GET("/ping").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RestClientTimeoutError);
    expect(error).toMatchObject({
      code: "TIMEOUT",
      client: "links",
      method: "GET",
      url: "http://links:8080/v1/ping",
      attempts: 1,
    });
    expect((error as Error).message).toBe(
      "GET http://links:8080/v1/ping (links) got no response within 30 ms",
    );
    expect(requests).toHaveLength(1);
  });

  it("throws a typed network error with the cause", async () => {
    const { client } = setup(() => {
      throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") });
    });
    const error = await client.GET("/ping").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RestClientNetworkError);
    expect((error as Error).message).toContain("fetch failed: connect ECONNREFUSED");
  });

  it("retries idempotent calls after timeouts, network errors, and 503, with the same request ID", async () => {
    const answers: Handler[] = [
      hang,
      () => Promise.reject(new TypeError("fetch failed")),
      () => json({ error: "UNAVAILABLE", message: "busy" }, 503),
      () => json({ message: "finally" }),
    ];
    const { client, requests } = setup((request) => (answers.shift() as Handler)(request), {
      retries: 3,
      timeoutMs: 30,
    });
    const { data } = await client.GET("/ping");
    expect(data).toEqual({ message: "finally" });
    expect(requests).toHaveLength(4);
    expect(new Set(requests.map((r) => r.headers.get("x-request-id"))).size).toBe(1);
  });

  it("reports the attempts when retries run out, and returns the last 503 as an error", async () => {
    const timeouts = setup(hang, { retries: 1, timeoutMs: 20 });
    await expect(timeouts.client.GET("/ping")).rejects.toMatchObject({ attempts: 2 });
    const busy = setup(() => json({ error: "UNAVAILABLE", message: "busy" }, 503), { retries: 2 });
    const { error, response } = await busy.client.GET("/ping");
    expect(response.status).toBe(503);
    expect(error).toMatchObject({ error: "UNAVAILABLE" });
    expect(busy.requests).toHaveLength(3);
  });

  it("never retries POST, and resends bodies intact on retried PUT-like calls", async () => {
    const post = setup(() => json({ error: "UNAVAILABLE", message: "busy" }, 503), { retries: 3 });
    await post.client.POST("/links", { body: { url: "https://example.com" } });
    expect(post.requests).toHaveLength(1);

    let calls = 0;
    const del = setup(() => (calls++ === 0 ? json({}, 502) : new Response(null, { status: 204 })), {
      retries: 1,
    });
    const { response } = await del.client.DELETE("/links/{code}", {
      params: { path: { code: "jv" } },
    });
    expect(response.status).toBe(204);
    expect(del.requests.map((r) => r.method)).toEqual(["DELETE", "DELETE"]);
  });

  it("passes the caller's abort through instead of retrying or wrapping it", async () => {
    const { client, requests } = setup(hang, { retries: 2, timeoutMs: 5000 });
    const controller = new AbortController();
    const call = client.GET("/ping", { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("user cancelled")), 10);
    await expect(call).rejects.toThrow("user cancelled");
    expect(requests).toHaveLength(1);
  });
});

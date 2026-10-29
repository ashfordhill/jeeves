import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createService, defineFeature, defineService, type Service } from "@jeeves/service-runtime";
import { afterEach, describe, expect, it } from "vitest";
import type { paths } from "../test-fixtures/links.openapi.ts";
import { serviceRestClient } from "./service.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});

/** A stand-in for the target service that echoes what it received. */
async function target(): Promise<string> {
  const server: Server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        message: JSON.stringify({
          url: request.url,
          requestId: request.headers["x-request-id"],
          authorization: request.headers.authorization ?? null,
        }),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const clientOptions = {
  name: "links",
  basePath: "/v1",
  urlEnv: "API_LINKS_URL",
  tokenEnv: "API_LINKS_TOKEN",
};

async function start(env: Record<string, string>) {
  const links = serviceRestClient<paths>(clientOptions);
  const relay = defineFeature({
    name: "relay",
    register(app) {
      app.get("/relay", async () => {
        const { data } = await links.GET("/ping");
        return JSON.parse(data?.message ?? "{}");
      });
    },
  });
  const service: Service = await createService(
    defineService({ name: "stats", plugins: [links.plugin] }),
    { env, logger: false, features: [relay] },
  );
  cleanup.push(() => service.stop());
  return service;
}

describe("serviceRestClient", () => {
  it("calls the target with the base path, the token, and the handled request's ID", async () => {
    const url = await target();
    const service = await start({ API_LINKS_URL: `${url}/`, API_LINKS_TOKEN: "secret" });
    const response = await service.app.inject({
      url: "/relay",
      headers: { "x-request-id": "req-from-browser" },
    });
    expect(response.json()).toEqual({
      url: "/v1/ping",
      requestId: "req-from-browser",
      authorization: "Bearer secret",
    });
    expect(response.headers["x-request-id"]).toBe("req-from-browser");
  });

  it("sends the service's own request ID when the caller didn't send one", async () => {
    const url = await target();
    const service = await start({ API_LINKS_URL: url, API_LINKS_TOKEN: "secret" });
    const response = await service.app.inject("/relay");
    const forwarded = response.json().requestId as string;
    expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers["x-request-id"]).toBe(forwarded);
  });

  it("reports a missing or invalid environment with the service's other problems", async () => {
    await expect(start({ API_LINKS_URL: "links:8080", PORT: "x" })).rejects.toThrow(
      [
        'Service "stats" can\'t start: invalid environment',
        '  - PORT: must be a whole number from 1 to 65535 (got "x")',
        '  - API_LINKS_URL: must be an http(s) URL (got "links:8080")',
        "  - API_LINKS_TOKEN: required (the links API uses bearer auth)",
      ].join("\n"),
    );
    const links = serviceRestClient<paths>({ ...clientOptions, tokenEnv: undefined });
    expect(links.plugin.configure({})).toEqual([
      "API_LINKS_URL: required (the address of the links service)",
    ]);
  });

  it("reads the process environment when used outside a service (scripts, tests)", async () => {
    const url = await target();
    const links = serviceRestClient<paths>({ ...clientOptions, urlEnv: "JEEVES_TEST_LINKS_URL" });
    process.env.JEEVES_TEST_LINKS_URL = url;
    process.env.API_LINKS_TOKEN = "env-token";
    cleanup.push(async () => {
      delete process.env.JEEVES_TEST_LINKS_URL;
      delete process.env.API_LINKS_TOKEN;
    });
    const { data } = await links.GET("/ping");
    expect(JSON.parse(data?.message ?? "{}")).toMatchObject({ authorization: "Bearer env-token" });
    expect(links.baseUrl()).toBe(`${url}/v1`);
    delete process.env.JEEVES_TEST_LINKS_URL;
    expect(() => links.baseUrl()).toThrow(
      "The links API client: JEEVES_TEST_LINKS_URL: required (the address of the links service)",
    );
  });
});

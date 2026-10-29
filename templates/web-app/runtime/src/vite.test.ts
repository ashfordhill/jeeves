import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProxyOptions } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { jeevesDev } from "./vite.ts";

type ProxyMap = Record<string, ProxyOptions & { rewrite: (path: string) => string }>;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.API_LINK_STORE_URL;
  delete process.env.API_LINK_STORE_TOKEN;
});

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-web-runtime-"));
  dirs.push(dir);
  mkdirSync(join(dir, "nginx"));
  writeFileSync(
    join(dir, "nginx/jeeves-config.json.template"),
    JSON.stringify({
      title: `\${APP_TITLE}`,
      apis: { "link-store": { url: "/_api/link-store" }, stats: { url: "/_api/stats" } },
    }),
  );
  return dir;
}

describe("jeevesDev", () => {
  it("proxies each configured API to API_<NAME>_URL with its token", () => {
    process.env.API_LINK_STORE_URL = "http://127.0.0.1:49152";
    process.env.API_LINK_STORE_TOKEN = "t";
    const plugin = jeevesDev({ title: "Links" });
    const configHook = plugin.config as (config: object) => { server: { proxy: ProxyMap } };
    const proxy = configHook({ root: project() }).server.proxy;
    expect(Object.keys(proxy)).toEqual(["/_api/link-store"]);
    expect(proxy["/_api/link-store"]).toMatchObject({
      target: "http://127.0.0.1:49152",
      headers: { authorization: "Bearer t" },
    });
    expect(proxy["/_api/link-store"]?.rewrite("/_api/link-store/v1/ping")).toBe("/v1/ping");
  });
});

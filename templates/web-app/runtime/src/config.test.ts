import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiUrl,
  loadRuntimeConfig,
  parseRuntimeConfig,
  RuntimeConfigError,
  renderConfigTemplate,
  runtimeConfig,
  setRuntimeConfig,
} from "./config.ts";

afterEach(() => {
  setRuntimeConfig(undefined);
  vi.unstubAllGlobals();
});

describe("runtime config", () => {
  it("renders the template with JSON-escaped values, missing ones empty", () => {
    const template = `{"title": "\${APP_TITLE}", "other": "\${NOT_SET}", "keep": "$HOME"}`;
    const rendered = renderConfigTemplate(template, { APP_TITLE: 'Say "hi" \\ bye' });
    expect(JSON.parse(rendered)).toEqual({ title: 'Say "hi" \\ bye', other: "", keep: "$HOME" });
  });

  it("loads and checks the config, listing every problem", async () => {
    const respond = (body: unknown) =>
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body)));
    respond({ title: "Links", apis: { links: { url: "/_api/links" } } });
    expect(await loadRuntimeConfig()).toEqual({
      title: "Links",
      apis: { links: { url: "/_api/links" } },
    });
    respond({ apis: { links: {} } });
    await expect(loadRuntimeConfig()).rejects.toThrow(
      '/jeeves-config.json is invalid: "title" must be a string; "apis.links.url" must be a string',
    );
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    await expect(loadRuntimeConfig()).rejects.toThrow("Couldn't load /jeeves-config.json: 404");
  });

  it("resolves API URLs once loaded", () => {
    expect(() => runtimeConfig()).toThrow(RuntimeConfigError);
    setRuntimeConfig(parseRuntimeConfig({ title: "x", apis: { links: { url: "/_api/links/" } } }));
    expect(apiUrl("links")).toBe("/_api/links");
    expect(() => apiUrl("stats")).toThrow('The runtime config has no API "stats"');
  });
});

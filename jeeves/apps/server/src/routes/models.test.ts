import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { providerInfo } from "@jeeves/providers";
import { describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import {
  type CatalogProvider,
  type ModelCatalog,
  type ModelOption,
  parseModelsDev,
} from "../model-catalog.ts";
import { Settings } from "../settings.ts";
import { buildTestApp } from "../test-support.ts";

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

/** A made-up models.dev reply. OpenAI has 14 models that take tools and a newer one that doesn't. */
const reply = {
  openai: {
    id: "openai",
    name: "OpenAI",
    models: {
      ...Object.fromEntries(
        Array.from({ length: 14 }, (_, i) => {
          const n = String(i + 1).padStart(2, "0");
          return [
            `gpt-t${n}`,
            {
              id: `gpt-t${n}`,
              name: `GPT T${n}`,
              tool_call: true,
              release_date: `2026-01-${n}`,
              cost: { input: 1, output: 4 },
              limit: { context: 200000 },
            },
          ];
        }),
      ),
      "gpt-no-tools": {
        id: "gpt-no-tools",
        name: "No tools",
        tool_call: false,
        release_date: "2026-12-01",
      },
      // A suggested model that is too old for the newest 12 keeps its catalogue details.
      "gpt-5.5": {
        id: "gpt-5.5",
        name: "GPT-5.5",
        tool_call: true,
        release_date: "2025-06-01",
        cost: { input: 5, output: 30 },
        limit: { context: 1050000 },
      },
    },
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: {
      "claude-older": {
        id: "claude-older",
        name: "Claude Older",
        tool_call: true,
        release_date: "2025-05-01",
        cost: { input: 3, output: 15 },
        limit: { context: 200000 },
      },
      "claude-haiku-5-5": {
        id: "claude-haiku-5-5",
        name: "Claude Haiku 5.5",
        tool_call: true,
        release_date: "2026-09-01",
        cost: { input: 0.1, output: 0.5 },
        limit: { context: 1000000 },
      },
    },
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    api: "https://api.deepseek.com",
    models: {
      "deepseek-chat": {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        tool_call: true,
        release_date: "2026-02-01",
        cost: { input: 0.28, output: 0.42 },
        limit: { context: 128000 },
      },
      "deepseek-no-tools": { id: "deepseek-no-tools", name: "No tools", tool_call: false },
    },
  },
  // An `api` the custom endpoint would refuse is not a known host.
  plain: {
    id: "plain",
    name: "Plain host",
    api: "http://llm.example.invalid/v1",
    models: { m: { id: "m", tool_call: true } },
  },
  "a-host": {
    id: "a-host",
    name: "A host",
    api: "https://llm.example.invalid/v1",
    models: { m: { id: "m", tool_call: true } },
  },
};

const catalogOf = (providers: readonly CatalogProvider[]): ModelCatalog => ({
  providers: async () => providers,
});
const catalogue = parseModelsDev(reply) ?? [];

function setup(env: NodeJS.ProcessEnv = {}, providers = catalogue) {
  const dir = temp("jeeves-models-");
  const codexHome = temp("jeeves-models-codex-");
  const settings = new Settings(dir, { HOME: dir, CODEX_HOME: codexHome, ...env });
  const app = buildTestApp({} as Db, { settings, modelCatalog: catalogOf(providers) });
  const view = async () => {
    const res = await app.inject({ method: "GET", url: "/models" });
    expect(res.statusCode).toBe(200);
    return res.json() as {
      selected: { provider: string; model: string };
      providers: {
        id: string;
        name: string;
        ready: boolean;
        status: string;
        models: ModelOption[];
      }[];
    };
  };
  const ids = async (provider: string) =>
    (await view()).providers.find((p) => p.id === provider)?.models.map((m) => m.id);
  return { app, settings, codexHome, view, ids };
}

const suggested = (id: string) => providerInfo(id)?.suggestedModels ?? [];

describe("GET /models", () => {
  it("answers with the design model and each provider's name, status and models", async () => {
    const { view } = setup({ OPENAI_API_KEY: "sk-made-up-openai-key" });
    const answer = await view();
    expect(answer.selected).toEqual({ provider: "openai", model: "gpt-5.4-mini" });
    expect(answer.providers.map((p) => [p.id, p.name, p.ready, p.status])).toEqual([
      ["openai", "OpenAI API", true, "Key set in the environment"],
      ["codex", "Codex", false, "Not logged in"],
      ["anthropic", "Anthropic API", false, "No key"],
      ["custom", "Custom endpoint", false, "Not set up"],
    ]);
    // No answer holds a key.
    expect(JSON.stringify(answer)).not.toContain("sk-made-up");
  });

  it("lists OpenAI's and Anthropic's models that take tools, newest first, then the suggested and selected ones", async () => {
    const { app, ids, view } = setup();
    const newest = Array.from({ length: 12 }, (_, i) => `gpt-t${String(14 - i).padStart(2, "0")}`);
    expect(await ids("openai")).toEqual([...newest, ...suggested("openai")]);

    const openai = (await view()).providers.find((p) => p.id === "openai");
    expect(openai?.models[0]).toEqual({
      id: "gpt-t14",
      name: "GPT T14",
      contextWindow: 200000,
      inputPrice: 1,
      outputPrice: 4,
    });
    // A suggested model keeps its catalogue details; one models.dev doesn't know has none.
    expect(openai?.models.find((m) => m.id === "gpt-5.5")).toEqual({
      id: "gpt-5.5",
      name: "GPT-5.5",
      contextWindow: 1050000,
      inputPrice: 5,
      outputPrice: 30,
    });
    expect(openai?.models.find((m) => m.id === "gpt-5.4-mini")).toEqual({
      id: "gpt-5.4-mini",
      name: "gpt-5.4-mini",
      contextWindow: null,
      inputPrice: null,
      outputPrice: null,
    });

    // Anthropic's: newest first, a suggested one listed once.
    const anthropic = await ids("anthropic");
    expect(anthropic).toEqual([
      "claude-haiku-5-5",
      "claude-older",
      ...suggested("anthropic").filter((id) => id !== "claude-haiku-5-5"),
    ]);

    // The selected model is listed under its provider, last when models.dev doesn't have it.
    await app.inject({
      method: "PUT",
      url: "/settings/roles",
      payload: { designChat: { provider: "anthropic", model: "claude-made-up" } },
    });
    expect((await view()).selected).toEqual({ provider: "anthropic", model: "claude-made-up" });
    expect((await ids("anthropic"))?.at(-1)).toBe("claude-made-up");
    expect(await ids("openai")).not.toContain("claude-made-up");

    // With no catalogue (offline, no file): the suggested ones only.
    const offline = setup({}, []);
    expect(await offline.ids("openai")).toEqual(suggested("openai"));
  });

  it("lists Codex's own models from its models_cache.json, else its suggested ones", async () => {
    const { codexHome, ids, view } = setup();
    expect(await ids("codex")).toEqual(suggested("codex"));

    // A made-up cache, in the shape Codex writes it: hidden models aren't listed.
    const cache = join(codexHome, "models_cache.json");
    writeFileSync(
      cache,
      JSON.stringify({
        fetched_at: "2026-11-13T00:00:00Z",
        etag: "made-up",
        models: [
          {
            slug: "gpt-codex-one",
            display_name: "Codex One",
            context_window: 500000,
            visibility: "list",
            priority: 1,
          },
          {
            slug: "gpt-codex-hidden",
            display_name: "Hidden",
            context_window: 272000,
            visibility: "hide",
          },
          { slug: "gpt-codex-two", context_window: 272000, visibility: "list" },
          { display_name: "No slug", visibility: "list" },
        ],
      }),
    );
    const codex = (await view()).providers.find((p) => p.id === "codex");
    expect(codex?.models).toEqual([
      {
        id: "gpt-codex-one",
        name: "Codex One",
        contextWindow: 500000,
        inputPrice: null,
        outputPrice: null,
      },
      {
        id: "gpt-codex-two",
        name: "gpt-codex-two",
        contextWindow: 272000,
        inputPrice: null,
        outputPrice: null,
      },
    ]);

    // A file that can't be read as Codex's cache: the suggested ones.
    writeFileSync(cache, "{ not json");
    expect(await ids("codex")).toEqual(suggested("codex"));
    writeFileSync(cache, JSON.stringify({ models: [{ slug: "x", visibility: "hide" }] }));
    expect(await ids("codex")).toEqual(suggested("codex"));
  });

  it("lists the custom endpoint's models from the models.dev provider with its base URL, else none", async () => {
    const { app, ids } = setup();
    expect(await ids("custom")).toEqual([]);

    const save = (baseUrl: string) =>
      app.inject({
        method: "PUT",
        url: "/settings/custom",
        payload: { name: "DeepSeek", baseUrl, apiKey: "sk-made-up-endpoint-key" },
      });
    expect((await save("https://api.deepseek.com/")).statusCode).toBe(200);
    expect(await ids("custom")).toEqual(["deepseek-chat"]);

    expect((await save("https://llm.unknown.invalid/v1")).statusCode).toBe(200);
    expect(await ids("custom")).toEqual([]);
  });
});

describe("GET /models/hosts", () => {
  it("lists the models.dev providers with a base URL the custom endpoint takes, by name", async () => {
    const { app } = setup();
    const res = await app.inject({ method: "GET", url: "/models/hosts" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      hosts: [
        { id: "a-host", name: "A host", baseUrl: "https://llm.example.invalid/v1" },
        { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com" },
      ],
    });
    const empty = setup({}, []);
    expect((await empty.app.inject({ method: "GET", url: "/models/hosts" })).json()).toEqual({
      hosts: [],
    });
  });
});

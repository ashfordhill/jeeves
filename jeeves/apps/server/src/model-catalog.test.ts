import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CATALOG_MAX_AGE_MS,
  CATALOG_TIMEOUT_MS,
  createModelCatalog,
  MODELS_DEV_URL,
  parseModelsDev,
} from "./model-catalog.ts";

const HOUR = 60 * 60 * 1000;
const home = () => mkdtempSync(join(tmpdir(), "jeeves-catalog-"));

/** A made-up models.dev reply, in its shape: providers by ID, each with models by ID. */
const reply = {
  openai: {
    id: "openai",
    name: "OpenAI",
    npm: "@ai-sdk/openai",
    env: ["OPENAI_API_KEY"],
    doc: "https://example.invalid/docs",
    models: {
      "gpt-example": {
        id: "gpt-example",
        name: "GPT Example",
        attachment: true,
        reasoning: true,
        tool_call: true,
        knowledge: "2026-01",
        release_date: "2026-03-01",
        last_updated: "2026-03-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        cost: { input: 1.25, output: 10, cache_read: 0.125 },
        limit: { context: 400000, output: 128000 },
      },
    },
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    npm: "@ai-sdk/openai-compatible",
    api: "https://api.deepseek.com",
    models: {
      "deepseek-example": {
        id: "deepseek-example",
        name: "DeepSeek Example",
        tool_call: true,
        release_date: "2026-02-01",
        cost: { input: 0.28, output: 0.42 },
        limit: { context: 128000, output: 8192 },
      },
    },
  },
};

/** A fake `fetch` that answers every request with `answer()`, and a clock tests move on. */
function fakes(answer: () => Response | Promise<Response> = () => Response.json(reply)) {
  let time = Date.UTC(2026, 10, 13);
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => answer());
  return {
    fetch,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

const catalogFrom = (dir: string, f: ReturnType<typeof fakes>) =>
  createModelCatalog({ home: dir, fetch: f.fetch as unknown as typeof fetch, now: f.now });

const names = (providers: readonly { id: string }[]) => providers.map((p) => p.id);

describe("model catalogue", () => {
  it("reads models.dev at most once a day and keeps what it needs in models-dev.json", async () => {
    const dir = home();
    const f = fakes();
    const catalog = catalogFrom(dir, f);

    // Two pickers opening at once share one request.
    const [first, second] = await Promise.all([catalog.providers(), catalog.providers()]);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    const [url, init] = f.fetch.mock.calls[0] ?? [];
    expect(url).toBe(MODELS_DEV_URL);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(CATALOG_TIMEOUT_MS).toBe(5000);
    expect(names(first)).toEqual(["openai", "deepseek"]);

    // The file keeps each model's ID, name, context, prices, tool_call and release date only.
    const saved = JSON.parse(readFileSync(join(dir, "models-dev.json"), "utf8"));
    expect(saved.fetchedAt).toBe(f.now());
    expect(saved.providers[0]).toEqual({
      id: "openai",
      name: "OpenAI",
      api: null,
      models: [
        {
          id: "gpt-example",
          name: "GPT Example",
          contextWindow: 400000,
          inputPrice: 1.25,
          outputPrice: 10,
          toolCall: true,
          releaseDate: "2026-03-01",
        },
      ],
    });
    expect(saved.providers[1].api).toBe("https://api.deepseek.com");

    // Within the day: no request.
    f.advance(23 * HOUR);
    await catalog.providers();
    expect(f.fetch).toHaveBeenCalledTimes(1);
    // A day after the last read: one more.
    f.advance(HOUR);
    await catalog.providers();
    await catalog.providers();
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses the saved file after a restart until it is a day old", async () => {
    const dir = home();
    const f = fakes();
    await catalogFrom(dir, f).providers();
    expect(f.fetch).toHaveBeenCalledTimes(1);

    // A new server on the same home, later the same day, reads the file instead.
    f.advance(12 * HOUR);
    const restarted = catalogFrom(dir, f);
    expect(names(await restarted.providers())).toEqual(["openai", "deepseek"]);
    expect(f.fetch).toHaveBeenCalledTimes(1);

    f.advance(12 * HOUR);
    await restarted.providers();
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });

  it("offline, uses the saved file, or an empty catalogue without one, and waits a day to ask again", async () => {
    const offline = () => {
      throw new TypeError("fetch failed");
    };

    // No file: empty, and no second request the same day.
    const empty = fakes(offline);
    const none = catalogFrom(home(), empty);
    expect(await none.providers()).toEqual([]);
    expect(await none.providers()).toEqual([]);
    expect(empty.fetch).toHaveBeenCalledTimes(1);
    empty.advance(CATALOG_MAX_AGE_MS);
    await none.providers();
    expect(empty.fetch).toHaveBeenCalledTimes(2);

    // A two-day-old file: used as it is, and left unchanged.
    const dir = home();
    const online = fakes();
    await catalogFrom(dir, online).providers();
    const before = readFileSync(join(dir, "models-dev.json"), "utf8");
    const later = fakes(offline);
    later.advance(2 * CATALOG_MAX_AGE_MS);
    expect(names(await catalogFrom(dir, later).providers())).toEqual(["openai", "deepseek"]);
    expect(later.fetch).toHaveBeenCalledTimes(1);
    expect(readFileSync(join(dir, "models-dev.json"), "utf8")).toBe(before);

    // A timed-out request is the same as no answer.
    const timedOut = fakes(() => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    timedOut.advance(2 * CATALOG_MAX_AGE_MS);
    expect(names(await catalogFrom(dir, timedOut).providers())).toEqual(["openai", "deepseek"]);
  });

  it("keeps the saved catalogue when a reply is malformed", async () => {
    const dir = home();
    await catalogFrom(dir, fakes()).providers();
    const before = readFileSync(join(dir, "models-dev.json"), "utf8");

    const answers = [
      () => new Response("<html>not json</html>", { status: 200 }),
      () => Response.json(["openai"]),
      () => Response.json({ openai: "no models" }),
      () => Response.json({}),
      () => Response.json({ error: "busy" }, { status: 503 }),
    ];
    for (const answer of answers) {
      const f = fakes(answer);
      f.advance(2 * CATALOG_MAX_AGE_MS);
      expect(names(await catalogFrom(dir, f).providers())).toEqual(["openai", "deepseek"]);
      expect(f.fetch).toHaveBeenCalledTimes(1);
      expect(readFileSync(join(dir, "models-dev.json"), "utf8")).toBe(before);
    }

    // A malformed reply and no file: an empty catalogue, and no file is written.
    const fresh = home();
    expect(await catalogFrom(fresh, fakes(answers[0])).providers()).toEqual([]);
    expect(existsSync(join(fresh, "models-dev.json"))).toBe(false);
    // A file that isn't the catalogue's is no catalogue.
    writeFileSync(join(fresh, "models-dev.json"), '{"fetchedAt":"yesterday"}');
    const f = fakes(answers[0]);
    expect(await catalogFrom(fresh, f).providers()).toEqual([]);
  });

  it("never fetches when the server replays a scripted model", async () => {
    const dir = home();
    const scripted = createModelCatalog({ home: dir, fetch: null, now: () => 0 });
    expect(await scripted.providers()).toEqual([]);
    // A file put there later is read.
    await catalogFrom(dir, fakes()).providers();
    expect(names(await scripted.providers())).toEqual(["openai", "deepseek"]);
  });

  it("keeps a model's fields only when they are well formed", () => {
    const providers = parseModelsDev({
      example: {
        name: "Example host",
        api: "https://llm.example.invalid/v1",
        models: {
          bare: {},
          odd: {
            id: "odd",
            name: " Odd ",
            tool_call: "yes",
            release_date: 20260101,
            cost: { input: -1, output: "2" },
            limit: { context: 1.5 },
          },
          broken: "not a model",
        },
      },
      empty: { name: "No models" },
    });
    expect(providers).toEqual([
      {
        id: "example",
        name: "Example host",
        api: "https://llm.example.invalid/v1",
        models: [
          {
            id: "bare",
            name: "bare",
            contextWindow: null,
            inputPrice: null,
            outputPrice: null,
            toolCall: false,
            releaseDate: null,
          },
          {
            id: "odd",
            name: "Odd",
            contextWindow: null,
            inputPrice: null,
            outputPrice: null,
            toolCall: false,
            releaseDate: null,
          },
        ],
      },
    ]);
    expect(parseModelsDev(null)).toBeUndefined();
    expect(parseModelsDev("text")).toBeUndefined();
  });
});

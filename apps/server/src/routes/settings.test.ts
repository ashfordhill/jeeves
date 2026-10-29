import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import { DEFAULT_MODELS, Settings } from "../settings.ts";
import { buildTestApp } from "../test-support.ts";

const home = () => mkdtempSync(join(tmpdir(), "jeeves-settings-"));

describe("settings", () => {
  it("reports key status without the key, and stores models per role", async () => {
    const dir = home();
    const app = buildTestApp({} as Db, { settings: new Settings(dir, {}) });

    const initial = (await app.inject({ method: "GET", url: "/settings" })).json();
    expect(initial).toEqual({
      configPath: join(dir, "config.json"),
      providers: [
        { id: "openai", name: "OpenAI", configured: false, source: null, envVar: "OPENAI_API_KEY" },
      ],
      models: DEFAULT_MODELS,
      fakeModel: false,
    });

    const res = await app.inject({
      method: "PUT",
      url: "/settings/models",
      payload: { designChat: "gpt-5.5" },
    });
    expect(res.json().models).toEqual({ ...DEFAULT_MODELS, designChat: "gpt-5.5" });
    const file = join(dir, "config.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ models: { designChat: "gpt-5.5" } });
    expect(statSync(file).mode & 0o777).toBe(0o600);

    const bad = await app.inject({
      method: "PUT",
      url: "/settings/models",
      payload: { coding: "" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("takes the key from the environment first, then the file, and keeps other file content", () => {
    const dir = home();
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ openai: { apiKey: "sk-file" }, extra: 1 }),
    );
    expect(new Settings(dir, {}).openaiKey()).toEqual({ key: "sk-file", source: "file" });
    const settings = new Settings(dir, { OPENAI_API_KEY: "sk-env" });
    expect(settings.openaiKey()).toEqual({ key: "sk-env", source: "env" });
    expect(JSON.stringify(settings.view())).not.toContain("sk-");

    settings.setModels({ planner: "gpt-5.4" });
    expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8"))).toEqual({
      openai: { apiKey: "sk-file" },
      extra: 1,
      models: { planner: "gpt-5.4" },
    });
  });
});

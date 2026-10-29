import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ROLE_MODELS } from "@jeeves/providers";
import { describe, expect, it } from "vitest";
import { providerModels } from "../chat/models.ts";
import { modelLabel } from "../chat/service.ts";
import type { Db } from "../db/client.ts";
import { codingAgents } from "../runs/agents.ts";
import { Settings } from "../settings.ts";
import { buildTestApp } from "../test-support.ts";

const home = () => mkdtempSync(join(tmpdir(), "jeeves-settings-"));

describe("settings", () => {
  it("reports provider status without keys, and stores a provider and model per role", async () => {
    const dir = home();
    const app = buildTestApp({} as Db, { settings: new Settings(dir, { HOME: dir }) });

    const initial = (await app.inject({ method: "GET", url: "/settings" })).json();
    expect(initial.configPath).toBe(join(dir, "config.json"));
    expect(initial.roles).toEqual(DEFAULT_ROLE_MODELS);
    expect(initial.fakeModel).toBe(false);
    expect(
      initial.providers.map((p: { id: string; ready: boolean; status: string }) => [
        p.id,
        p.ready,
        p.status,
      ]),
    ).toEqual([
      ["openai", false, "No API key"],
      ["codex", false, "Not logged in"],
      ["local", false, "Coming later"],
    ]);

    const res = await app.inject({
      method: "PUT",
      url: "/settings/roles",
      payload: { designChat: { provider: "openai", model: " gpt-5.5 " } },
    });
    expect(res.json().roles).toEqual({
      ...DEFAULT_ROLE_MODELS,
      designChat: { provider: "openai", model: "gpt-5.5" },
    });
    const file = join(dir, "config.json");
    expect(JSON.parse(readFileSync(file, "utf8")).roles.designChat).toEqual({
      provider: "openai",
      model: "gpt-5.5",
    });
    expect(statSync(file).mode & 0o777).toBe(0o600);

    const refused = async (payload: Record<string, unknown>, status: number) => {
      const r = await app.inject({ method: "PUT", url: "/settings/roles", payload });
      expect(r.statusCode, JSON.stringify(payload)).toBe(status);
      return r.json();
    };
    // An empty model is only allowed where it means the provider's default (Codex).
    expect((await refused({ planner: { provider: "openai", model: "" } }, 422)).message).toBe(
      "planner: Enter a model name.",
    );
    expect((await refused({ coding: { provider: "openai", model: "x" } }, 422)).message).toBe(
      "coding: OpenAI API can't run coding tasks.",
    );
    expect((await refused({ designChat: { provider: "local", model: "x" } }, 422)).message).toBe(
      "designChat: Local model isn't available yet.",
    );
    await refused({ designChat: { provider: "nope", model: "x" } }, 400);
    // Nothing refused was saved.
    expect(new Settings(dir, {}).roles().designChat.model).toBe("gpt-5.5");
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

    settings.setRoles({ planner: { provider: "openai", model: "gpt-5.4" } });
    const saved = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    expect(saved).toMatchObject({ openai: { apiKey: "sk-file" }, extra: 1 });
    expect(saved.roles.planner).toEqual({ provider: "openai", model: "gpt-5.4" });
  });

  it("reads the older model-per-role format and moves it into roles on the next save", () => {
    const dir = home();
    writeFileSync(join(dir, "config.json"), JSON.stringify({ models: { coding: "gpt-6-astra" } }));
    const settings = new Settings(dir, {});
    expect(settings.roles().coding).toEqual({ provider: "codex", model: "gpt-6-astra" });

    settings.setRoles({ designChat: { provider: "openai", model: "gpt-5.5" } });
    const saved = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    expect(saved.models).toBeUndefined();
    expect(saved.roles.coding).toEqual({ provider: "codex", model: "gpt-6-astra" });
  });

  it("sees a Codex login without reading it", () => {
    const dir = home();
    mkdirSync(join(dir, "codex"));
    writeFileSync(join(dir, "codex", "auth.json"), "{}");
    const settings = new Settings(dir, { CODEX_HOME: join(dir, "codex") });
    expect(settings.providerStatus("codex")).toEqual({
      ready: true,
      status: "Logged in",
      help: null,
    });
  });

  it("resolves each role to its provider", () => {
    const dir = home();
    const settings = new Settings(dir, { OPENAI_API_KEY: "sk-test" });
    const chat = providerModels(settings)("designChat");
    expect("provider" in chat && chat.provider.id).toBe("openai");
    expect("model" in chat && chat.model).toBe("gpt-5.4-mini");

    const coding = codingAgents(settings)();
    expect("agent" in coding && coding.agent.id).toBe("codex");
    expect("model" in coding && coding.model).toBe("");

    // Codex can fill a model role too, on its own login.
    const codexHome = home();
    writeFileSync(join(codexHome, "auth.json"), "{}");
    const viaCodex = new Settings(dir, { CODEX_HOME: codexHome });
    viaCodex.setRoles({ planner: { provider: "codex", model: "" } });
    const planner = providerModels(viaCodex)("planner");
    expect("provider" in planner && planner.provider.id).toBe("codex");
    // Runs and chat turns record a readable name for "the provider's default".
    if (!("provider" in planner)) throw new Error("expected a provider");
    expect(modelLabel(planner)).toBe("codex (default model)");
    expect(modelLabel({ ...planner, model: "gpt-6-astra" })).toBe("gpt-6-astra");
    const loggedOut = new Settings(dir, { HOME: home() });
    expect(providerModels(loggedOut)("planner")).toEqual({
      error: "Codex isn't logged in. Run `codex login` in a terminal, then try again.",
    });

    const keyless = providerModels(new Settings(home(), {}))("planner");
    expect("error" in keyless && keyless.error).toMatch(/No OpenAI API key/);
  });
});

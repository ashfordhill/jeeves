import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_ROLE_MODELS } from "@jeeves/providers";
import { describe, expect, it } from "vitest";
import { providerModels } from "../chat/models.ts";
import { modelLabel } from "../chat/service.ts";
import type { Db } from "../db/client.ts";
import { Settings } from "../settings.ts";
import { buildTestApp } from "../test-support.ts";

const home = () => mkdtempSync(join(tmpdir(), "jeeves-settings-"));

describe("settings", () => {
  it("reports provider status without keys, and stores a provider and model per role", async () => {
    const dir = home();
    const app = buildTestApp({} as Db, {
      settings: new Settings(dir, { HOME: dir }),
    });

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
      ["openai", false, "No key"],
      ["codex", false, "Not logged in"],
      ["anthropic", false, "No key"],
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
    expect((await refused({ designChat: { provider: "openai", model: "" } }, 422)).message).toBe(
      "designChat: Enter a model name.",
    );
    await refused({ coding: { provider: "codex", model: "" } }, 400);
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

    settings.setRoles({ designChat: { provider: "openai", model: "gpt-5.4" } });
    const saved = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    expect(saved).toMatchObject({ openai: { apiKey: "sk-file" }, extra: 1 });
    expect(saved.roles.designChat).toEqual({ provider: "openai", model: "gpt-5.4" });
  });

  it("reads the older model-per-role format and ignores roles that no longer exist", () => {
    const dir = home();
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        models: { designChat: "gpt-6-astra" },
        roles: { coding: { provider: "codex", model: "", reasoningEffort: "medium" } },
      }),
    );
    const settings = new Settings(dir, {});
    expect(settings.roles().designChat).toEqual({ provider: "openai", model: "gpt-6-astra" });

    settings.setRoles({ designChat: { provider: "openai", model: "gpt-5.5" } });
    const saved = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    expect(saved.models).toBeUndefined();
    expect(saved.roles).toEqual({ designChat: { provider: "openai", model: "gpt-5.5" } });
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
      keySource: null,
    });
  });

  it("resolves each role to its provider", () => {
    const dir = home();
    const settings = new Settings(dir, { OPENAI_API_KEY: "sk-test" });
    const chat = providerModels(settings)("designChat");
    expect("provider" in chat && chat.provider.id).toBe("openai");
    expect("model" in chat && chat.model).toBe("gpt-5.4-mini");

    // Codex can fill a model role too, on its own login.
    const codexHome = home();
    writeFileSync(join(codexHome, "auth.json"), "{}");
    const viaCodex = new Settings(dir, { CODEX_HOME: codexHome });
    viaCodex.setRoles({ designChat: { provider: "codex", model: "" } });
    const planner = providerModels(viaCodex)("designChat");
    expect("provider" in planner && planner.provider.id).toBe("codex");
    // Chat turns record a readable name for "the provider's default".
    if (!("provider" in planner)) throw new Error("expected a provider");
    expect(modelLabel(planner)).toBe("codex (default model)");
    expect(modelLabel({ ...planner, model: "gpt-6-astra" })).toBe("gpt-6-astra");
    const loggedOut = new Settings(dir, { HOME: home() });
    expect(providerModels(loggedOut)("designChat")).toEqual({
      error: "Codex isn't logged in. Run `codex login` in a terminal, then try again.",
    });

    const keyless = providerModels(new Settings(home(), {}))("designChat");
    expect("error" in keyless && keyless.error).toMatch(/No OpenAI API key/);

    // Anthropic takes its key from the file too, and says where to add one.
    const claudeHome = home();
    const claude = new Settings(claudeHome, {});
    claude.setRoles({ designChat: { provider: "anthropic", model: "claude-haiku-5-5" } });
    expect(providerModels(claude)("designChat")).toEqual({
      error: "No Anthropic API key is set. Add one in Settings.",
    });
    claude.setKey("anthropic", FAKE_KEY);
    const viaClaude = providerModels(claude)("designChat");
    expect("provider" in viaClaude && viaClaude.provider.id).toBe("anthropic");
  });
});

// Made-up keys only: none of these is a real key.
const FAKE_KEY = "sk-test-not-a-real-key-0000";
const OTHER_KEY = "sk-test-not-a-real-key-1111";
const ENV_KEY = "sk-test-not-a-real-key-env0";

/** A test app whose log lines are kept, on a settings directory of its own. */
function loggedApp(env: NodeJS.ProcessEnv = {}) {
  const dir = home();
  const lines: string[] = [];
  const app = buildTestApp({} as Db, {
    settings: new Settings(dir, env),
    logger: { level: "trace", stream: { write: (line: string) => lines.push(line) } },
  });
  return { app, dir, file: join(dir, "config.json"), lines };
}

type ProviderRow = { id: string; ready: boolean; status: string; keySource: string | null };
const row = (body: { providers: ProviderRow[] }, id: string) => {
  const found = body.providers.find((p) => p.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return { ready: found.ready, status: found.status, keySource: found.keySource };
};

describe("provider keys", () => {
  for (const id of ["openai", "anthropic"] as const) {
    it(`saves, replaces and removes the ${id} key, and never shows it`, async () => {
      const { app, file, lines } = loggedApp();
      // An older file with a wider mode, other content and the other provider's key.
      const other = id === "openai" ? "anthropic" : "openai";
      writeFileSync(file, JSON.stringify({ extra: 1, [other]: { apiKey: OTHER_KEY }, roles: {} }), {
        mode: 0o644,
      });
      chmodSync(file, 0o644);
      const bodies: string[] = [];
      const send = async (method: "PUT" | "DELETE", payload?: { key: string }) => {
        const res = await app.inject({
          method,
          url: `/settings/providers/${id}/key`,
          ...(payload && { payload }),
        });
        bodies.push(res.body);
        expect(res.statusCode, res.body).toBe(200);
        return res.json();
      };

      // Save: trimmed, mode 0600, the rest of the file kept.
      const saved = await send("PUT", { key: `  ${FAKE_KEY}  ` });
      expect(row(saved, id)).toEqual({ ready: true, status: "Key saved", keySource: "file" });
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
        extra: 1,
        [other]: { apiKey: OTHER_KEY },
        roles: {},
        [id]: { apiKey: FAKE_KEY },
      });
      const settings = new Settings(dirname(file), {});
      expect(id === "openai" ? settings.openaiKey() : settings.anthropicKey()).toEqual({
        key: FAKE_KEY,
        source: "file",
      });

      // Replace.
      const replaced = await send("PUT", { key: "sk-test-not-a-real-key-2222" });
      expect(row(replaced, id)).toEqual({ ready: true, status: "Key saved", keySource: "file" });
      expect(JSON.parse(readFileSync(file, "utf8"))[id]).toEqual({
        apiKey: "sk-test-not-a-real-key-2222",
      });

      // Remove: only this key goes; removing it again changes nothing.
      const removed = await send("DELETE");
      expect(row(removed, id)).toEqual({ ready: false, status: "No key", keySource: null });
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
        extra: 1,
        [other]: { apiKey: OTHER_KEY },
        roles: {},
      });
      await send("DELETE");
      expect(statSync(file).mode & 0o777).toBe(0o600);

      // No answer and no log line holds a key.
      bodies.push((await app.inject({ method: "GET", url: "/settings" })).body);
      expect(lines.length).toBeGreaterThan(0);
      for (const text of [...bodies, ...lines]) {
        for (const key of [FAKE_KEY, OTHER_KEY, "sk-test-not-a-real-key-2222"]) {
          expect(text).not.toContain(key);
        }
      }
    });
  }

  it("lets a key in the environment win over a saved one", async () => {
    const { app, file, lines } = loggedApp({ ANTHROPIC_API_KEY: ` ${ENV_KEY} ` });
    const before = (await app.inject({ method: "GET", url: "/settings" })).json();
    expect(row(before, "anthropic")).toEqual({
      ready: true,
      status: "Key set in the environment",
      keySource: "env",
    });
    expect(row(before, "openai")).toEqual({ ready: false, status: "No key", keySource: null });

    const res = await app.inject({
      method: "PUT",
      url: "/settings/providers/anthropic/key",
      payload: { key: FAKE_KEY },
    });
    expect(row(res.json(), "anthropic").keySource).toBe("env");
    expect(JSON.parse(readFileSync(file, "utf8")).anthropic.apiKey).toBe(FAKE_KEY);
    expect(new Settings(dirname(file), { ANTHROPIC_API_KEY: ENV_KEY }).anthropicKey()).toEqual({
      key: ENV_KEY,
      source: "env",
    });
    for (const text of [JSON.stringify(before), res.body, ...lines]) {
      expect(text).not.toContain(ENV_KEY);
      expect(text).not.toContain(FAKE_KEY);
    }
  });

  it("refuses Codex (422), an unknown provider (404) and a key of the wrong length", async () => {
    const { app, file, lines } = loggedApp();
    const answer = async (
      method: "PUT" | "DELETE",
      id: string,
      status: number,
      key: string = FAKE_KEY,
    ) => {
      const res = await app.inject({
        method,
        url: `/settings/providers/${id}/key`,
        ...(method === "PUT" && { payload: { key } }),
      });
      expect(res.statusCode, `${method} ${id}`).toBe(status);
      expect(res.body).not.toContain(key);
      return res.json();
    };
    expect((await answer("PUT", "codex", 422)).code).toBe("KEY_NOT_SUPPORTED");
    expect((await answer("DELETE", "codex", 422)).code).toBe("KEY_NOT_SUPPORTED");
    expect((await answer("PUT", "nope", 404)).code).toBe("NOT_FOUND");
    expect((await answer("DELETE", "nope", 404)).code).toBe("NOT_FOUND");
    // 8 to 400 characters once trimmed.
    await answer("PUT", "openai", 400, "  sk-test  ");
    await answer("PUT", "openai", 400, `sk-${"x".repeat(398)}`);
    await answer("PUT", "openai", 200, "sk-test-");
    await answer("PUT", "anthropic", 200, `sk-${"x".repeat(397)}`);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      openai: { apiKey: "sk-test-" },
      anthropic: { apiKey: `sk-${"x".repeat(397)}` },
    });
    for (const line of lines) expect(line).not.toContain("sk-test");
  });

  it("quotes no key from a config file that isn't JSON", async () => {
    const { app, file, lines } = loggedApp();
    writeFileSync(file, `{"anthropic": {"apiKey": "${FAKE_KEY}"`);
    const res = await app.inject({ method: "GET", url: "/settings" });
    expect(res.statusCode).toBe(500);
    expect(res.body).toContain("is not valid JSON");
    for (const text of [res.body, ...lines]) expect(text).not.toContain(FAKE_KEY);
  });
});

import { readFileSync } from "node:fs";
import {
  createAnthropicProvider,
  createCodexModelProvider,
  createFakeProvider,
  createOpenAIProvider,
  providerInfo,
  scriptByMessage,
} from "@jeeves/providers";
import type { Settings } from "../settings.ts";
import type { ModelSource } from "./service.ts";

/**
 * Real providers, picked per role in Settings. Credentials are read on every turn, so a newly set
 * key works without a restart.
 */
export function providerModels(settings: Settings, codexPath?: string): ModelSource {
  const codex = createCodexModelProvider(codexPath ? { codexPath } : {});
  return (role) => {
    const { provider, model } = settings.roles()[role];
    switch (provider) {
      case "openai": {
        const key = settings.openaiKey();
        if (!key) {
          return {
            error: `No OpenAI API key is set. Set OPENAI_API_KEY before starting Jeeves, or add {"openai": {"apiKey": "…"}} to ${settings.configPath}.`,
          };
        }
        return { provider: createOpenAIProvider({ apiKey: key.key }), model };
      }
      case "anthropic": {
        const key = settings.anthropicKey();
        if (!key)
          return {
            error:
              "No Anthropic API key is set. Set ANTHROPIC_API_KEY in the environment before starting Jeeves.",
          };
        return { provider: createAnthropicProvider({ apiKey: key }), model };
      }
      case "codex":
        if (!settings.codexLoggedIn()) {
          return {
            error: "Codex isn't logged in. Run `codex login` in a terminal, then try again.",
          };
        }
        return { provider: codex, model };
      default:
        return {
          error: `${providerInfo(provider)?.name ?? provider} can't be used for this. Pick another provider in Settings.`,
        };
    }
  };
}

/** The scripted fake provider, from a `scriptByMessage` JSON file (e2e tests). */
export function fakeModels(scriptPath: string): ModelSource {
  const provider = createFakeProvider(
    scriptByMessage(JSON.parse(readFileSync(scriptPath, "utf8"))),
  );
  return () => ({ provider, model: "fake" });
}

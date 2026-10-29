import { readFileSync } from "node:fs";
import { createFakeProvider, createOpenAIProvider, scriptByMessage } from "@jeeves/providers";
import type { Settings } from "../settings.ts";
import type { ModelSource } from "./service.ts";

/**
 * Real providers: OpenAI with the key from the environment or `~/.jeeves/config.json`, read on
 * every turn so a newly set key works without a restart.
 */
export function providerModels(settings: Settings): ModelSource {
  return (role) => {
    const key = settings.openaiKey();
    if (!key) {
      return {
        error: `No OpenAI API key is set. Set OPENAI_API_KEY before starting Jeeves, or add {"openai": {"apiKey": "…"}} to ${settings.configPath}.`,
      };
    }
    return { provider: createOpenAIProvider({ apiKey: key.key }), model: settings.models()[role] };
  };
}

/** The scripted fake provider, from a `scriptByMessage` JSON file (e2e tests). */
export function fakeModels(scriptPath: string): ModelSource {
  const provider = createFakeProvider(
    scriptByMessage(JSON.parse(readFileSync(scriptPath, "utf8"))),
  );
  return () => ({ provider, model: "fake" });
}

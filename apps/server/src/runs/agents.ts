/**
 * The coding agent for task execution (PLAN §12): the `coding` role's provider and model from
 * Settings, or a scripted fake for e2e tests. Codex uses its own credentials (`codex login`).
 */
import { readFileSync } from "node:fs";
import type { CodingAgentSource } from "@jeeves/orchestrator";
import {
  codingScriptByTask,
  createCodexAgent,
  createFakeCodingAgent,
  providerInfo,
} from "@jeeves/providers";
import type { Settings } from "../settings.ts";

/** `codexPath` replaces the `codex` binary bundled with the SDK (`JEEVES_CODEX_PATH`). */
export function codingAgents(settings: Settings, codexPath?: string): CodingAgentSource {
  const codex = createCodexAgent(codexPath ? { codexPath } : {});
  return () => {
    const { provider, model } = settings.roles().coding;
    if (provider === "codex") return { agent: codex, model };
    return {
      error: `${providerInfo(provider)?.name ?? provider} can't run coding tasks. Pick another provider in Settings.`,
    };
  };
}

/** The scripted fake agent, from a `codingScriptByTask` JSON file (e2e tests). */
export function fakeCodingAgents(scriptPath: string): CodingAgentSource {
  const agent = createFakeCodingAgent(
    codingScriptByTask(JSON.parse(readFileSync(scriptPath, "utf8"))),
  );
  return () => ({ agent, model: "fake" });
}

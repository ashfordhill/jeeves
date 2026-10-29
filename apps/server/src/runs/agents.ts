/**
 * The coding agent for task execution (PLAN §12): Codex, with the `coding` role's model from
 * Settings, or a scripted fake for e2e tests. Codex uses its own credentials (`codex login`).
 */
import { readFileSync } from "node:fs";
import type { CodingAgentSource } from "@jeeves/orchestrator";
import { codingScriptByTask, createCodexAgent, createFakeCodingAgent } from "@jeeves/providers";
import type { Settings } from "../settings.ts";

/** `codexPath` replaces the `codex` binary bundled with the SDK (`JEEVES_CODEX_PATH`). */
export function codexAgents(settings: Settings, codexPath?: string): CodingAgentSource {
  const agent = createCodexAgent(codexPath ? { codexPath } : {});
  return () => ({ agent, model: settings.models().coding });
}

/** The scripted fake agent, from a `codingScriptByTask` JSON file (e2e tests). */
export function fakeCodingAgents(scriptPath: string): CodingAgentSource {
  const agent = createFakeCodingAgent(
    codingScriptByTask(JSON.parse(readFileSync(scriptPath, "utf8"))),
  );
  return () => ({ agent, model: "fake" });
}

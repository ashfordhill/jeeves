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
  createOpenCodeAgent,
  providerInfo,
} from "@jeeves/providers";
import type { Settings } from "../settings.ts";

/**
 * `codexPath`/`opencodePath` replace the binaries Jeeves would otherwise use
 * (`JEEVES_CODEX_PATH`/`JEEVES_OPENCODE_PATH`).
 */
export function codingAgents(
  settings: Settings,
  codexPath?: string,
  opencodePath?: string,
): CodingAgentSource {
  const codex = createCodexAgent(codexPath ? { codexPath } : {});
  const opencode = createOpenCodeAgent(opencodePath ? { opencodePath } : {});
  return () => {
    const { provider, model, reasoningEffort } = settings.roles().coding;
    const effort = reasoningEffort ? { reasoningEffort } : {};
    if (provider === "codex") return { agent: codex, model, ...effort };
    if (provider === "opencode") return { agent: opencode, model, ...effort };
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

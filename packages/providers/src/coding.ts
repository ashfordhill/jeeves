/**
 * Provider-neutral coding-agent interface (PLAN §12). The orchestrator starts one session per task
 * attempt in the project folder, streams its events, and interrupts it through the abort signal.
 * Codex is the first adapter; a Claude adapter would be another file implementing the same thing.
 */
import type { Usage } from "./types.ts";

export type CodingAgentEvent =
  | { type: "usage"; usage: Usage }
  /** The session's ID, as soon as the provider reports it (used to resume the session). */
  | { type: "session"; sessionId: string }
  | { type: "message"; text: string }
  | { type: "reasoning"; text: string }
  | {
      type: "command";
      command: string;
      status: "running" | "completed" | "failed";
      exitCode?: number;
      /** The end of the command's output, once it finished. */
      output?: string;
    }
  | { type: "files"; changes: { path: string; kind: "add" | "delete" | "update" }[] }
  | { type: "todo"; items: { text: string; done: boolean }[] }
  /** A non-fatal problem the agent reported and carried on from. */
  | { type: "warning"; text: string };

export type CodingSessionRequest = {
  /** The project folder; the agent's sandbox is limited to it. */
  workingDirectory: string;
  /** The task brief for a new session, or the follow-up message for a resumed one. */
  prompt: string;
  /** Model name from Settings (`coding` role); the provider's default when empty. */
  model?: string;
  /** Continue an earlier session instead of starting a new one (needs `capabilities.resume`). */
  resumeSessionId?: string;
};

export type CodingSessionResult = {
  sessionId: string | null;
  /** The agent's last message. A model's "done" is never evidence; Jeeves runs the checks. */
  finalMessage: string;
  /** `null` when the provider didn't report usage. */
  usage: Usage | null;
};

export type CodingAgentCapabilities = {
  resume: boolean;
  usage: boolean;
  streaming: boolean;
};

export type CodingRunOptions = {
  /** Aborting interrupts the session. */
  signal?: AbortSignal;
  onEvent?: (event: CodingAgentEvent) => void;
};

export interface CodingAgentProvider {
  readonly id: string;
  readonly capabilities: CodingAgentCapabilities;
  /**
   * Runs one session (or one more turn of a resumed session) until the agent stops. Throws a
   * `ProviderError` for provider problems (credentials, quota, a crashed agent).
   */
  run(request: CodingSessionRequest, options?: CodingRunOptions): Promise<CodingSessionResult>;
}

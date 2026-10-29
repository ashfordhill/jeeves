/**
 * Codex adapter for `CodingAgentProvider`, on the open-source Codex SDK (`@openai/codex-sdk`),
 * which runs `codex exec` and streams its JSONL events. Sessions (Codex "threads") can be resumed,
 * which is how a retry sends the failed checks back to the same session.
 *
 * Credentials are Codex's own: `codex login` (ChatGPT or an API key), or `CODEX_API_KEY`.
 */
import {
  Codex,
  type Input,
  type ThreadEvent,
  type ThreadItem,
  type ThreadOptions,
} from "@openai/codex-sdk";
import type { CodingAgentEvent, CodingAgentProvider, CodingSessionResult } from "./coding.ts";
import { ProviderError, type ProviderErrorKind } from "./errors.ts";
import type { Usage } from "./types.ts";

export const CODEX = "codex";

/** The part of the SDK's `Thread` the adapter uses, so tests can replay recorded events. */
export type CodexThreadLike = {
  readonly id: string | null;
  runStreamed(
    input: Input,
    options?: { signal?: AbortSignal; outputSchema?: unknown },
  ): Promise<{ events: AsyncGenerator<ThreadEvent> }>;
};

export type CodexLike = {
  startThread(options?: ThreadOptions): CodexThreadLike;
  resumeThread(id: string, options?: ThreadOptions): CodexThreadLike;
};

export type CodexAgentOptions = {
  /** A `codex` binary to use instead of the one bundled with the SDK (`JEEVES_CODEX_PATH`). */
  codexPath?: string;
  /** Replaces the SDK (tests). */
  codex?: CodexLike;
};

const OUTPUT_TAIL = 4000;

export function createCodexAgent(options: CodexAgentOptions = {}): CodingAgentProvider {
  const codex: CodexLike =
    options.codex ??
    new Codex(options.codexPath ? { codexPathOverride: options.codexPath } : undefined);
  return {
    id: CODEX,
    capabilities: { resume: true, usage: true, streaming: true },
    async run(request, { signal, onEvent } = {}): Promise<CodingSessionResult> {
      const threadOptions: ThreadOptions = {
        workingDirectory: request.workingDirectory,
        // Writes are limited to the project folder; Jeeves never asks the person to approve
        // commands mid-task. The network stays on so `pnpm install` can fetch packages.
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: true,
        skipGitRepoCheck: true,
        ...(request.model ? { model: request.model } : {}),
      };
      const thread = request.resumeSessionId
        ? codex.resumeThread(request.resumeSessionId, threadOptions)
        : codex.startThread(threadOptions);
      const emit = onEvent ?? (() => {});
      let sessionId = request.resumeSessionId ?? null;
      let finalMessage = "";
      let usage: Usage | null = null;
      try {
        const { events } = await thread.runStreamed(request.prompt, signal ? { signal } : {});
        for await (const event of events) {
          switch (event.type) {
            case "thread.started":
              sessionId = event.thread_id;
              emit({ type: "session", sessionId });
              break;
            case "turn.completed":
              usage = {
                inputTokens: event.usage.input_tokens,
                outputTokens: event.usage.output_tokens,
                cachedInputTokens: event.usage.cached_input_tokens,
              };
              break;
            case "turn.failed":
              throw codexError(event.error.message);
            case "error":
              throw codexError(event.message);
            case "item.started":
            case "item.completed": {
              const mapped = mapItem(
                event.item,
                event.type === "item.completed",
                request.workingDirectory,
              );
              if (mapped) emit(mapped);
              if (event.type === "item.completed" && event.item.type === "agent_message") {
                finalMessage = event.item.text;
              }
              break;
            }
            default:
              break;
          }
        }
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        if (signal?.aborted) {
          throw new ProviderError(CODEX, "other", "The Codex session was interrupted.", {
            cause: error,
          });
        }
        throw codexError(error instanceof Error ? error.message : String(error), error);
      }
      return { sessionId: thread.id ?? sessionId, finalMessage, usage };
    },
  };
}

function mapItem(
  item: ThreadItem,
  completed: boolean,
  workingDirectory: string,
): CodingAgentEvent | undefined {
  switch (item.type) {
    case "agent_message":
      return completed ? { type: "message", text: item.text } : undefined;
    case "reasoning":
      return completed && item.text ? { type: "reasoning", text: item.text } : undefined;
    case "command_execution":
      return {
        type: "command",
        command: item.command,
        status: !completed
          ? "running"
          : item.status === "failed" || (item.exit_code ?? 0) !== 0
            ? "failed"
            : "completed",
        ...(item.exit_code === undefined ? {} : { exitCode: item.exit_code }),
        ...(completed && item.aggregated_output
          ? { output: item.aggregated_output.slice(-OUTPUT_TAIL) }
          : {}),
      };
    case "file_change":
      // Codex reports absolute paths; show them relative to the project.
      return completed
        ? {
            type: "files",
            changes: item.changes.map((c) => ({
              ...c,
              path: relativeTo(workingDirectory, c.path),
            })),
          }
        : undefined;
    case "todo_list":
      return {
        type: "todo",
        items: item.items.map((t) => ({ text: t.text, done: t.completed })),
      };
    case "error":
      return { type: "warning", text: item.message };
    case "mcp_tool_call":
      return completed
        ? { type: "command", command: `${item.server}.${item.tool}`, status: "completed" }
        : undefined;
    case "web_search":
      return completed
        ? { type: "command", command: `search: ${item.query}`, status: "completed" }
        : undefined;
  }
}

function relativeTo(root: string, path: string): string {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** Maps a Codex failure message to a `ProviderError` kind (Codex reports errors as text). */
export function codexError(message: string, cause?: unknown): ProviderError {
  const text = message.toLowerCase();
  let kind: ProviderErrorKind = "other";
  if (/\b401\b|\b403\b|unauthori[sz]ed|not logged in|login|authenticat|api key/.test(text)) {
    kind = "auth";
  } else if (/quota|usage limit|insufficient|billing|credits/.test(text)) {
    kind = "quota";
  } else if (/rate limit|\b429\b|too many requests/.test(text)) {
    kind = "rate-limit";
  } else if (/enoent|spawn|unsupported platform/.test(text)) {
    kind = "unavailable";
  } else if (/\b5\d\d\b|stream disconnected|network|timed out|connection/.test(text)) {
    kind = "unavailable";
  }
  return new ProviderError(CODEX, kind, `Codex: ${message.trim()}`, cause ? { cause } : undefined);
}

/**
 * OpenCode CLI adapter for `CodingAgentProvider`. It drives `opencode run --format json`
 * (OpenCode 2 removed `--dir`), so the working directory is the child's cwd. Sessions resume with
 * `--session <id>`. Jeeves never sees OpenCode's provider credentials.
 *
 * OpenCode has no sandbox. `--auto` approves tool calls; Jeeves's owned-path revert and task branch
 * are the guard. The stream is one JSON object per line: `step_start`, `text`, `tool_use`,
 * `step_finish` (tokens/cost), and errors.
 */
import { spawn } from "node:child_process";
import type { CodingAgentProvider, CodingSessionRequest, CodingSessionResult } from "./coding.ts";
import { ProviderError, type ProviderErrorKind } from "./errors.ts";
import type { Usage } from "./types.ts";

export const OPENCODE = "opencode";

export type OpenCodeAgentOptions = {
  /** An `opencode` binary instead of the one on PATH (`JEEVES_OPENCODE_PATH`). */
  opencodePath?: string;
  /** How long the post-run `session export` may take (default 30 s). */
  exportTimeoutMs?: number;
};

type ToolPart = {
  type?: string;
  text?: string;
  messageID?: string;
  tool?: string;
  state?: {
    status?: string;
    input?: { command?: string; path?: string };
    output?: string;
    title?: string;
    metadata?: { metadata?: { exit?: number } };
  };
};

type StreamEvent = {
  type?: string;
  sessionID?: string;
  error?: { type?: string; message?: string; data?: { message?: string } };
  part?: ToolPart & {
    cost?: number;
    tokens?: { input?: number; output?: number; cache?: { read?: number } };
  };
};

type AssistantMessage = {
  id?: string;
  type?: string;
  cost?: number;
  tokens?: { input?: number; output?: number; cache?: { read?: number } };
  content?: { type?: string; text?: string }[];
};

type ExportMessage = AssistantMessage & {
  role?: string;
  info?: {
    id?: string;
    role?: string;
    tokens?: AssistantMessage["tokens"];
    cost?: number;
  };
  parts?: { type?: string; text?: string }[];
};

type ExportSession = {
  info?: { tokens?: AssistantMessage["tokens"]; cost?: number };
  messages?: ExportMessage[];
};

type Totals = {
  input: number;
  output: number;
  cached: number;
  cost: number;
  costKnown: boolean;
  any: boolean;
};

const emptyTotals = (): Totals => ({
  input: 0,
  output: 0,
  cached: 0,
  cost: 0,
  costKnown: false,
  any: false,
});

function addUsage(totals: Totals, usage: AssistantMessage): void {
  const input = usage.tokens?.input ?? 0;
  const output = usage.tokens?.output ?? 0;
  const cached = usage.tokens?.cache?.read ?? 0;
  if (input || output || cached) totals.any = true;
  totals.input += input;
  totals.output += output;
  totals.cached += cached;
  if (typeof usage.cost === "number") {
    totals.cost += usage.cost;
    totals.costKnown = true;
    totals.any = true;
  }
}

function toUsage(totals: Totals): Usage | null {
  if (!totals.any) return null;
  return {
    inputTokens: totals.input,
    outputTokens: totals.output,
    ...(totals.cached > 0 && { cachedInputTokens: totals.cached }),
    ...(totals.costKnown && { costUsd: totals.cost }),
  };
}

const FILE_TOOLS = new Set(["write", "edit", "patch", "multiedit", "delete"]);

export function createOpenCodeAgent(options: OpenCodeAgentOptions = {}): CodingAgentProvider {
  const bin = options.opencodePath ?? "opencode";
  const exportTimeoutMs = options.exportTimeoutMs ?? 30_000;
  let versionPromise: Promise<number | null> | undefined;
  const majorVersion = () => (versionPromise ??= detectMajor(bin));
  return {
    id: OPENCODE,
    capabilities: { resume: true, usage: true, streaming: true },
    async run(request, { signal, onEvent } = {}): Promise<CodingSessionResult> {
      const emit = onEvent ?? (() => {});
      const args = ["run", "--format", "json", "--auto"];
      const major = await majorVersion();
      // v1 exposes `--variant`; v2 selects it with `--model provider/model#variant`. A model
      // written with `#…` works with both and is not doubled when the select is also set.
      const [baseModel = "", inlineEffort] = (request.model ?? "").split("#");
      const effort = request.reasoningEffort ?? (inlineEffort || undefined);
      if (effort && !baseModel && major !== 1)
        throw new ProviderError(
          OPENCODE,
          "bad-request",
          "OpenCode needs an Implementation model to choose a reasoning effort.",
        );
      if (baseModel) {
        const model = effort && major !== 1 ? `${baseModel}#${effort}` : baseModel;
        args.push("--model", model);
        if (effort && major === 1) args.push("--variant", effort);
      } else if (effort && major === 1) {
        args.push("--variant", effort);
      }
      if (request.resumeSessionId) args.push("--session", request.resumeSessionId);
      args.push(request.prompt);

      let sessionId = request.resumeSessionId ?? null;
      let sawSession = false;
      let finalMessage = "";
      let finalMessageId: string | undefined;
      let streamError: string | undefined;
      const finished = new Set<string>();
      const totals = emptyTotals();
      const toolEvents = (event: StreamEvent): void => {
        if (event.type === "error") {
          streamError =
            event.error?.message ??
            event.error?.data?.message ??
            event.part?.text ??
            "OpenCode reported an error";
          return;
        }
        const part = event.part;
        if (!part) return;
        if (event.type === "text") {
          if (part.text) {
            finalMessage = part.text;
            finalMessageId = part.messageID;
            emit({ type: "message", text: part.text });
          }
          return;
        }
        if (event.type === "reasoning") {
          if (part.text) emit({ type: "reasoning", text: part.text });
          return;
        }
        if (event.type === "step_finish") {
          if (part.messageID) finished.add(part.messageID);
          addUsage(totals, { tokens: part.tokens, cost: part.cost });
          return;
        }
        if (event.type === "tool_use") {
          const state = part.state;
          const command = state?.input?.command;
          const path = state?.input?.path;
          if (part.tool === "shell" || command) {
            emit({
              type: "command",
              command: command ?? part.tool ?? "tool",
              status:
                state?.status === "completed"
                  ? "completed"
                  : state?.status === "error" || state?.status === "failed"
                    ? "failed"
                    : "running",
              ...(typeof state?.metadata?.metadata?.exit === "number" && {
                exitCode: state.metadata.metadata.exit,
              }),
              ...(state?.output && { output: state.output.slice(-4000) }),
            });
          } else if (FILE_TOOLS.has(part.tool ?? "") && path) {
            emit({
              type: "files",
              changes: [
                {
                  path: relativeTo(request.workingDirectory, path),
                  kind:
                    part.tool === "delete"
                      ? "delete"
                      : state?.output?.startsWith("Created")
                        ? "add"
                        : "update",
                },
              ],
            });
          } else {
            emit({
              type: "command",
              command: path
                ? `${part.tool ?? "tool"}: ${relativeTo(request.workingDirectory, path)}`
                : (part.tool ?? state?.title ?? "tool"),
              status: state?.status === "completed" ? "completed" : "running",
            });
          }
          return;
        }
        if (event.type === "error" || part.type === "error") {
          const text = part.text ?? stateText(part);
          if (text) streamError = text;
        }
      };

      const result = await runProcess(bin, args, {
        cwd: request.workingDirectory,
        signal,
        onLine: (line) => {
          const event = parseEvent(line);
          if (!event) return;
          if (event.sessionID && !sawSession) {
            sawSession = true;
            sessionId = event.sessionID;
            emit({ type: "session", sessionId: event.sessionID });
          }
          toolEvents(event);
        },
      });
      if (signal?.aborted)
        throw new ProviderError(OPENCODE, "other", "The OpenCode session was interrupted.");
      if (result.code !== 0) throw opencodeError(`${result.stdout}\n${result.stderr}`);
      if (streamError) throw opencodeError(streamError);
      if (sessionId && (finalMessageId ? !finished.has(finalMessageId) : !totals.any)) {
        const exported = await exportSession(
          bin,
          request,
          sessionId,
          exportTimeoutMs,
          major,
          signal,
        );
        const last = exported?.messages
          ?.map(assistantMessage)
          .filter((message): message is AssistantMessage => message !== undefined)
          .at(-1);
        if (last) {
          if (finalMessageId && !finished.has(finalMessageId)) addUsage(totals, last);
          if (!finalMessage) finalMessage = messageText(last);
        }
      }
      return {
        sessionId: sessionId ?? null,
        finalMessage,
        usage: toUsage(totals),
      };
    },
  };
}

/** OpenCode 1 prints `1.19.5`; OpenCode 2 prints `opencode v2.2.2`. Unknown means v2. */
async function detectMajor(bin: string): Promise<number | null> {
  try {
    const result = await runProcess(bin, ["--version"], {
      cwd: process.cwd(),
      timeoutMs: 5000,
    });
    if (result.code !== 0) return null;
    const match = /(?:^|\s)v?(\d+)\./.exec(result.stdout.trim());
    return match?.[1] ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function parseEvent(line: string): StreamEvent | undefined {
  const text = line.trim();
  if (!text.startsWith("{")) return undefined;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" ? (value as StreamEvent) : undefined;
  } catch {
    return undefined;
  }
}

function stateText(part: ToolPart): string {
  return part.state?.output ?? "";
}

function messageText(message: AssistantMessage): string {
  return (message.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

/** v2 uses `{type:"assistant", content}`; v1 nests `{info:{role}, parts}`. */
function assistantMessage(entry: ExportMessage): AssistantMessage | undefined {
  if (entry.info?.role === "assistant")
    return {
      id: entry.info.id,
      type: "assistant",
      tokens: entry.info.tokens,
      cost: entry.info.cost,
      content: (entry.parts ?? []).map((part) => ({ type: part.type, text: part.text })),
    };
  return entry.type === "assistant" ? entry : undefined;
}

function relativeTo(root: string, path: string): string {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

async function exportSession(
  bin: string,
  request: CodingSessionRequest,
  sessionId: string,
  timeoutMs: number,
  major: number | null,
  signal?: AbortSignal,
): Promise<ExportSession | undefined> {
  try {
    const args = major === 1 ? ["export", sessionId] : ["session", "export", sessionId];
    const result = await runProcess(bin, args, {
      cwd: request.workingDirectory,
      timeoutMs,
      ...(signal && { signal }),
    });
    if (result.code !== 0) return undefined;
    const text = result.stdout.trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    return JSON.parse(text.slice(start, end + 1)) as ExportSession;
  } catch {
    return undefined;
  }
}

/** A child process in its own group; an abort or timeout kills the group, not only the child. */
function runProcess(
  bin: string,
  args: string[],
  options: {
    cwd: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    onLine?: (line: string) => void;
  },
): Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let partial = "";
    let timedOut = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;
    const killGroup = () => {
      if (!child.pid || killTimer) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
      killTimer = setTimeout(() => {
        if (!child.pid) return;
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      }, 5000);
      killTimer.unref();
    };
    const cleanup = () => {
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      options.signal?.removeEventListener("abort", killGroup);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout = (stdout + text).slice(-64 * 1024);
      if (!options.onLine) return;
      const lines = (partial + text).split(/\r?\n|\r/);
      partial = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) options.onLine(line);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-64 * 1024);
    });
    if (options.timeoutMs) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        killGroup();
      }, options.timeoutMs);
      timeoutTimer.unref();
    }
    options.signal?.addEventListener("abort", killGroup, { once: true });
    if (options.signal?.aborted) killGroup();
    const settle = (code: number) => {
      if (settled) return;
      cleanup();
      if (partial.trim()) options.onLine?.(partial);
      resolve({ code, stdout, stderr, timedOut });
    };
    child.on("error", (error) => {
      stderr = `${stderr}\n${error.message}`.slice(-64 * 1024);
      settle(127);
    });
    child.on("close", (code, signal) => settle(code ?? (signal ? 128 : 1)));
  });
}

/** Maps OpenCode's stderr/exit text to a `ProviderError` kind. */
export function opencodeError(message: string, cause?: unknown): ProviderError {
  const text = message.toLowerCase();
  let kind: ProviderErrorKind = "other";
  if (/\b401\b|\b403\b|unauthori[sz]ed|not logged in|login|api key/.test(text)) {
    kind = "auth";
  } else if (/insufficient|quota|credit|balance|billing|usage limit/.test(text)) {
    kind = "quota";
  } else if (/\b429\b|rate limit|too many requests/.test(text)) {
    kind = "rate-limit";
  } else if (/enoent|spawn|not found|unsupported platform|unavailable|no-route/.test(text)) {
    kind = "unavailable";
  } else if (
    /\b(?:status|http)\s*5\d\d\b|stream disconnected|network|timed out|connection/.test(text)
  ) {
    kind = "unavailable";
  }
  return new ProviderError(
    OPENCODE,
    kind,
    `OpenCode: ${message.trim()}`,
    cause ? { cause } : undefined,
  );
}

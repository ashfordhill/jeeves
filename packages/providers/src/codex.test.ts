import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { CODEX, type CodexLike, codexError, createCodexAgent } from "./codex.ts";
import type { CodingAgentEvent } from "./coding.ts";
import { ProviderError } from "./errors.ts";
import { codingScriptByTask, createFakeCodingAgent } from "./fake-coding.ts";

/** Replays recorded `codex exec` events. */
function recorded(events: ThreadEvent[]) {
  const calls: {
    kind: "start" | "resume";
    id?: string;
    options?: ThreadOptions;
    input?: string;
  }[] = [];
  const thread = (call: (typeof calls)[number]) => ({
    id: call.id ?? null,
    async runStreamed(input: string) {
      call.input = input;
      return {
        events: (async function* () {
          for (const event of events) yield event;
        })(),
      };
    },
  });
  const codex: CodexLike = {
    startThread(options) {
      const call = { kind: "start" as const, ...(options ? { options } : {}) };
      calls.push(call);
      return thread(call);
    },
    resumeThread(id, options) {
      const call = { kind: "resume" as const, id, ...(options ? { options } : {}) };
      calls.push(call);
      return thread(call);
    },
  };
  return { codex, calls };
}

const turn: ThreadEvent[] = [
  { type: "thread.started", thread_id: "thr_1" },
  { type: "turn.started" },
  { type: "item.completed", item: { id: "r", type: "reasoning", text: "Looking at the guide" } },
  {
    type: "item.started",
    item: {
      id: "c",
      type: "command_execution",
      command: "pnpm test",
      aggregated_output: "",
      status: "in_progress",
    },
  },
  {
    type: "item.completed",
    item: {
      id: "c",
      type: "command_execution",
      command: "pnpm test",
      aggregated_output: "1 failed",
      exit_code: 1,
      status: "failed",
    },
  },
  {
    type: "item.completed",
    item: {
      id: "f",
      type: "file_change",
      changes: [{ path: "/p/src/a.ts", kind: "add" }],
      status: "completed",
    },
  },
  { type: "item.completed", item: { id: "m", type: "agent_message", text: "Implemented it." } },
  {
    type: "turn.completed",
    usage: {
      input_tokens: 5000,
      cached_input_tokens: 4000,
      cache_write_input_tokens: 0,
      output_tokens: 300,
      reasoning_output_tokens: 100,
    },
  },
];

describe("Codex adapter", () => {
  it("starts a sandboxed session, maps events, and reports usage", async () => {
    const { codex, calls } = recorded(turn);
    const events: CodingAgentEvent[] = [];
    const agent = createCodexAgent({ codex });
    const result = await agent.run(
      { workingDirectory: "/p", prompt: "Brief", model: "gpt-5.1-codex" },
      { onEvent: (e) => events.push(e) },
    );
    expect(calls[0]).toEqual({
      kind: "start",
      input: "Brief",
      options: {
        workingDirectory: "/p",
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: true,
        skipGitRepoCheck: true,
        model: "gpt-5.1-codex",
      },
    });
    expect(result).toEqual({
      sessionId: "thr_1",
      finalMessage: "Implemented it.",
      usage: { inputTokens: 5000, outputTokens: 300, cachedInputTokens: 4000 },
    });
    expect(events).toEqual([
      { type: "session", sessionId: "thr_1" },
      { type: "reasoning", text: "Looking at the guide" },
      { type: "command", command: "pnpm test", status: "running" },
      { type: "command", command: "pnpm test", status: "failed", exitCode: 1, output: "1 failed" },
      { type: "files", changes: [{ path: "src/a.ts", kind: "add" }] },
      { type: "message", text: "Implemented it." },
      { type: "usage", usage: { inputTokens: 5000, outputTokens: 300, cachedInputTokens: 4000 } },
    ]);
  });

  it("resumes a session by ID", async () => {
    const { codex, calls } = recorded(turn.slice(1));
    const result = await createCodexAgent({ codex }).run({
      workingDirectory: "/p",
      prompt: "Fix the tests",
      resumeSessionId: "thr_1",
    });
    expect(calls[0]).toMatchObject({ kind: "resume", id: "thr_1", input: "Fix the tests" });
    expect(calls[0]?.options?.model).toBeUndefined();
    expect(result.sessionId).toBe("thr_1");
  });

  it("turns a failed turn into a ProviderError of the right kind", async () => {
    const { codex } = recorded([
      { type: "thread.started", thread_id: "t" },
      { type: "turn.failed", error: { message: "You've hit your usage limit." } },
    ]);
    await expect(
      createCodexAgent({ codex }).run({ workingDirectory: "/p", prompt: "x" }),
    ).rejects.toMatchObject({ kind: "quota", blocksProvider: true });
    expect(codexError("unexpected status 401 Unauthorized").kind).toBe("auth");
    expect(codexError("stream disconnected before completion").kind).toBe("unavailable");
    expect(codexError("exceeded retry limit, last status: 429 Too Many Requests").kind).toBe(
      "rate-limit",
    );
    expect(codexError("unexpected status 503 Service Unavailable").kind).toBe("unavailable");
    expect(codexError("HTTP 502 Bad Gateway").kind).toBe("unavailable");
    expect(codexError("Codex Exec exited with code 1: 500 lines of logs").kind).toBe("other");
    expect(codexError("Codex Exec exited with code 1: something odd").kind).toBe("other");
  });

  it("backs off once inside the attempt for a rate limit and reports the retry", async () => {
    let calls = 0;
    const codex: CodexLike = {
      startThread() {
        return {
          id: "thr_1",
          async runStreamed() {
            calls++;
            if (calls === 1) throw new ProviderError(CODEX, "rate-limit", "Codex: slow down");
            return {
              events: (async function* () {
                for (const event of turn) yield event;
              })(),
            };
          },
        };
      },
      resumeThread() {
        throw new Error("not used");
      },
    };
    const events: CodingAgentEvent[] = [];
    const result = await createCodexAgent({ codex, retryDelayMs: 0 }).run(
      { workingDirectory: "/p", prompt: "Go" },
      { onEvent: (event) => events.push(event) },
    );
    expect(calls).toBe(2);
    expect(result).toMatchObject({ sessionId: "thr_1", finalMessage: "Implemented it." });
    expect(events).toContainEqual({
      type: "warning",
      text: "Codex is rate-limit; retrying once in 0 s.",
    });
  });

  it("still fails after the one backoff when the provider stays unavailable", async () => {
    let calls = 0;
    const codex: CodexLike = {
      startThread() {
        return {
          id: null,
          async runStreamed() {
            calls++;
            throw new ProviderError(CODEX, "unavailable", "Codex: stream disconnected");
          },
        };
      },
      resumeThread() {
        throw new Error("not used");
      },
    };
    await expect(
      createCodexAgent({ codex, retryDelayMs: 0 }).run({
        workingDirectory: "/p",
        prompt: "Go",
      }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(calls).toBe(2);
  });
});

describe("fake coding agent", () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-fake-agent-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("applies scripted edits, reports events and usage, and fails when scripted", async () => {
    const agent = createFakeCodingAgent([
      { write: { "a/b.txt": "one\n" }, append: { "a/b.txt": "two\n" }, message: "Wrote it" },
      { error: "auth" },
    ]);
    const events: CodingAgentEvent[] = [];
    const result = await agent.run(
      { workingDirectory: dir, prompt: "go" },
      { onEvent: (e) => events.push(e) },
    );
    expect(readFileSync(join(dir, "a/b.txt"), "utf8")).toBe("one\ntwo\n");
    expect(result).toEqual({
      sessionId: "fake-session-0",
      finalMessage: "Wrote it",
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    expect(events.map((e) => e.type)).toEqual(["session", "files", "message"]);
    await expect(agent.run({ workingDirectory: dir, prompt: "go" })).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(
      createFakeCodingAgent([{ write: { "../x": "no" } }]).run({
        workingDirectory: dir,
        prompt: "",
      }),
    ).rejects.toThrow(/outside/);
  });

  it("a by-task script picks the step by task key and attempt", async () => {
    const script = codingScriptByTask({
      tasks: [{ task: "links", attempts: [{ message: "first" }, { message: "second" }] }],
      default: { message: "other" },
    });
    const pick = (prompt: string) =>
      typeof script === "function" ? script({ workingDirectory: dir, prompt }, 0) : undefined;
    expect(pick("Jeeves task: links, attempt 1\n...")?.message).toBe("first");
    expect(pick("Jeeves task: links, attempt 2\n...")?.message).toBe("second");
    expect(pick("Jeeves task: links, attempt 5\n...")?.message).toBe("second");
    expect(pick("Jeeves task: web, attempt 1")?.message).toBe("other");
  });
});

import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createOpenCodeAgent, opencodeError } from "./opencode.ts";

const root = mkdtempSync(join(tmpdir(), "jeeves-opencode-"));
const specPath = join(root, "spec.json");
const argsPath = join(root, "args.json");
const cwdPath = join(root, "cwd.txt");
const pidPath = join(root, "pid");
const binPath = join(root, "fake-opencode");

writeFileSync(
  binPath,
  `#!/usr/bin/env node
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const spec = JSON.parse(fs.readFileSync(process.env.FAKE_OPENCODE_SPEC, "utf8"));
const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log(spec.version ?? "2.2.2");
  process.exit(0);
}
if (args[0] === "session" && args[1] === "export") {
  process.stdout.write(JSON.stringify(spec.export ?? {}));
  process.exit(0);
}
if (args[0] === "export") {
  process.stdout.write(JSON.stringify(spec.exportV1 ?? {}));
  process.exit(0);
}
fs.writeFileSync(spec.argsFile ?? ${JSON.stringify(argsPath)}, JSON.stringify(args));
fs.writeFileSync(spec.cwdFile ?? ${JSON.stringify(cwdPath)}, process.cwd());
if (spec.abort) {
  const child = spawn("sleep", ["60"], { stdio: "ignore" });
  fs.writeFileSync(spec.pidFile ?? ${JSON.stringify(pidPath)}, String(child.pid));
  for (const event of spec.events ?? []) console.log(JSON.stringify(event));
  setInterval(() => {}, 1000);
} else {
  if (spec.stderr) process.stderr.write(spec.stderr);
  for (const event of spec.events ?? []) console.log(JSON.stringify(event));
  process.exit(spec.exitCode ?? 0);
}
`,
);
chmodSync(binPath, 0o755);

function spec(value: Record<string, unknown>): void {
  writeFileSync(
    specPath,
    JSON.stringify({ argsFile: argsPath, cwdFile: cwdPath, pidFile: pidPath, ...value }),
  );
}

afterEach(() => {
  process.env.FAKE_OPENCODE_SPEC = specPath;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const session = (id: string) => ({
  type: "step_start",
  sessionID: id,
  part: { type: "step-start" },
});

describe("OpenCode adapter", () => {
  it("captures the session, maps text/tool events, resumes, and sums usage", async () => {
    spec({
      events: [
        session("ses_1"),
        {
          type: "tool_use",
          sessionID: "ses_1",
          part: {
            type: "tool",
            tool: "shell",
            state: {
              status: "completed",
              input: { command: "ls -1" },
              output: "a.txt\n",
              title: "shell",
              metadata: { metadata: { exit: 0 } },
            },
          },
        },
        {
          type: "tool_use",
          sessionID: "ses_1",
          part: {
            type: "tool",
            tool: "write",
            state: {
              status: "completed",
              input: { path: `${root}/written.txt` },
              output: "Created file successfully: written.txt",
            },
          },
        },
        {
          type: "tool_use",
          sessionID: "ses_1",
          part: {
            type: "tool",
            tool: "read",
            state: {
              status: "completed",
              input: { path: `${root}/hello.txt` },
              output: "Read file hello.txt, lines 1-1\n1: hi",
            },
          },
        },
        {
          type: "step_finish",
          sessionID: "ses_1",
          part: {
            type: "step-finish",
            messageID: "m1",
            cost: 0.01,
            tokens: { input: 100, output: 20, cache: { read: 5 } },
          },
        },
        {
          type: "text",
          sessionID: "ses_1",
          part: { type: "text", messageID: "m2", text: "Done" },
        },
      ],
      export: {
        messages: [
          {
            id: "m2",
            type: "assistant",
            cost: 0.02,
            tokens: { input: 10, output: 5, cache: { read: 2 } },
            content: [{ type: "text", text: "Done" }],
          },
        ],
      },
    });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    const events: unknown[] = [];
    const result = await createOpenCodeAgent({ opencodePath: binPath }).run(
      {
        workingDirectory: root,
        prompt: "Fix it",
        model: "deepseek/deepseek-flash",
        reasoningEffort: "high",
        resumeSessionId: "ses_prev",
      },
      { onEvent: (event) => events.push(event) },
    );
    expect(result).toEqual({
      sessionId: "ses_1",
      finalMessage: "Done",
      usage: { inputTokens: 110, outputTokens: 25, cachedInputTokens: 7, costUsd: 0.03 },
    });
    expect(events).toEqual([
      { type: "session", sessionId: "ses_1" },
      { type: "command", command: "ls -1", status: "completed", exitCode: 0, output: "a.txt\n" },
      { type: "files", changes: [{ path: "written.txt", kind: "add" }] },
      { type: "command", command: "read: hello.txt", status: "completed" },
      { type: "message", text: "Done" },
    ]);
    expect(readFileSync(cwdPath, "utf8")).toBe(root);
    const args = JSON.parse(readFileSync(argsPath, "utf8")) as string[];
    expect(args).toEqual([
      "run",
      "--format",
      "json",
      "--auto",
      "--model",
      "deepseek/deepseek-flash#high",
      "--session",
      "ses_prev",
      "Fix it",
    ]);
  });

  it("uses --variant on OpenCode 1 and #variant on OpenCode 2", async () => {
    spec({
      version: "1.19.5",
      events: [
        session("ses_v1"),
        {
          type: "text",
          sessionID: "ses_v1",
          part: { type: "text", messageID: "m1", text: "Done" },
        },
      ],
      exportV1: {
        messages: [
          {
            info: {
              id: "m1",
              role: "assistant",
              tokens: { input: 7, output: 2, cache: { read: 1 } },
              cost: 0.01,
            },
            parts: [{ type: "text", text: "Done" }],
          },
        ],
      },
    });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    const v1 = await createOpenCodeAgent({ opencodePath: binPath }).run({
      workingDirectory: root,
      prompt: "Go",
      model: "deepseek/deepseek-flash",
      reasoningEffort: "high",
    });
    expect(v1).toMatchObject({
      finalMessage: "Done",
      usage: { inputTokens: 7, outputTokens: 2, cachedInputTokens: 1, costUsd: 0.01 },
    });
    expect(JSON.parse(readFileSync(argsPath, "utf8")) as string[]).toEqual([
      "run",
      "--format",
      "json",
      "--auto",
      "--model",
      "deepseek/deepseek-flash",
      "--variant",
      "high",
      "Go",
    ]);

    spec({ version: "2.2.2", events: [session("ses_v2")] });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    await createOpenCodeAgent({ opencodePath: binPath }).run({
      workingDirectory: root,
      prompt: "Go",
      model: "deepseek/deepseek-flash#low",
      reasoningEffort: "high",
    });
    expect(JSON.parse(readFileSync(argsPath, "utf8")) as string[]).toEqual([
      "run",
      "--format",
      "json",
      "--auto",
      "--model",
      "deepseek/deepseek-flash#high",
      "Go",
    ]);
  });

  it("rejects effort without a model on OpenCode 2 instead of dropping it", async () => {
    spec({ version: "2.2.2", events: [session("ses_empty")] });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    await expect(
      createOpenCodeAgent({ opencodePath: binPath }).run({
        workingDirectory: root,
        prompt: "Go",
        reasoningEffort: "high",
      }),
    ).rejects.toMatchObject({ kind: "bad-request" });
  });

  it("reports no usage when neither the stream nor the export has any", async () => {
    spec({
      events: [
        session("ses_2"),
        { type: "text", sessionID: "ses_2", part: { type: "text", messageID: "m", text: "Hi" } },
      ],
      export: { messages: [] },
    });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    const result = await createOpenCodeAgent({ opencodePath: binPath }).run({
      workingDirectory: root,
      prompt: "Hi",
    });
    expect(result.usage).toBeNull();
    expect(result.finalMessage).toBe("Hi");
  });

  it("classifies quota and auth failures", async () => {
    spec({ stderr: "insufficient credits for this request", exitCode: 1 });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    await expect(
      createOpenCodeAgent({ opencodePath: binPath }).run({
        workingDirectory: root,
        prompt: "go",
      }),
    ).rejects.toMatchObject({ kind: "quota" });
    expect(opencodeError("401 Unauthorized: missing api key").kind).toBe("auth");
    expect(opencodeError("429 Too Many Requests").kind).toBe("rate-limit");
    expect(opencodeError("model not found").kind).toBe("unavailable");
    expect(opencodeError("Variant unavailable for x: medium").kind).toBe("unavailable");
  });

  it("aborts the session's process group", async () => {
    rmSync(pidPath, { force: true });
    spec({ abort: true, events: [session("ses_3")] });
    process.env.FAKE_OPENCODE_SPEC = specPath;
    const abort = new AbortController();
    const running = createOpenCodeAgent({ opencodePath: binPath }).run(
      { workingDirectory: root, prompt: "go" },
      { signal: abort.signal },
    );
    await expect
      .poll(() => (existsSync(pidPath) ? Number(readFileSync(pidPath, "utf8")) : 0))
      .toBeGreaterThan(0);
    const pid = Number(readFileSync(pidPath, "utf8"));
    abort.abort();
    await expect(running).rejects.toMatchObject({
      message: "The OpenCode session was interrupted.",
    });
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
  });
});

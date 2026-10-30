import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "@jeeves/generator";
import { type CodingScript, createFakeCodingAgent, ProviderError } from "@jeeves/providers";
import { afterAll, describe, expect, it } from "vitest";
import { createAgentExecutor } from "./agent.ts";
import { taskBrief } from "./brief.ts";
import { FAIL_MARKER, markerChecks } from "./checks.ts";
import type {
  AttemptEvent,
  AttemptInput,
  GitStrategy,
  PreviousAttempt,
  TaskWorkspace,
} from "./execute.ts";
import { readGeneratedProject } from "./project.ts";
import { type PlannedTask, seedPlan } from "./seed.ts";
import { fixtureDesign, templates } from "./test-support.ts";

const root = mkdtempSync(join(tmpdir(), "jeeves-agent-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const design = fixtureDesign();
let count = 0;

/** A generated, committed fixture project (no runtime tarballs). */
async function project() {
  const dir = join(root, `p${++count}`);
  await generateProject({
    dir,
    design,
    projectName: "Shorty",
    vendor: async (out) => {
      mkdirSync(join(out, "vendor/jeeves"), { recursive: true });
      return [];
    },
  });
  // As after the baseline: an uncommitted lockfile.
  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return dir;
}

const git = (dir: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

function linksTask(dir: string) {
  const lock = JSON.parse(readFileSync(join(dir, "jeeves/lock.json"), "utf8"));
  const task = seedPlan({ design, lock, templates: templates.lookup }).find(
    (t) => t.key === "links",
  );
  if (!task) throw new Error("no links task");
  return task;
}

/** Runs attempts like the run service does: workspace and session saved, previous passed on. */
function attempts(dir: string, script: CodingScript, strategy: GitStrategy = "direct") {
  const agent = createFakeCodingAgent(script);
  const executor = createAgentExecutor({
    agents: () => ({ agent, model: "fake-coder" }),
    checks: markerChecks(),
  });
  const task = linksTask(dir);
  let workspace: TaskWorkspace | null = null;
  let previous: PreviousAttempt | null = null;
  let attempt = 0;
  const events: AttemptEvent[] = [];
  return {
    agent,
    events,
    get workspace() {
      return workspace;
    },
    /** Pretend the previous attempt was interrupted by a restart. */
    interrupted() {
      previous = { status: "interrupted", error: "restart", feedback: null, sessionId: null };
    },
    async next(signal = new AbortController().signal) {
      attempt++;
      const input: AttemptInput = {
        runId: 7,
        dir,
        task: { ...task, id: 1, workspace },
        attempt,
        strategy,
        previous,
        signal,
        saveWorkspace: async (ws) => {
          workspace = ws;
        },
        onEvent: (e) => events.push(e),
      };
      const outcome = await executor.execute(input);
      previous = {
        status: outcome.status,
        error: outcome.error ?? null,
        feedback: outcome.feedback ?? null,
        sessionId: outcome.sessionId ?? null,
      };
      return outcome;
    },
  };
}

const feature = "services/links/src/features/links.ts";

describe("agent executor", () => {
  it("rejects attempts to add fixed acceptance tests, even with broad task-owned paths", async () => {
    const dir = await project();
    const agent = createFakeCodingAgent([
      {
        write: {
          "tests/acceptance/weaken.test.ts": "// weakened",
          "tests/generated": "// blocks protected directory",
          [feature]: "export {};",
        },
      },
    ]);
    const executor = createAgentExecutor({
      agents: () => ({ agent, model: "fake" }),
      checks: markerChecks(),
    });
    const task = linksTask(dir);
    const result = await executor.execute({
      runId: 99,
      dir,
      task: { ...task, ownedPaths: [...task.ownedPaths, "tests/"], id: 1, workspace: null },
      attempt: 1,
      strategy: "direct",
      previous: null,
      signal: new AbortController().signal,
    });
    expect(result.status).toBe("failed");
    expect(result.checks?.rejectedPaths).toEqual([
      "tests/acceptance/weaken.test.ts",
      "tests/generated",
    ]);
    expect(existsSync(join(dir, "tests/acceptance/weaken.test.ts"))).toBe(false);
  });

  it("requires fixed acceptance coverage before spending an agent call", async () => {
    const dir = join(root, `p${++count}`);
    const d = fixtureDesign("resources");
    const generated = await generateProject({
      dir,
      design: d,
      projectName: "Resources",
      vendor: async () => [],
    });
    if (!generated.ok) throw new Error("generation failed");
    const task = seedPlan({ design: d, lock: generated.lock, templates: templates.lookup })[0]!;
    let called = false;
    const executor = createAgentExecutor({
      agents: () => {
        called = true;
        throw new Error("must not call");
      },
      checks: markerChecks(),
    });
    const result = await executor.execute({
      runId: 99,
      dir,
      task: { ...task, id: 1, workspace: null },
      attempt: 1,
      strategy: "direct",
      previous: null,
      signal: new AbortController().signal,
    });
    expect(called).toBe(false);
    expect(result.error).toContain("qrActivity: uncovered required acceptance ACT-01");
    expect(result.usage).toBe(null);
  });
  it("direct: a passing task is committed on the run branch, lockfile first", async () => {
    const dir = await project();
    const run = attempts(dir, [{ write: { [feature]: "export const links = 1;\n" } }]);
    const outcome = await run.next();
    expect(outcome).toMatchObject({
      status: "succeeded",
      usage: { inputTokens: 1000, outputTokens: 200, known: true },
      changes: [{ path: feature, status: "added" }],
      checks: { ok: true, rejectedPaths: [] },
    });
    expect(outcome.diff).toContain("+export const links = 1;");
    expect(git(dir, "branch", "--show-current")).toBe("jeeves/run-7");
    expect(git(dir, "rev-parse", "HEAD")).toBe(outcome.commit);
    expect(git(dir, "log", "--format=%s", "-3").split("\n")).toEqual([
      "links: Implement Links service",
      "Jeeves: uncommitted project changes before run 7",
      expect.any(String),
    ]);
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(git(dir, "show", "--name-only", "--format=", "HEAD")).toBe(feature);

    const prompt = run.agent.requests[0]?.prompt ?? "";
    expect(prompt).toMatch(/^Jeeves task: links, attempt 1\n/);
    expect(prompt).toContain("## Where you may change files");
    expect(prompt).toContain("`services/links/`");
    expect(prompt).toContain("## Element notes and template guide (jeeves/elements/links.md)");
    // Its own contract is in its owned paths; neighbours' contracts are for clients.
    expect(prompt).not.toContain("## Contract of");
    const lock = JSON.parse(readFileSync(join(dir, "jeeves/lock.json"), "utf8"));
    const web = seedPlan({ design, lock, templates: templates.lookup }).find(
      (t) => t.key === "web",
    );
    const webBrief = taskBrief({
      project: readGeneratedProject(dir),
      task: web as PlannedTask,
      attempt: 1,
    });
    expect(webBrief).toContain(
      "## Contract of links (contracts/links.openapi.yaml, read-only for this task)",
    );
    expect(webBrief).toContain("openapi:");
    expect(prompt).not.toContain("## Earlier work");
    expect(prompt).toContain("## AGENTS.md");
    // The agent runs the checks it can; the test packs only run from Jeeves.
    expect(prompt).toContain(
      "run `pnpm install`, `pnpm -r --no-bail typecheck`, `pnpm -r --no-bail test` yourself",
    );
    expect(prompt).toContain("don't look for them or try to run them");
    expect(run.agent.requests[0]?.model).toBe("fake-coder");
  });

  it("branch-per-task: works on a task branch and merges it into the run branch", async () => {
    const dir = await project();
    const run = attempts(
      dir,
      [{ write: { [feature]: "export const links = 2;\n" } }],
      "branch-per-task",
    );
    const outcome = await run.next();
    expect(outcome.status).toBe("succeeded");
    expect(run.workspace).toMatchObject({
      runBranch: "jeeves/run-7",
      branch: "jeeves/run-7-links",
    });
    expect(git(dir, "branch", "--show-current")).toBe("jeeves/run-7");
    expect(git(dir, "log", "--format=%s", "-1")).toBe("Merge jeeves/run-7-links");
    expect(git(dir, "log", "--format=%s", "-1", "jeeves/run-7-links")).toBe(
      "links: Implement Links service",
    );
    expect(readFileSync(join(dir, feature), "utf8")).toContain("= 2");
  });

  it("a failing check fails the attempt; the retry resumes the session with the output", async () => {
    const dir = await project();
    const run = attempts(dir, [
      { write: { [feature]: `// ${FAIL_MARKER}\n` } },
      { write: { [feature]: "export const fixed = true;\n" } },
    ]);
    const first = await run.next();
    expect(first).toMatchObject({
      status: "failed",
      sessionId: "fake-session-0",
      error: expect.stringContaining("Jeeves's checks failed"),
      feedback: expect.stringContaining(`Assertion failed in ${feature}`),
      checks: { ok: false, steps: [{ step: "unit-tests", status: "failed" }] },
    });
    // Nothing committed for the task yet.
    expect(git(dir, "log", "--format=%s", "-1")).toMatch(/^Jeeves: uncommitted/);

    const second = await run.next();
    expect(second.status).toBe("succeeded");
    const retry = run.agent.requests[1];
    expect(retry?.resumeSessionId).toBe("fake-session-0");
    expect(retry?.prompt).toMatch(/^Jeeves task: links, attempt 2\n/);
    expect(retry?.prompt).toContain("Jeeves ran its checks on your work and they did not pass");
    expect(retry?.prompt).toContain("Assertion failed");
    expect(git(dir, "show", `HEAD:${feature}`)).toBe("export const fixed = true;");
  });

  it("rejects and reverts changes outside the owned paths and to generated-owned files", async () => {
    const dir = await project();
    const generated = "frontends/web/src/jeeves.generated.ts";
    const before = readFileSync(join(dir, generated), "utf8");
    const run = attempts(dir, [
      {
        write: {
          [feature]: "export const ok = 1;\n",
          "frontends/web/src/pages/Hack.tsx": "export {};\n",
          "docker-compose.yml": "services: {}\n",
        },
        append: { [generated]: "// edited\n" },
      },
    ]);
    const outcome = await run.next();
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toMatch(/outside the task's owned paths \(reverted\)/);
    expect(outcome.checks?.rejectedPaths.sort()).toEqual(
      ["docker-compose.yml", "frontends/web/src/pages/Hack.tsx", generated].sort(),
    );
    expect(outcome.feedback).toContain("- docker-compose.yml");
    // Reverted: only the in-scope change is left.
    expect(existsSync(join(dir, "frontends/web/src/pages/Hack.tsx"))).toBe(false);
    expect(readFileSync(join(dir, generated), "utf8")).toBe(before);
    expect(outcome.changes).toEqual([{ path: feature, status: "added" }]);
    expect(run.events.some((e) => e.kind === "git" && e.text.startsWith("Reverted"))).toBe(true);
  });

  it("an agent that changes nothing fails the attempt", async () => {
    const dir = await project();
    const outcome = await attempts(dir, [{ message: "All done!" }]).next();
    expect(outcome).toMatchObject({
      status: "failed",
      error: "The agent didn't change any files.",
      summary: "All done!",
    });
  });

  it("after an interruption, a new session is briefed with the earlier work", async () => {
    const dir = await project();
    const run = attempts(dir, [
      { write: { [feature]: "export const half = 1;\n" }, hang: true },
      { append: { [feature]: "export const rest = 2;\n" } },
    ]);
    const abort = new AbortController();
    const first = run.next(abort.signal);
    await expect.poll(() => existsSync(join(dir, feature))).toBe(true);
    abort.abort();
    await expect(first).rejects.toBeInstanceOf(ProviderError);

    run.interrupted();
    const second = await run.next();
    expect(second.status).toBe("succeeded");
    const prompt = run.agent.requests[1]?.prompt ?? "";
    expect(run.agent.requests[1]?.resumeSessionId).toBeUndefined();
    expect(prompt).toContain("## Earlier work on this task");
    expect(prompt).toContain("An earlier attempt was interrupted");
    expect(prompt).toContain("+export const half = 1;");
    expect(git(dir, "show", `HEAD:${feature}`)).toBe(
      "export const half = 1;\nexport const rest = 2;",
    );
  });

  it("quota and auth errors are thrown for the run to wait; other agent errors fail the attempt", async () => {
    const dir = await project();
    await expect(attempts(dir, [{ error: "quota" }]).next()).rejects.toMatchObject({
      kind: "quota",
    });
    const crashed = await attempts(dir, [{ error: "unavailable" }]).next();
    expect(crashed).toMatchObject({ status: "failed", error: "Scripted agent failure." });
    const executor = createAgentExecutor({
      agents: () => ({ error: "Codex isn't set up." }),
      checks: markerChecks(),
    });
    await expect(
      executor.execute({
        runId: 1,
        dir,
        task: { ...linksTask(dir), id: 1, workspace: null },
        attempt: 1,
        strategy: "direct",
        previous: null,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ kind: "auth", message: "Codex isn't set up." });
  });
});

describe("durable invocation evidence", () => {
  it.each(["provider", "checks"])(
    "saves actual prompts and usage before a later %s failure",
    async (failure) => {
      const dir = await project();
      const fake = createFakeCodingAgent([{ write: { [feature]: "export const done = 1;\n" } }]);
      const saved: unknown[] = [];
      let invocation:
        | { prompt: string; provider: string; model: string; startingCommit: string }
        | undefined;
      const executor = createAgentExecutor({
        agents: () => ({
          model: "metered-model",
          agent: {
            id: "metered",
            capabilities: fake.capabilities,
            run: async (request, options) => {
              const session = await fake.run(request, options);
              if (failure === "provider") {
                options?.onEvent?.({
                  type: "usage",
                  usage: { inputTokens: 50, outputTokens: 9, costUsd: 0.01 },
                });
                throw new ProviderError("metered", "quota", "provider stopped");
              }
              return session;
            },
          },
        }),
        checks: {
          run: async () => {
            expect(saved).toEqual([{ inputTokens: 1000, outputTokens: 200, known: true }]);
            throw new Error("checks stopped");
          },
        },
      });
      await expect(
        executor.execute({
          dir,
          runId: 1,
          attempt: 1,
          strategy: "direct",
          previous: null,
          task: { ...linksTask(dir), id: 1, workspace: null },
          signal: new AbortController().signal,
          saveInvocation: async (value) => {
            invocation = value;
          },
          saveUsage: async (value) => {
            saved.push(value);
          },
        }),
      ).rejects.toThrow(`${failure} stopped`);
      expect(invocation).toMatchObject({
        provider: "metered",
        model: "metered-model",
        prompt: fake.requests[0]?.prompt,
        startingCommit: git(dir, "rev-parse", "HEAD"),
      });
      expect(saved).toEqual([
        failure === "provider"
          ? { inputTokens: 50, outputTokens: 9, costUsd: 0.01, known: true }
          : { inputTokens: 1000, outputTokens: 200, known: true },
      ]);
    },
  );
});

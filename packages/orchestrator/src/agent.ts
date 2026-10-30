/**
 * The real task executor (PLAN §10, Execute): prepare git, brief a coding-agent session, then
 * check the work itself (owned paths first, then the project checks) and commit it per the git
 * strategy. One call is one attempt; the run service retries failed attempts with the feedback
 * this returns.
 */

import { acceptanceCoverageProblems, readLock } from "@jeeves/generator";
import { assertGeneratedIntegrity } from "@jeeves/generator/baseline";
import {
  type CodingAgentEvent,
  type CodingAgentProvider,
  type CodingSessionResult,
  ProviderError,
} from "@jeeves/providers";
import { followUpPrompt, taskBrief } from "./brief.ts";
import type { ProjectChecks } from "./checks.ts";
import type {
  AttemptEvent,
  AttemptOutcome,
  AttemptUsage,
  PreviousAttempt,
  TaskExecutor,
} from "./execute.ts";
import { Git, isOwned, SHARED_PATHS } from "./git.ts";
import { readGeneratedProject } from "./project.ts";
import { taskRequiredExtensions } from "./seed.ts";

/** The coding agent and model to use, read again for every attempt (Settings may change). */
export type CodingAgentSource = () =>
  | { agent: CodingAgentProvider; model: string }
  | { error: string };

export type AgentExecutorOptions = {
  agents: CodingAgentSource;
  checks: ProjectChecks;
};

/** Log lines from the checks kept for the agent's feedback. */
const FEEDBACK_LOG_LINES = 200;
/** A single coding session may run this long by default; `JEEVES_AGENT_TIMEOUT_MIN` overrides it. */
const AGENT_TIMEOUT_MINUTES = 45;

function agentTimeoutMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.JEEVES_AGENT_TIMEOUT_MIN);
  return Number.isFinite(value) && value > 0 ? value : AGENT_TIMEOUT_MINUTES;
}

export function createAgentExecutor({ agents, checks }: AgentExecutorOptions): TaskExecutor {
  return {
    selection: () => {
      const source = agents();
      return "error" in source ? null : { provider: source.agent.id, model: source.model };
    },
    async execute(input) {
      const started = Date.now();
      const emit = (event: Omit<AttemptEvent, "t">) =>
        input.onEvent?.({ t: Date.now() - started, ...event });
      const { task, dir, signal } = input;
      const git = new Git(dir);

      // An orphaned agent may have died with edits to generated-owned files. Restore them before
      // the integrity check, so a resume can continue instead of stopping as needs-attention.
      if (input.previous?.status === "interrupted") {
        const lock = readLock(dir);
        if (lock) {
          const restored = await git.restoreGenerated(Object.keys(lock.files));
          const paths = [...restored.restored, ...restored.removed];
          if (paths.length > 0) {
            const text = `Restored generated-owned files after an interrupted attempt: ${paths.join(", ")}`;
            emit({ kind: "warning", text });
            await input.saveIntervention?.({
              action: "restore-generated",
              note: text,
              taskId: task.id,
            });
          }
        }
      }

      const project = readGeneratedProject(dir);
      assertGeneratedIntegrity(dir, project.lock);
      const required = taskRequiredExtensions(project.design, task.key, input.verifiedTaskKeys);
      const uncovered = acceptanceCoverageProblems(
        project.lock.resourceModels ?? {},
        project.lock.fixedAcceptance ?? [],
        required,
      );
      if (uncovered.length)
        return {
          status: "failed",
          summary: "Fixed acceptance must be supplied before coding.",
          usage: null,
          error: uncovered.join("\n"),
          feedback: uncovered.join("\n"),
          changes: [],
          diff: "",
          checks: {
            ok: false,
            rejectedPaths: [],
            steps: [],
            checks: uncovered.map((error, index) => ({
              subject: task.element,
              id: `coverage-${index}`,
              title: "Required fixed acceptance",
              layer: "application",
              status: "failed",
              durationMs: 0,
              error,
            })),
          },
        };
      const source = agents();
      if ("error" in source) throw new ProviderError("coding", "auth", source.error);
      const { agent, model } = source;

      const { workspace, notes } = await git.prepare({
        runId: input.runId,
        taskKey: task.key,
        strategy: input.strategy,
        workspace: task.workspace,
      });
      for (const text of notes) emit({ kind: "git", text });
      if (!task.workspace) await input.saveWorkspace?.(workspace);
      const base = workspace.baseCommit;

      // A retry after failed checks continues the same session with the results; anything else
      // (first attempt, a restart, an agent crash) starts a new one, told about earlier work.
      const previous = input.previous;
      const followUp =
        previous?.status === "failed" &&
        previous.feedback &&
        previous.sessionId &&
        agent.capabilities.resume
          ? { sessionId: previous.sessionId, feedback: previous.feedback }
          : undefined;
      let prompt: string;
      if (followUp) {
        prompt = followUpPrompt(task, input.attempt, followUp.feedback);
        emit({ kind: "log", text: `Resuming the ${agent.id} session with Jeeves's check results` });
      } else {
        const diffStat = previous ? await git.diffStat(base) : "";
        const earlierWork = diffStat
          ? { reason: earlierReason(previous), diffStat, diff: await git.diff(base) }
          : undefined;
        prompt = taskBrief({ project, task, attempt: input.attempt, earlierWork });
        if (previous?.feedback) {
          prompt += `\n\n## What failed last time\n\n${previous.feedback}`;
        }
        emit({
          kind: "log",
          text: `Starting a ${agent.id} session${model ? ` (${model})` : ""}${earlierWork ? " with a summary of the earlier work" : ""}`,
        });
      }

      await input.saveInvocation?.({
        provider: agent.id,
        model,
        prompt,
        startingCommit: await git.head(),
      });
      let usageWrites = Promise.resolve();
      let session: CodingSessionResult | undefined;
      let sessionId: string | null = followUp?.sessionId ?? null;
      let agentError: ProviderError | undefined;
      let timeoutMessage: string | undefined;
      const timeoutMinutes = agentTimeoutMinutes();
      const sessionAbort = new AbortController();
      const forwardAbort = () => sessionAbort.abort();
      if (signal.aborted) sessionAbort.abort();
      else signal.addEventListener("abort", forwardAbort, { once: true });
      let timedOut = false;
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        sessionAbort.abort();
      }, timeoutMinutes * 60_000);
      timeoutTimer.unref();
      try {
        session = await agent.run(
          {
            workingDirectory: dir,
            prompt,
            ...(model ? { model } : {}),
            ...(followUp ? { resumeSessionId: followUp.sessionId } : {}),
          },
          {
            signal: sessionAbort.signal,
            onEvent: (event) => {
              if (event.type === "session") {
                sessionId = event.sessionId;
                void input.saveSession?.(event.sessionId);
              }
              if (event.type === "usage") {
                usageWrites = usageWrites.then(() =>
                  input.saveUsage?.({ ...event.usage, known: true }),
                );
              }
              const mapped = agentEvent(event);
              if (mapped) emit(mapped);
            },
          },
        );
        sessionId = session.sessionId ?? sessionId;
      } catch (error) {
        if (signal.aborted) throw error;
        if (!timedOut) {
          if (!(error instanceof ProviderError) || error.blocksProvider) throw error;
          // The agent crashed or the provider had a passing problem: a new session may do better.
          agentError = error;
          emit({ kind: "warning", text: error.message });
        }
      } finally {
        clearTimeout(timeoutTimer);
        signal.removeEventListener("abort", forwardAbort);
        await usageWrites;
      }
      if (timedOut) {
        timeoutMessage = `The coding session exceeded ${Number(timeoutMinutes.toFixed(3))} minutes and was stopped.`;
        // The killed session is not resumed: the retry starts fresh, with the diff as earlier work.
        sessionId = null;
        emit({ kind: "warning", text: timeoutMessage });
      }
      const usage = toUsage(session);
      if (usage) await input.saveUsage?.(usage);

      // Owned paths first: anything outside them (or a generated-owned file) is reverted.
      let changes = await git.changes(base);
      const generated = new Set(Object.keys(project.lock.files));
      const rejected = changes
        .map((c) => c.path)
        .filter(
          (path) =>
            generated.has(path) ||
            /^(?:tests\/(?:generated|acceptance)(?:\/|$)|jeeves(?:\/|$))/.test(path) ||
            !(isOwned(path, task.ownedPaths) || SHARED_PATHS.includes(path)),
        );
      if (rejected.length > 0) {
        await git.restore(base, rejected);
        emit({
          kind: "git",
          text: `Reverted changes outside the task's paths: ${rejected.join(", ")}`,
        });
        changes = await git.changes(base);
      }
      const diff = await git.diff(base);
      const common = { usage, sessionId, changes, diff };

      if (timeoutMessage) {
        return {
          ...common,
          status: "failed",
          summary: lastWords(session),
          error: timeoutMessage,
          feedback: timeoutMessage,
          checks: { ok: false, rejectedPaths: rejected, steps: [], checks: [] },
        };
      }
      if (agentError) {
        return {
          ...common,
          status: "failed",
          summary: "The coding agent stopped with an error.",
          error: agentError.message,
          checks: { ok: false, rejectedPaths: rejected, steps: [], checks: [] },
        };
      }
      if (rejected.length > 0) {
        const list = rejected.map((p) => `- ${p}`).join("\n");
        return {
          ...common,
          status: "failed",
          summary: lastWords(session),
          error: `Changed files outside the task's owned paths (reverted): ${rejected.join(", ")}`,
          feedback: `You changed files you may not change, so Jeeves reverted them:\n\n${list}\n\nYou may only change ${[...task.ownedPaths, ...SHARED_PATHS].join(", ")}, and never generated-owned files. Redo the work inside those paths, or explain in your final message why it can't be done there.`,
          checks: { ok: false, rejectedPaths: rejected, steps: [], checks: [] },
        };
      }
      if (changes.length === 0) {
        return {
          ...common,
          status: "failed",
          summary: lastWords(session),
          error: "The agent didn't change any files.",
          feedback: "You didn't change any files. Implement the task, with its tests, then stop.",
          checks: { ok: false, rejectedPaths: [], steps: [], checks: [] },
        };
      }

      emit({ kind: "log", text: `Running Jeeves's checks on ${changes.length} changed file(s)` });
      const element = project.design.elements.find((e) => e.id === task.element);
      const phase: "frontend" | "extensions" =
        element?.template?.id === "web-app" ? "frontend" : "extensions";
      const logTail: string[] = [];
      const result = await checks.run({
        dir,
        requiredExtensions: required,
        phase,
        changed: changes.filter((c) => c.status !== "deleted").map((c) => c.path),
        signal,
        onEvent: (event) => {
          if (event.kind === "log") {
            logTail.push(event.text);
            if (logTail.length > FEEDBACK_LOG_LINES) logTail.shift();
          }
          emit(event);
        },
      });
      if (signal.aborted) throw new Error("cancelled");
      const attemptChecks = { ...result, rejectedPaths: [] };
      if (!result.ok) {
        const failure = checkFailure(result);
        return {
          ...common,
          status: "failed",
          summary: lastWords(session),
          error: failure,
          feedback: `${failure}\n\nThe last lines of the check output:\n\n\`\`\`text\n${logTail.join("\n")}\n\`\`\``,
          checks: attemptChecks,
        };
      }

      const commit = await git.finish(
        workspace,
        `${task.key}: ${task.title}\n\nJeeves run ${input.runId}, task ${task.key}, attempt ${input.attempt}.`,
      );
      emit({
        kind: "git",
        text:
          workspace.branch === workspace.runBranch
            ? `Committed ${commit.slice(0, 10)} on ${workspace.runBranch}`
            : `Merged ${workspace.branch} into ${workspace.runBranch} (${commit.slice(0, 10)})`,
      });
      return {
        ...common,
        status: "succeeded",
        summary: lastWords(session),
        checks: attemptChecks,
        commit,
      } satisfies AttemptOutcome;
    },
  };
}

function earlierReason(previous: PreviousAttempt | null): string {
  if (previous?.status === "interrupted")
    return "An earlier attempt was interrupted (Jeeves stopped while it ran).";
  if (previous?.error) return `An earlier attempt failed: ${previous.error}`;
  return "An earlier attempt left work in the folder.";
}

function checkFailure(result: Awaited<ReturnType<ProjectChecks["run"]>>): string {
  const steps = result.steps
    .filter((s) => s.status === "failed")
    .map((s) => `${s.title}${s.message ? `: ${s.message}` : ""}`);
  const checks = result.checks
    .filter((c) => c.status === "failed")
    .map((c) => `${c.subject}: ${c.title}${c.error ? ` (${c.error})` : ""}`);
  return [
    `Jeeves's checks failed. ${steps.join("; ")}`,
    ...(checks.length > 0 ? ["Failed checks:", ...checks.map((c) => `- ${c}`)] : []),
  ].join("\n");
}

function lastWords(session: CodingSessionResult | undefined): string {
  const text = session?.finalMessage.trim() ?? "";
  if (!text) return "The agent finished without a message.";
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

function toUsage(session: CodingSessionResult | undefined): AttemptUsage | null {
  if (!session?.usage) return null;
  return {
    inputTokens: session.usage.inputTokens,
    outputTokens: session.usage.outputTokens,
    known: true,
    ...(session.usage.costUsd === undefined ? {} : { costUsd: session.usage.costUsd }),
  };
}

function agentEvent(event: CodingAgentEvent): Omit<AttemptEvent, "t"> | undefined {
  switch (event.type) {
    case "usage":
      return undefined;
    case "session":
      return { kind: "log", text: `Session ${event.sessionId}` };
    case "message":
      return { kind: "message", text: event.text };
    case "reasoning":
      return { kind: "reasoning", text: event.text };
    case "command":
      return {
        kind: "command",
        text:
          event.status === "running"
            ? `$ ${event.command}`
            : `$ ${event.command} → ${event.exitCode ?? (event.status === "failed" ? "failed" : "done")}`,
        status:
          event.status === "running" ? "running" : event.status === "failed" ? "failed" : "passed",
      };
    case "files":
      return { kind: "files", text: event.changes.map((c) => `${c.kind} ${c.path}`).join(", ") };
    case "todo":
      return {
        kind: "todo",
        text: event.items.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join("\n"),
      };
    case "warning":
      return { kind: "warning", text: event.text };
  }
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import {
  type ComposeFile,
  createGenerateContext,
  type TestPackContext,
} from "@jeeves/template-kit";
import { parse } from "yaml";
import { pnpmCommand, runCommand } from "../exec.ts";
import { type TemplateSet, templateSet } from "../modules.ts";
import type { Subject } from "../plan.ts";
import { ComposeCli } from "./compose.ts";

export { ComposeCli } from "./compose.ts";

export const baselineSteps = [
  { id: "install", title: "Install dependencies" },
  { id: "typecheck", title: "Type check" },
  { id: "compose-up", title: "Start with docker compose" },
  { id: "test-packs", title: "Run template test packs" },
  { id: "compose-down", title: "Stop the project" },
] as const;
export type BaselineStepId = (typeof baselineSteps)[number]["id"];

export type StepStatus = "running" | "passed" | "failed" | "skipped";

export interface CheckOutcome {
  /** `<element>` or `<element>/<attachment>`. */
  subject: string;
  template: string;
  id: string;
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
}

export type BaselineEvent =
  | {
      type: "step";
      step: BaselineStepId;
      status: StepStatus;
      durationMs?: number;
      message?: string;
    }
  | { type: "log"; step: BaselineStepId; line: string }
  | { type: "check"; check: CheckOutcome };

export interface BaselineOptions {
  dir: string;
  design: DesignDocument;
  /** What to run test packs for, from the generation plan. */
  subjects: Subject[];
  templates?: TemplateSet;
  onEvent?: (event: BaselineEvent) => void;
  signal?: AbortSignal;
  /** Leave the containers running afterwards. Default false: `docker compose down` (volumes kept). */
  keepRunning?: boolean;
}

export interface BaselineResult {
  ok: boolean;
  steps: { step: BaselineStepId; status: StepStatus; durationMs: number; message?: string }[];
  checks: CheckOutcome[];
}

/**
 * Template order for test packs. Packs for web apps and clients go first because http-service's
 * checks restart services (and the web proxy can hold an old address for a few seconds); postgres
 * and http-service restart or stop the database, so they go last.
 */
const PACK_ORDER = ["web-app", "rest-api-client", "rest-api-server", "postgres", "http-service"];

/**
 * The baseline check (PLAN §9): install, type check, `docker compose up --wait`, and every
 * template test pack. A project that isn't green is a template bug, not something for agents.
 */
export async function runBaseline(options: BaselineOptions): Promise<BaselineResult> {
  const { dir, signal } = options;
  const emit = options.onEvent ?? (() => {});
  const templates = options.templates ?? templateSet();
  const compose = new ComposeCli(dir, signal);
  const [pnpm, ...pnpmArgs] = pnpmCommand();
  const result: BaselineResult = { ok: true, steps: [], checks: [] };
  if (signal?.aborted) result.ok = false;

  const step = async (
    id: BaselineStepId,
    body: (log: (line: string) => void) => Promise<string | undefined>,
    always = false,
  ) => {
    if (!always && (!result.ok || signal?.aborted)) {
      result.steps.push({ step: id, status: "skipped", durationMs: 0 });
      emit({ type: "step", step: id, status: "skipped" });
      return;
    }
    const started = Date.now();
    emit({ type: "step", step: id, status: "running" });
    const log = (line: string) => emit({ type: "log", step: id, line });
    let status: StepStatus = "passed";
    let message: string | undefined;
    try {
      message = await body(log);
    } catch (error) {
      status = "failed";
      message = (error as Error).message;
      result.ok = false;
    }
    const durationMs = Date.now() - started;
    result.steps.push({ step: id, status, durationMs, ...(message && { message }) });
    emit({ type: "step", step: id, status, durationMs, ...(message && { message }) });
  };

  const command = async (
    log: (line: string) => void,
    cmd: string,
    args: string[],
    what: string,
  ) => {
    log(
      `$ ${[cmd === pnpm ? "pnpm" : cmd, ...(cmd === pnpm ? args.slice(pnpmArgs.length) : args)].join(" ")}`,
    );
    const run = await runCommand(cmd, args, { cwd: dir, onLine: log, ...(signal && { signal }) });
    if (run.exitCode !== 0) throw new Error(`${what} failed (exit code ${run.exitCode})`);
  };

  await step("install", async (log) => {
    await command(log, pnpm, [...pnpmArgs, "install"], "pnpm install");
    return undefined;
  });
  await step("typecheck", async (log) => {
    await command(log, pnpm, [...pnpmArgs, "-r", "--no-bail", "typecheck"], "The type check");
    return undefined;
  });

  let started = false;
  await step("compose-up", async (log) => {
    started = true;
    log("$ docker compose up --build --wait");
    const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
    if (up.exitCode === 0) return undefined;
    // Show why: container states and the end of each unhealthy service's log.
    const ps = await compose.run([
      "ps",
      "--all",
      "--format",
      "{{.Service}}\t{{.State}}\t{{.Health}}",
    ]);
    for (const line of ps.output.trim().split("\n")) log(line);
    for (const line of ps.output.trim().split("\n")) {
      const [service, state, health] = line.split("\t");
      if (!service || (state === "running" && health !== "unhealthy") || state === "exited")
        continue;
      const logs = await compose.run(["logs", "--no-color", "--tail", "40", service]);
      for (const l of logs.output.trim().split("\n")) log(l);
    }
    throw new Error(`docker compose up failed (exit code ${up.exitCode})`);
  });

  await step("test-packs", async (log) => {
    const file = parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile;
    const failed: string[] = [];
    for (const subject of orderSubjects(options.subjects)) {
      const key = subject.attachment ? `${subject.element}/${subject.attachment}` : subject.element;
      const [id = "", version = ""] = subject.template.split("@");
      const pack = templates.module({ id, version }).testPack;
      const ctx: TestPackContext = {
        projectDir: dir,
        subject: createGenerateContext(
          options.design,
          templates.lookup,
          subject.element,
          subject.attachment,
        ),
        compose: file,
        service: (name) => compose.service(name),
        log: (line) => log(`[${key}] ${line}`),
      };
      log(`${pack.template} test pack for ${key}`);
      for (const check of pack.checks) {
        if (signal?.aborted) throw new Error("Cancelled");
        const begin = Date.now();
        let outcome: CheckOutcome;
        try {
          await check.run(ctx);
          outcome = {
            subject: key,
            template: subject.template,
            id: check.id,
            title: check.title,
            status: "passed",
            durationMs: Date.now() - begin,
          };
        } catch (error) {
          outcome = {
            subject: key,
            template: subject.template,
            id: check.id,
            title: check.title,
            status: "failed",
            durationMs: Date.now() - begin,
            error: (error as Error).message ?? String(error),
          };
          failed.push(`${key}: ${check.title}`);
        }
        result.checks.push(outcome);
        emit({ type: "check", check: outcome });
      }
    }
    if (failed.length > 0) {
      throw new Error(`${failed.length} check(s) failed: ${failed.join("; ")}`);
    }
    return `${result.checks.length} checks passed`;
  });

  // Stopping runs even after a failure or a cancel, so containers aren't left behind.
  if (started && !options.keepRunning) {
    await step(
      "compose-down",
      async (log) => {
        log("$ docker compose down");
        const down = await new ComposeCli(dir).run(["down"], log);
        if (down.exitCode !== 0) throw new Error("docker compose down failed");
        return undefined;
      },
      true,
    );
  } else {
    result.steps.push({ step: "compose-down", status: "skipped", durationMs: 0 });
    emit({ type: "step", step: "compose-down", status: "skipped" });
  }
  return result;
}

function orderSubjects(subjects: Subject[]): Subject[] {
  const rank = (s: Subject) => {
    const index = PACK_ORDER.indexOf(s.template.split("@")[0] ?? "");
    return index === -1 ? PACK_ORDER.length : index;
  };
  // Array.prototype.sort is stable, so design order holds within a template.
  return [...subjects].sort((a, b) => rank(a) - rank(b));
}

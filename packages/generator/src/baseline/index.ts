import type { DesignDocument } from "@jeeves/spec";
import {
  CheckSkipped,
  type ComposeFile,
  createGenerateContext,
  type TestPackContext,
} from "@jeeves/template-kit";
import { behaviorRequirements } from "../acceptance.ts";
import { pnpmCommand, runCommand } from "../exec.ts";
import { readLock } from "../lock.ts";
import { type TemplateSet, templateSet } from "../modules.ts";
import type { Subject } from "../plan.ts";
import { recipeCoverage } from "../recipes.ts";
import { assertGeneratedIntegrity, verifyBehavior } from "./behavior.ts";
import { assertComposeEnvironment, ComposeCli } from "./compose.ts";

export { ComposeCli } from "./compose.ts";

export const baselineSteps = [
  { id: "install", title: "Install dependencies" },
  { id: "typecheck", title: "Type check" },
  { id: "compose-up", title: "Infrastructure readiness: start with Docker Compose" },
  { id: "test-packs", title: "Run template test packs" },
  { id: "behavior", title: "Independent behavior and application acceptance" },
  { id: "compose-down", title: "Stop the project" },
] as const;

/** Default wall-clock limits for the bounded check steps; `JEEVES_CHECK_TIMEOUT_MIN` scales them. */
export const STEP_TIMEOUT_MINUTES = {
  install: 15,
  typecheck: 10,
  "unit-tests": 20,
  "test-packs": 20,
} as const;
export type TimedStepId = keyof typeof STEP_TIMEOUT_MINUTES;

/** One test-only or emergency multiplier; a missing or invalid value leaves the defaults. */
export function checkTimeoutMultiplier(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.JEEVES_CHECK_TIMEOUT_MIN);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function stepTimeoutMs(step: TimedStepId, env: NodeJS.ProcessEnv = process.env): number {
  return STEP_TIMEOUT_MINUTES[step] * checkTimeoutMultiplier(env) * 60_000;
}

/** A step that ran out of wall-clock time, killed with its whole process group. */
export class StepTimeout extends Error {
  constructor(
    readonly step: string,
    readonly minutes: number,
  ) {
    super(`${step} exceeded ${Number(minutes.toFixed(3))} min`);
    this.name = "StepTimeout";
  }
}

/** The orchestrator's checks after each task (PLAN §10): the baseline plus the project's tests. */
export const taskCheckSteps = [
  baselineSteps[0],
  baselineSteps[1],
  { id: "unit-tests", title: "Unit and project tests" },
  baselineSteps[2],
  baselineSteps[3],
  baselineSteps[4],
  baselineSteps[5],
] as const;
export type BaselineStepId = (typeof taskCheckSteps)[number]["id"];

export type StepStatus = "running" | "passed" | "failed" | "skipped";

export interface CheckOutcome {
  /** `<element>` or `<element>/<attachment>`. */
  subject: string;
  template: string;
  id: string;
  title: string;
  status: "passed" | "failed" | "skipped";
  reason?: string;
  layer?: "infrastructure" | "template" | "application";
  /** Fixed acceptance cases this check verifies, for traceability. */
  acceptanceIds?: string[];
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
  /** Also run the project's own tests (`pnpm -r --no-bail test`) after the type check. */
  unitTests?: boolean;
  /** Only these extension operations are due; omitted on task checks means all extensions. */
  requiredExtensions?: Record<string, string[]>;
  /** Which work is implemented when checks run; frontend suites wait until `frontend`. */
  phase?: "extensions" | "frontend";
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
const PACK_ORDER = [
  "web-app",
  "resource-workspace",
  "rest-api-client",
  "rest-api-server",
  "postgres",
  "http-service",
];

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
  const lock = readLock(dir);
  const models = lock?.resourceModels ?? {};
  const provided = lock ? recipeCoverage(options.design, lock, templates.lookup) : undefined;
  const requested =
    options.requiredExtensions ??
    (options.unitTests
      ? Object.fromEntries(
          Object.entries(behaviorRequirements(models, lock?.deliveryModels)).map(
            ([id, behaviors]) => [id, behaviors.map((e) => e.id)],
          ),
        )
      : {});
  const required = Object.fromEntries(
    [...new Set([...Object.keys(requested), ...Object.keys(provided?.operations ?? {})])].map(
      (service) => [
        service,
        [...new Set([...(requested[service] ?? []), ...(provided?.operations[service] ?? [])])],
      ],
    ),
  );
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
    const stepOutput: string[] = [];
    const log = (line: string) => {
      stepOutput.push(line);
      if (stepOutput.length > 200) stepOutput.shift();
      emit({ type: "log", step: id, line });
    };
    let status: StepStatus = "passed";
    let message: string | undefined;
    try {
      message = await body(log);
    } catch (error) {
      status = "failed";
      // A timeout already says what happened; other failures carry the step's own last lines so
      // the retry shows the assertion rather than the later compose-down noise.
      const detail = (error as Error).message;
      const tail = stepOutput.slice(-120).join("\n");
      message = error instanceof StepTimeout ? detail : [detail, tail].filter(Boolean).join("\n");
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
    timeoutStep?: TimedStepId,
  ) => {
    log(
      `$ ${[cmd === pnpm ? "pnpm" : cmd, ...(cmd === pnpm ? args.slice(pnpmArgs.length) : args)].join(" ")}`,
    );
    const timeoutMs = timeoutStep ? stepTimeoutMs(timeoutStep) : undefined;
    const run = await runCommand(cmd, args, {
      cwd: dir,
      onLine: log,
      ...(signal && { signal }),
      ...(timeoutMs && { timeoutMs }),
    });
    if (run.timedOut && timeoutStep && timeoutMs)
      throw new StepTimeout(timeoutStep, timeoutMs / 60_000);
    if (run.exitCode !== 0) throw new Error(`${what} failed (exit code ${run.exitCode})`);
  };

  await step("install", async (log) => {
    if (lock) assertGeneratedIntegrity(dir, lock);
    await command(log, pnpm, [...pnpmArgs, "install"], "pnpm install", "install");
    return undefined;
  });
  await step("typecheck", async (log) => {
    await command(
      log,
      pnpm,
      [...pnpmArgs, "-r", "--no-bail", "typecheck"],
      "The type check",
      "typecheck",
    );
    return undefined;
  });
  if (options.unitTests) {
    await step("unit-tests", async (log) => {
      await command(log, pnpm, [...pnpmArgs, "-r", "--no-bail", "test"], "The tests", "unit-tests");
      return undefined;
    });
  }

  let started = false;
  await step("compose-up", async (log) => {
    assertComposeEnvironment(dir);
    started = true;
    const running = await compose.run(["ps", "-q"]);
    if (running.exitCode === 0 && running.output.trim()) {
      log("$ docker compose down --remove-orphans");
      const down = await compose.run(["down", "--remove-orphans"], log);
      if (down.exitCode !== 0)
        throw new Error(`docker compose down failed (exit code ${down.exitCode})`);
    }
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
    // Resolve the generated project's .env references without logging credentials.
    const file = JSON.parse(await compose.ok(["config", "--format", "json"])) as ComposeFile;
    const failed: string[] = [];
    const packTimeoutMs = stepTimeoutMs("test-packs");
    for (const subject of orderSubjects(options.subjects)) {
      const packStarted = Date.now();
      const key = subject.attachment ? `${subject.element}/${subject.attachment}` : subject.element;
      const [id = "", version = ""] = subject.template.split("@");
      const pack = templates.module({ id, version }).testPack;
      const ctx: TestPackContext = {
        deferredOperations: models[subject.element]?.extensions
          .filter((e) => !required[subject.element]?.includes(e.operationId))
          .map((e) => e.operationId),
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
        const remaining = packTimeoutMs - (Date.now() - packStarted);
        if (remaining <= 0) throw new StepTimeout("test-packs", packTimeoutMs / 60_000);
        const begin = Date.now();
        let outcome: CheckOutcome;
        try {
          await withTimeout(check.run(ctx), remaining, packTimeoutMs / 60_000);
          outcome = {
            subject: key,
            template: subject.template,
            id: check.id,
            title: check.title,
            status: "passed",
            durationMs: Date.now() - begin,
          };
        } catch (error) {
          if (error instanceof StepTimeout) throw error;
          outcome = {
            subject: key,
            template: subject.template,
            id: check.id,
            title: check.title,
            status: error instanceof CheckSkipped ? "skipped" : "failed",
            durationMs: Date.now() - begin,
            ...(error instanceof CheckSkipped
              ? { reason: error.message }
              : { error: (error as Error).message ?? String(error) }),
          };
          if (!(error instanceof CheckSkipped)) failed.push(`${key}: ${check.title}`);
        }
        outcome.layer = "template";
        result.checks.push(outcome);
        emit({ type: "check", check: outcome });
      }
    }
    if (failed.length > 0) {
      throw new Error(`${failed.length} check(s) failed: ${failed.join("; ")}`);
    }
    return `${result.checks.filter((c) => c.status === "passed").length} checks passed; ${result.checks.filter((c) => c.status === "skipped").length} skipped with reasons`;
  });

  if (lock && (Object.keys(models).length || Object.keys(lock.deliveryModels ?? {}).length))
    await step("behavior", async (log) => {
      await verifyBehavior({
        dir,
        lock,
        required,
        providedAcceptance: provided?.acceptance,
        ...(options.phase && { phase: options.phase }),
        signal,
        log,
        onCheck: (check) => {
          result.checks.push(check);
          emit({ type: "check", check });
        },
      });
      return "Independent standard behavior and required fixed acceptance passed in disposable fixtures";
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

/** Races one pack check against its deadline; a hung check must not hold the whole run open. */
function withTimeout<T>(work: Promise<T>, timeoutMs: number, minutes: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StepTimeout("test-packs", minutes)), timeoutMs);
    timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export {
  assertExecutedTests,
  assertGeneratedIntegrity,
  assertPlaywrightTests,
  fixtureCompose,
  freePort,
  verifyBehavior,
} from "./behavior.ts";
export {
  assertComposeEnvironment,
  missingComposeEnvironment,
  parseEnvFile,
  requiredComposeVariables,
} from "./compose.ts";

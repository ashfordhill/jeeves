/**
 * Jeeves-run checks after each task (PLAN §10, Execute step 3): install, type check, the
 * project's tests, `docker compose up --wait`, and every template test pack. The agent's own
 * report never counts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planProject, templateSet } from "@jeeves/generator";
import { runBaseline, taskCheckSteps } from "@jeeves/generator/baseline";
import type { AttemptEvent, CheckRecord, CheckStepRecord } from "./execute.ts";
import { readGeneratedProject } from "./project.ts";

export type ChecksResult = { ok: boolean; steps: CheckStepRecord[]; checks: CheckRecord[] };

export type ChecksInput = {
  dir: string;
  /** Files the task changed (relative to `dir`). */
  changed: string[];
  requiredExtensions?: Record<string, string[]>;
  signal: AbortSignal;
  onEvent: (event: Omit<AttemptEvent, "t">) => void;
};

export interface ProjectChecks {
  run(input: ChecksInput): Promise<ChecksResult>;
}

const titles = new Map<string, string>(taskCheckSteps.map((s) => [s.id, s.title]));

/** The real checks, through the generator's baseline (Docker and pnpm needed). */
export function projectChecks(): ProjectChecks {
  return {
    async run({ dir, signal, onEvent, requiredExtensions }) {
      const { design } = readGeneratedProject(dir);
      const name = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name ?? "project";
      const { subjects } = planProject(design, templateSet(), { projectName: String(name) });
      const result = await runBaseline({
        dir,
        design,
        subjects,
        signal,
        unitTests: true,
        requiredExtensions,
        onEvent: (event) => {
          if (event.type === "log") onEvent({ kind: "log", text: event.line });
          else if (event.type === "step") {
            onEvent({
              kind: "step",
              text: [titles.get(event.step) ?? event.step, event.message]
                .filter(Boolean)
                .join(": "),
              status: event.status,
            });
          } else {
            const { check } = event;
            onEvent({
              kind: "check",
              text: `${check.layer ?? "template"} — ${check.subject}: ${check.title}${check.error || check.reason ? ` (${check.error ?? check.reason})` : ""}`,
              status: check.status,
            });
          }
        },
      });
      return {
        ok: result.ok,
        steps: result.steps.map((s) => ({ ...s, title: titles.get(s.step) ?? s.step })),
        checks: result.checks.map(
          ({ subject, id, title, status, durationMs, error, reason, layer }) => ({
            subject,
            id,
            title,
            status,
            durationMs,
            ...(reason && { reason }),
            ...(layer && { layer }),
            ...(error ? { error } : {}),
          }),
        ),
      };
    },
  };
}

/** Marker that makes `markerChecks` fail, so fake-agent tests can script a red check. */
export const FAIL_MARKER = "JEEVES_FAKE_CHECK_FAIL";

/**
 * Checks for tests without Docker: one "project tests" check that fails when a changed file
 * contains `FAIL_MARKER`.
 */
export function markerChecks(delayMs = 0): ProjectChecks {
  return {
    async run({ dir, changed, onEvent }) {
      const started = Date.now();
      onEvent({ kind: "step", text: "Unit and project tests", status: "running" });
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const failing = changed.filter((path) => {
        try {
          return readFileSync(join(dir, path), "utf8").includes(FAIL_MARKER);
        } catch {
          return false;
        }
      });
      const ok = failing.length === 0;
      const error = ok ? undefined : `Assertion failed in ${failing.join(", ")}`;
      const durationMs = Date.now() - started;
      onEvent({
        kind: "check",
        text: `project: tests${error ? ` (${error})` : ""}`,
        status: ok ? "passed" : "failed",
      });
      onEvent({ kind: "step", text: "Unit and project tests", status: ok ? "passed" : "failed" });
      return {
        ok,
        steps: [
          {
            step: "unit-tests",
            title: "Unit and project tests",
            status: ok ? "passed" : "failed",
            durationMs,
            ...(error ? { message: error } : {}),
          },
        ],
        checks: [
          {
            subject: "project",
            id: "tests",
            title: "Project tests",
            status: ok ? "passed" : "failed",
            durationMs,
            ...(error ? { error } : {}),
          },
        ],
      };
    },
  };
}

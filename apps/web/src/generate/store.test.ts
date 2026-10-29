import { describe, expect, it } from "vitest";
import type { Generation } from "../draw/api.ts";
import { statusText } from "./GenerateDrawer.tsx";
import { applyEvent } from "./store.ts";

const generation = (patch: Partial<Generation> = {}): Generation => ({
  id: 1,
  projectId: "p",
  revision: 3,
  outputDir: "/tmp/shorty",
  baseline: true,
  status: "running",
  steps: [
    { id: "generate", title: "Write the template project", status: "running" },
    { id: "install", title: "Install dependencies", status: "pending" },
  ],
  checks: [],
  log: [],
  report: null,
  error: null,
  createdAt: "2026-10-29T00:00:00Z",
  finishedAt: null,
  ...patch,
});

describe("applyEvent", () => {
  it("replaces the generation on snapshot and done", () => {
    const done = generation({ status: "succeeded" });
    expect(applyEvent(null, { type: "snapshot", generation: generation() })).toEqual(generation());
    expect(applyEvent(generation(), { type: "done", generation: done })).toBe(done);
  });

  it("updates one step, appends log lines and checks", () => {
    let g = applyEvent(generation(), {
      type: "step",
      step: {
        id: "generate",
        title: "Write the template project",
        status: "passed",
        durationMs: 9,
      },
    });
    g = applyEvent(g, { type: "log", line: { step: "install", line: "$ pnpm install" } });
    g = applyEvent(g, {
      type: "check",
      check: {
        subject: "links",
        template: "http-service@0.1.0",
        id: "health",
        title: "health",
        status: "passed",
        durationMs: 2,
      },
    });
    expect(g?.steps.map((s) => s.status)).toEqual(["passed", "pending"]);
    expect(g?.log).toEqual([{ step: "install", line: "$ pnpm install" }]);
    expect(g?.checks).toHaveLength(1);
  });

  it("ignores live events before a snapshot", () => {
    expect(applyEvent(null, { type: "log", line: { step: "install", line: "x" } })).toBeNull();
  });
});

describe("statusText", () => {
  it("says green only when the baseline ran and passed", () => {
    expect(statusText(generation({ status: "succeeded" }))).toBe("Green");
    expect(statusText(generation({ status: "succeeded", baseline: false }))).toBe(
      "Written, baseline not run",
    );
    expect(statusText(generation({ status: "blocked" }))).toBe("Stopped");
  });
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "@jeeves/generator";
import {
  type AttemptOutcome,
  STUB_SUMMARY,
  SUBMIT_PLAN,
  stubExecutor,
  type TaskExecutor,
} from "@jeeves/orchestrator";
import { createFakeProvider, type Script } from "@jeeves/providers";
import { designSchema, type OperationInput } from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { fromPglite } from "pg-boss";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ModelSource } from "../chat/service.ts";
import type { Db } from "../db/client.ts";
import type { GeneratorRunner } from "../generate/service.ts";
import { type JobQueue, type LocalJobs, localJobs, pgBossJobs } from "../runs/jobs.ts";
import { type RunDetail, recoverRuns, requeuePlanning } from "../runs/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

const linkShortener = designSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../../fixtures/designs/link-shortener.json", import.meta.url),
      "utf8",
    ),
  ),
);
const linkShortenerOps: OperationInput[] = [
  ...linkShortener.elements.map((element) => ({ op: "addElement" as const, element })),
  ...linkShortener.connections.map((connection) => ({ op: "connect" as const, connection })),
];

/** Real generation (no `pnpm pack`, no git) and a baseline that passes without Docker. */
const generator: GeneratorRunner = {
  generate: (options) =>
    generateProject({
      ...options,
      git: false,
      vendor: async (dir) => {
        mkdirSync(join(dir, "vendor/jeeves"), { recursive: true });
        return [];
      },
    }),
  baseline: async () => ({ ok: true, steps: [], checks: [] }),
};

const acceptance = ["a test proves it"];
/** The planner splits the Links service's own task in two. */
const refinedPlan = {
  summary: "Split the service into redirects and click counting.",
  tasks: [
    {
      element: "links",
      attachment: "links-api",
      title: "Create and fetch links",
      description: "POST /links, GET /links/:code",
      acceptance: ["POST /api/links returns 201 with a code"],
    },
    { element: "links", title: "Redirect short codes", description: "302", acceptance },
    { element: "links", title: "Count clicks", description: "Clicks", acceptance },
    { element: "web", title: "Shorten form and recent links", description: "Page", acceptance },
  ],
};
const plannerScript: Script = [{ toolCalls: [{ name: SUBMIT_PLAN, arguments: refinedPlan }] }];

const fakeModels =
  (script: Script = plannerScript): ModelSource =>
  () => ({ provider: createFakeProvider(script), model: "fake-planner" });

let db: Db;
let close: () => Promise<void>;
const projectsDir = mkdtempSync(join(tmpdir(), "jeeves-runs-"));
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ({ db, close } = await openTestDb());
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

afterAll(async () => {
  await close();
  rmSync(projectsDir, { recursive: true, force: true });
});

async function waitFor<T>(check: () => Promise<T | undefined | false>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** An executor whose attempts finish only when the test releases them. */
function gatedExecutor() {
  const waiting: { taskId: number; finish: (outcome: AttemptOutcome) => void }[] = [];
  const executor: TaskExecutor = {
    execute: ({ task, signal }) =>
      new Promise((resolve, reject) => {
        waiting.push({ taskId: task.id, finish: resolve });
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  };
  return {
    executor,
    /** Waits for the next attempt to start, then finishes it with `outcome`. */
    async finishNext(
      outcome: AttemptOutcome = { status: "succeeded", summary: "ok", usage: null },
    ) {
      const next = await waitFor(async () => waiting.shift());
      next.finish(outcome);
      return next.taskId;
    },
    started: () => waiting.length,
  };
}

type HarnessOptions = {
  models?: ModelSource;
  executor?: TaskExecutor;
  jobs?: JobQueue;
  db?: Db;
};

function harness(options: HarnessOptions = {}) {
  const jobs = options.jobs ?? localJobs();
  const app = buildTestApp(options.db ?? db, {
    generator,
    projectsDir,
    models: options.models ?? fakeModels(),
    executor: options.executor ?? stubExecutor(),
    jobs,
  });
  apps.push(app);
  const call = async (
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    body?: unknown,
  ) => {
    const res = await app.inject({
      method,
      url,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };
  const h = {
    app,
    call,
    jobs,
    async project(name = "Shorty") {
      const created = await call("POST", "/projects", { name });
      const id = created.body.project.id as string;
      const edited = await call("POST", `/projects/${id}/operations`, {
        baseRevision: 0,
        ops: linkShortenerOps,
      });
      expect(edited.status).toBe(200);
      return id;
    },
    /** Generates the project (baseline included unless `baseline: false`) and waits for it. */
    async generate(projectId: string, baseline = true) {
      const outputDir = join(projectsDir, `${projectId}`);
      const started = await call("POST", `/projects/${projectId}/generations`, {
        outputDir,
        baseline,
      });
      expect(started.status).toBe(202);
      await waitFor(async () => {
        const { body } = await call("GET", `/projects/${projectId}/generation`);
        return body.latest.status === "succeeded";
      });
      return outputDir;
    },
    async detail(projectId: string, runId: number): Promise<RunDetail> {
      const res = await call("GET", `/projects/${projectId}/runs/${runId}`);
      expect(res.status).toBe(200);
      return res.body;
    },
    async until(projectId: string, runId: number, status: string) {
      return waitFor(async () => {
        const detail = await h.detail(projectId, runId);
        return detail.run.status === status && detail;
      });
    },
    /** Plans a run on a generated project and waits for the plan. */
    async planned(projectId: string) {
      const created = await call("POST", `/projects/${projectId}/runs`);
      expect(created.status).toBe(202);
      expect(created.body.run.status).toBe("planning");
      return h.until(projectId, created.body.run.id, "planned");
    },
    act(projectId: string, runId: number, action: string) {
      return call("POST", `/projects/${projectId}/runs/${runId}/${action}`);
    },
  };
  return h;
}

const taskSummary = (detail: RunDetail) =>
  detail.tasks.map((t) => [t.key, t.title, t.status] as const);

describe("planning", () => {
  it("can't plan a project that hasn't been generated", async () => {
    const h = harness();
    const id = await h.project();
    const overview = await h.call("GET", `/projects/${id}/runs`);
    expect(overview.body).toEqual({
      runs: [],
      readiness: {
        outputDir: null,
        ready: false,
        reason: expect.stringContaining("Generate the project first"),
      },
    });
    const created = await h.call("POST", `/projects/${id}/runs`);
    expect(created.status).toBe(422);
    expect(created.body.code).toBe("PROJECT_NOT_GENERATED");
  });

  it("plans a generated fixture project with the planner into dependency-ordered tasks", async () => {
    const h = harness();
    const id = await h.project();
    const outputDir = await h.generate(id);
    expect((await h.call("GET", `/projects/${id}/runs`)).body.readiness).toEqual({
      outputDir,
      ready: true,
      reason: null,
    });

    const detail = await h.planned(id);
    expect(taskSummary(detail)).toEqual([
      ["links.links-api", "Create and fetch links", "pending"],
      ["links", "Redirect short codes", "pending"],
      ["links-2", "Count clicks", "pending"],
      ["web", "Shorten form and recent links", "pending"],
    ]);
    expect(detail.tasks[0]).toMatchObject({
      element: "links",
      attachment: "links-api",
      acceptance: ["POST /api/links returns 201 with a code"],
      ownedPaths: ["contracts/links.openapi.yaml", "services/links/"],
      dependsOn: ["links-db"],
      source: "planner",
      position: 0,
    });
    expect(detail.run).toMatchObject({
      status: "planned",
      outputDir,
      designRevision: 1,
      warnings: [],
      planner: {
        mode: "refined",
        model: "fake-planner",
        message: "Split the service into redirects and click counting.",
        usage: { inputTokens: 100, outputTokens: 20, known: true },
      },
    });
    expect(detail.actions).toEqual(["start", "replan", "cancel"]);
    expect(detail.editable).toBe(true);
    expect(detail.orderProblems).toEqual([]);
  });

  it("falls back to the seed, in dependency order, when no planner model is set up", async () => {
    const h = harness({ models: () => ({ error: "No OpenAI API key is set." }) });
    const id = await h.project();
    await h.generate(id, false);
    const detail = await h.planned(id);
    expect(taskSummary(detail)).toEqual([
      ["links.links-api", "Implement REST API server (links-api) on Links service", "pending"],
      ["links", "Implement Links service", "pending"],
      ["web", "Implement Web app", "pending"],
    ]);
    expect(detail.run.planner).toEqual({
      mode: "seed",
      model: null,
      message: "The planner model wasn't used: No OpenAI API key is set.",
      usage: null,
    });
    expect(detail.run.warnings).toEqual([expect.stringContaining("baseline check hasn't passed")]);
    expect(detail.usage.total).toEqual({ inputTokens: 0, outputTokens: 0, known: true });
  });

  it("uses the seed and says why when the provider is out of quota", async () => {
    const h = harness({ models: fakeModels([{ error: "quota" }]) });
    const id = await h.project();
    await h.generate(id);
    const detail = await h.planned(id);
    expect(detail.tasks).toHaveLength(3);
    expect(detail.run.planner?.mode).toBe("seed");
    expect(detail.run.planner?.message).toMatch(/failed \(quota\).*press Plan again/);
  });

  it("warns when the design changed after generation, and allows one active run", async () => {
    const h = harness();
    const id = await h.project();
    await h.generate(id);
    const renamed = await h.call("POST", `/projects/${id}/operations`, {
      baseRevision: 1,
      ops: [{ op: "updateElement", id: "web", name: "Site" }],
    });
    expect(renamed.status).toBe(200);
    const detail = await h.planned(id);
    expect(detail.run.warnings).toEqual([
      expect.stringContaining("design changed after the project was generated (revision 1, now 2)"),
    ]);
    const second = await h.call("POST", `/projects/${id}/runs`);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("RUN_ACTIVE");

    // Plan again replaces the tasks.
    const firstIds = detail.tasks.map((t) => t.id);
    expect((await h.act(id, detail.run.id, "replan")).status).toBe(200);
    const again = await h.until(id, detail.run.id, "planned");
    expect(again.tasks.map((t) => t.id)).not.toEqual(firstIds);
    expect(again.tasks).toHaveLength(4);
  });
});

describe("editing the plan", () => {
  it("edits, removes, and reorders pending tasks, and the changes persist", async () => {
    const h = harness();
    const id = await h.project();
    await h.generate(id);
    const { run, tasks } = await h.planned(id);
    const [api, redirect, clicks, web] = tasks.map((t) => t.id) as [number, number, number, number];
    const url = (taskId: number) => `/projects/${id}/runs/${run.id}/tasks/${taskId}`;

    const edited = await h.call("PATCH", url(redirect), {
      title: "Redirect GET /:code",
      acceptance: ["GET /abc123 returns 302 to the URL", "An unknown code returns 404"],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.task).toMatchObject({ title: "Redirect GET /:code", edited: true });
    expect((await h.call("PATCH", url(redirect), {})).status).toBe(400);
    expect((await h.call("PATCH", url(redirect), { title: " " })).status).toBe(400);

    expect((await h.call("DELETE", url(clicks))).status).toBe(204);
    expect((await h.call("DELETE", url(clicks))).status).toBe(404);

    const order = `/projects/${id}/runs/${run.id}/order`;
    expect((await h.call("PUT", order, { taskIds: [web, api] })).status).toBe(422);
    expect((await h.call("PUT", order, { taskIds: [web, api, redirect] })).status).toBe(204);

    // A fresh app on the same database (as after a restart) sees the same plan.
    const reloaded = await harness().detail(id, run.id);
    expect(reloaded.tasks.map((t) => [t.id, t.title, t.position])).toEqual([
      [web, "Shorten form and recent links", 0],
      [api, "Create and fetch links", 1],
      [redirect, "Redirect GET /:code", 2],
    ]);
    expect(reloaded.tasks[2]?.acceptance).toEqual([
      "GET /abc123 returns 302 to the URL",
      "An unknown code returns 404",
    ]);
    expect(reloaded.orderProblems).toEqual([
      {
        taskId: web,
        message:
          '"Shorten form and recent links" comes before "Create and fetch links", but web depends on links.',
      },
    ]);
  });
});

describe("running (stub execution)", () => {
  it("marks every task done in order, records attempts, and succeeds", async () => {
    const h = harness();
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    const started = await h.act(id, run.id, "start");
    expect(started.status).toBe(200);
    expect(started.body.run.status).toBe("running");

    const done = await h.until(id, run.id, "succeeded");
    expect(done.tasks.map((t) => t.status)).toEqual(["done", "done", "done", "done"]);
    expect(done.tasks[0]?.attempts).toEqual([
      expect.objectContaining({ number: 1, status: "succeeded", summary: STUB_SUMMARY }),
    ]);
    expect(done.run.finishedAt).not.toBeNull();
    expect(done.actions).toEqual([]);
    // The stub reports no usage, so the run's total is unknown.
    expect(done.usage.total.known).toBe(false);
    expect((await h.act(id, run.id, "start")).body.code).toBe("RUN_STATE");
    const list = await h.call("GET", `/projects/${id}/runs`);
    expect(list.body.runs[0]).toMatchObject({ id: run.id, taskCount: 4, doneCount: 4 });
  });

  it("pauses between tasks, refuses edits while running, and resumes", async () => {
    const gate = gatedExecutor();
    const h = harness({ executor: gate.executor });
    const id = await h.project();
    await h.generate(id);
    const { run, tasks } = await h.planned(id);
    await h.act(id, run.id, "start");
    await waitFor(async () => gate.started() === 1);

    const edit = await h.call("PATCH", `/projects/${id}/runs/${run.id}/tasks/${tasks[2]?.id}`, {
      title: "x",
    });
    expect(edit.status).toBe(409);

    expect((await h.act(id, run.id, "pause")).body.run.status).toBe("paused");
    expect(await gate.finishNext()).toBe(tasks[0]?.id);
    await (h.jobs as LocalJobs).idle();
    let detail = await h.detail(id, run.id);
    expect(detail.run.status).toBe("paused");
    expect(detail.tasks.map((t) => t.status)).toEqual(["done", "pending", "pending", "pending"]);

    // Paused runs can be edited, then resumed.
    const removed = await h.call("DELETE", `/projects/${id}/runs/${run.id}/tasks/${tasks[3]?.id}`);
    expect(removed.status).toBe(204);
    expect((await h.act(id, run.id, "resume")).body.run.status).toBe("running");
    await gate.finishNext();
    await gate.finishNext();
    detail = await h.until(id, run.id, "succeeded");
    expect(detail.tasks.map((t) => t.status)).toEqual(["done", "done", "done"]);
  });

  it("cancel stops the task in progress and the rest of the plan", async () => {
    const gate = gatedExecutor();
    const h = harness({ executor: gate.executor });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    await gate.finishNext();
    await waitFor(async () => gate.started() === 1);
    expect((await h.act(id, run.id, "cancel")).body.run.status).toBe("cancelled");
    await (h.jobs as LocalJobs).idle();
    const detail = await h.detail(id, run.id);
    expect(detail.tasks.map((t) => t.status)).toEqual([
      "done",
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
    expect(detail.tasks[1]?.attempts).toEqual([expect.objectContaining({ status: "cancelled" })]);
    // A cancelled run no longer blocks a new one.
    expect((await h.call("POST", `/projects/${id}/runs`)).status).toBe(202);
  });

  it("a failed attempt stops the run as needs-attention", async () => {
    const gate = gatedExecutor();
    const h = harness({ executor: gate.executor });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    await gate.finishNext({
      status: "failed",
      summary: "Tests failed",
      usage: { inputTokens: 10, outputTokens: 5, known: true },
      error: "2 tests failed",
    });
    const detail = await h.until(id, run.id, "needs-attention");
    expect(detail.run.statusReason).toBe('"Create and fetch links" failed: 2 tests failed');
    expect(detail.tasks[0]).toMatchObject({ status: "needs-attention" });
    expect(detail.usage.attempts).toEqual({ inputTokens: 10, outputTokens: 5, known: true });
    expect(detail.actions).toEqual(["resume", "cancel"]);
  });
});

describe("restarts", () => {
  it("a run survives a server restart: the attempt is interrupted and the run resumes", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jeeves-runs-pg-"));
    try {
      // First "process": real pg-boss on PGlite, crashing while the second task runs.
      const first = await openTestDb(dataDir);
      const firstJobs = await pgBossJobs({ db: fromPglite(first.client) });
      const gate = gatedExecutor();
      const h1 = harness({ db: first.db, jobs: firstJobs, executor: gate.executor });
      const id = await h1.project();
      await h1.generate(id);
      const { run } = await h1.planned(id);
      await h1.act(id, run.id, "start");
      await gate.finishNext();
      await waitFor(async () => gate.started() === 1);
      const before = await h1.detail(id, run.id);
      expect(before.tasks.map((t) => t.status)).toEqual(["done", "running", "pending", "pending"]);
      await firstJobs.stop({ graceful: false });
      await h1.app.close();
      await first.close();

      // Second "process" on the same data.
      const second = await openTestDb(dataDir);
      await recoverRuns(second.db);
      const secondJobs = await pgBossJobs({ db: fromPglite(second.client) });
      try {
        const h2 = harness({ db: second.db, jobs: secondJobs });
        const after = await h2.detail(id, run.id);
        expect(after.run).toMatchObject({
          status: "paused",
          statusReason: expect.stringContaining("Jeeves restarted"),
        });
        expect(after.tasks.map((t) => t.status)).toEqual(["done", "pending", "pending", "pending"]);
        expect(after.tasks[1]?.attempts).toEqual([
          expect.objectContaining({ number: 1, status: "interrupted" }),
        ]);
        expect(after.actions).toEqual(["resume", "cancel"]);

        await h2.act(id, run.id, "resume");
        const done = await h2.until(id, run.id, "succeeded");
        expect(done.tasks.map((t) => t.status)).toEqual(["done", "done", "done", "done"]);
        expect(done.tasks[1]?.attempts.map((a) => [a.number, a.status])).toEqual([
          [1, "interrupted"],
          [2, "succeeded"],
        ]);
      } finally {
        await secondJobs.stop();
        await second.close();
      }
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 60_000);

  it("planning interrupted by a restart is planned again on start", async () => {
    const h = harness();
    const id = await h.project();
    await h.generate(id);
    // The old process created the run, then stopped before its plan job ran.
    const dropJobs: JobQueue = { work: async () => {}, send: async () => {}, stop: async () => {} };
    const created = await harness({ jobs: dropJobs }).call("POST", `/projects/${id}/runs`);
    expect(created.body.run.status).toBe("planning");
    const restarted = harness();
    await restarted.app.ready();
    await requeuePlanning(db, restarted.jobs);
    await restarted.until(id, created.body.run.id, "planned");
  });
});

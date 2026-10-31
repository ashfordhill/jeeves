import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "@jeeves/generator";
import {
  type AttemptOutcome,
  createAgentExecutor,
  FAIL_MARKER,
  markerChecks,
  readGeneratedProject,
  STUB_SUMMARY,
  SUBMIT_PLAN,
  stubExecutor,
  type TaskExecutor,
} from "@jeeves/orchestrator";
import {
  codingScriptByTask,
  createFakeCodingAgent,
  createFakeProvider,
  type FakeCodingAgent,
  ProviderError,
  type Script,
} from "@jeeves/providers";
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

/**
 * Real generation (no `pnpm pack`; git only when asked) and a baseline that passes without
 * Docker. Like a real baseline, it leaves an uncommitted `pnpm-lock.yaml`.
 */
const makeGenerator = (git: boolean): GeneratorRunner => ({
  generate: async (options) => {
    const structured = options.design.elements.some((element) =>
      element.attachments.some(
        (attachment) => attachment.template.id === "rest-api-server" && attachment.config.model,
      ),
    );
    const report = await generateProject({
      ...options,
      fixedAcceptance:
        options.fixedAcceptance ??
        (structured
          ? [
              {
                id: "activity",
                service: "links",
                operationIds: ["qrActivity"],
                acceptanceIds: ["ACT-01"],
                source: 'import test from "node:test"; test("fixed activity",()=>{});\n',
              },
            ]
          : undefined),
      git,
      vendor: async (dir) => {
        mkdirSync(join(dir, "vendor/jeeves"), { recursive: true });
        return [];
      },
    });
    writeFileSync(join(options.dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(
      join(options.dir, ".env"),
      "DB_LINKS_PASSWORD=test-password\nLINKS_PUBLIC_ORIGIN=http://127.0.0.1:1\n",
    );
    return report;
  },
  baseline: async () => ({ ok: true, steps: [], checks: [] }),
});
const generator = makeGenerator(false);

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
function gatedExecutor(measured = false) {
  const waiting: { taskId: number; finish: (outcome: AttemptOutcome) => void }[] = [];
  const executor: TaskExecutor = {
    execute: async ({ task, signal, saveUsage, saveInvocation }) => {
      if (measured) {
        await saveInvocation?.({
          provider: "partial",
          model: "restart-model",
          prompt: "A durable prompt",
          startingCommit: "start",
        });
        await saveUsage?.({ inputTokens: 17, outputTokens: 4, known: false });
      }
      return new Promise((resolve, reject) => {
        waiting.push({ taskId: task.id, finish: resolve });
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    },
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
  generator?: GeneratorRunner;
};

function harness(options: HarnessOptions = {}) {
  const jobs = options.jobs ?? localJobs();
  const app = buildTestApp(options.db ?? db, {
    generator: options.generator ?? generator,
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
    async project(name = "Shorty", ops = linkShortenerOps) {
      const created = await call("POST", "/projects", { name });
      const id = created.body.project.id as string;
      const edited = await call("POST", `/projects/${id}/operations`, {
        baseRevision: 0,
        ops,
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
        if (body.latest.status === "failed")
          throw new Error(
            `Fixture generation failed: ${body.latest.error ?? JSON.stringify(body.latest.report)}`,
          );
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
  it("reports generated workspace coverage and plans no implementation model calls", async () => {
    let providerCalls = 0;
    const h = harness({
      generator: {
        ...generator,
        generate: async (options) => {
          const result = await generator.generate({ ...options, fixedAcceptance: [] });
          writeFileSync(
            join(options.dir, ".env"),
            "DB_INVENTORY_PASSWORD=test-password\nINVENTORY_PUBLIC_ORIGIN=http://127.0.0.1:1\n",
          );
          return result;
        },
      },
      models: () => {
        providerCalls++;
        return { error: "must not select a model" };
      },
    });
    const design = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../../fixtures/designs/generated-workspace.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const id = await h.project("Generated Inventory", [
      ...design.elements.map((element) => ({ op: "addElement" as const, element })),
      ...design.connections.map((connection) => ({ op: "connect" as const, connection })),
    ]);
    const output = await h.generate(id);
    const detail = await h.planned(id);
    expect(detail.tasks).toEqual([]);
    expect(providerCalls).toBe(0);
    expect(detail.run.planner?.message).toContain("resource workspace supplies");
    expect(detail.capabilities.join(" ")).toContain("generated resource workspace 0.1.0");
    writeFileSync(join(output, "frontends/inventory-web/src/App.tsx"), "// replaced root\n");
    expect(() => readGeneratedProject(output)).toThrow("Protected artifact changed");
  });

  it("plans a complete product recipe without selecting a model or creating implementation tasks", async () => {
    let providerCalls = 0;
    const h = harness({
      models: () => {
        providerCalls++;
        return { error: "must not select a model" };
      },
      generator: {
        generate: (options) => generateProject({ ...options, git: false }),
        baseline: async () => ({ ok: true, steps: [], checks: [] }),
      },
    });
    const created = await h.call("POST", "/projects/from-recipe", {
      name: "Provided studio",
      recipe: { id: "qr-studio", version: "0.1.0" },
    });
    expect(created.status).toBe(201);
    const id = created.body.project.id;
    await h.generate(id);
    const detail = await h.planned(id);
    expect(detail.tasks).toEqual([]);
    expect(providerCalls).toBe(0);
    expect(detail.run.planner?.message).toContain("No implementation model");
    expect(detail.capabilities.join(" ")).toContain("recipe-provided");
  });
  it("keeps structured tasks deterministic and reports required operations removed from the plan", async () => {
    let plannerCalled = false;
    const h = harness({
      models: () => {
        plannerCalled = true;
        return { error: "unused" };
      },
    });
    const resourceDesign = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../../fixtures/designs/resources.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const ops: OperationInput[] = [
      ...resourceDesign.elements.map((element) => ({ op: "addElement" as const, element })),
      ...resourceDesign.connections.map((connection) => ({ op: "connect" as const, connection })),
    ];
    const id = await h.project("Structured", ops);
    await h.generate(id);
    const detail = await h.planned(id);
    expect(plannerCalled).toBe(false);
    expect(detail.tasks.map((task) => task.key)).toEqual([
      "links.links-api.extension.activity",
      "web",
    ]);
    const extension = detail.tasks[0]!;
    expect(extension.acceptance).toEqual(["ACT-01"]);
    expect(
      (await h.call("DELETE", `/projects/${id}/runs/${detail.run.id}/tasks/${extension.id}`))
        .status,
    ).toBe(204);
    expect((await h.act(id, detail.run.id, "start")).status).toBe(200);
    const stopped = await h.until(id, detail.run.id, "needs-attention");
    expect(stopped.run.statusReason).toContain(
      "Unverified required extension operations: links/qrActivity",
    );
  });
  it("stops a structured run when declared acceptance cases have no passing suite record", async () => {
    const h = harness();
    const resourceDesign = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../../fixtures/designs/resources.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const ops: OperationInput[] = [
      ...resourceDesign.elements.map((element) => ({ op: "addElement" as const, element })),
      ...resourceDesign.connections.map((connection) => ({ op: "connect" as const, connection })),
    ];
    const id = await h.project("Structured terminal gate", ops);
    await h.generate(id);
    const detail = await h.planned(id);
    expect((await h.act(id, detail.run.id, "start")).status).toBe(200);
    const stopped = await h.until(id, detail.run.id, "needs-attention");
    expect(stopped.run.statusReason).toContain("Unverified acceptance cases: ACT-01");
  });
  it("can't plan a project that hasn't been generated", async () => {
    const h = harness();
    const id = await h.project();
    const overview = await h.call("GET", `/projects/${id}/runs`);
    expect(overview.body).toMatchObject({
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

  it("stopAll aborts a live attempt and leaves it resumable", async () => {
    const gate = gatedExecutor();
    const h = harness({ executor: gate.executor });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    await waitFor(async () => gate.started() === 1);
    await h.app.runs.stopAll(1000);
    await (h.jobs as LocalJobs).idle();
    const detail = await h.detail(id, run.id);
    expect(detail.tasks[0]).toMatchObject({ status: "pending" });
    expect(detail.tasks[0]?.attempts).toEqual([expect.objectContaining({ status: "interrupted" })]);
    // No further task started after the stop.
    expect(detail.tasks[1]?.status).toBe("pending");
  });

  it("a failed attempt is retried, then stops the run as needs-attention", async () => {
    const gate = gatedExecutor();
    const h = harness({ executor: gate.executor });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    expect(run.maxRetries).toBe(2);
    await h.act(id, run.id, "start");
    const failed: AttemptOutcome = {
      status: "failed",
      summary: "Tests failed",
      usage: { inputTokens: 10, outputTokens: 5, known: true },
      error: "2 tests failed",
      feedback: "fix them",
      sessionId: "s1",
    };
    for (let i = 0; i < 3; i++) await gate.finishNext(failed);
    const detail = await h.until(id, run.id, "needs-attention");
    expect(detail.run.statusReason).toBe(
      '"Create and fetch links" failed after 3 attempts: 2 tests failed',
    );
    expect(detail.tasks[0]).toMatchObject({ status: "needs-attention" });
    expect(detail.tasks[0]?.attempts.map((a) => [a.number, a.status, a.sessionId])).toEqual([
      [1, "failed", "s1"],
      [2, "failed", "s1"],
      [3, "failed", "s1"],
    ]);
    expect(detail.usage.attempts).toEqual({ inputTokens: 30, outputTokens: 15, known: true });
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
      const gate = gatedExecutor(true);
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
        expect(after.ledger).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              status: "interrupted",
              provider: "partial",
              model: "restart-model",
              usage: { inputTokens: 17, outputTokens: 4, known: false },
            }),
          ]),
        );
        expect(after.implementation.known).toBe(false);
        expect(after.implementation.inputTokens).toBe(134);

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

const git = (dir: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

/** The real executor with a scripted coding agent and marker checks (no Docker, no model). */
function agentHarness(script: unknown, options: Omit<HarnessOptions, "executor"> = {}) {
  const agent: FakeCodingAgent = createFakeCodingAgent(codingScriptByTask(script));
  const executor = createAgentExecutor({
    agents: () => ({ agent, model: "fake-coder" }),
    checks: markerChecks(),
  });
  const h = harness({ ...options, executor, generator: makeGenerator(true) });
  return Object.assign(h, {
    agent,
    async attempt(projectId: string, runId: number, attemptId: number) {
      const res = await h.call("GET", `/projects/${projectId}/runs/${runId}/attempts/${attemptId}`);
      expect(res.status).toBe(200);
      return res.body.attempt;
    },
  });
}

/** Each task writes one feature file inside its element. */
const featureFiles: Record<string, string> = {
  "links.links-api": "services/links/src/features/api.ts",
  links: "services/links/src/features/redirect.ts",
  "links-2": "services/links/src/features/clicks.ts",
  web: "frontends/web/src/pages/Shorten.tsx",
};
const passing = (key: string, extra = "") => ({
  write: { [featureFiles[key] as string]: `export const done = "${key}";\n${extra}` },
  message: `Implemented ${key}.`,
});
const allPassing = Object.keys(featureFiles).map((task) => ({ task, attempts: [passing(task)] }));

describe("executing with the fake coding agent", { timeout: 30_000 }, () => {
  it("runs every task, checks it, and merges each task branch into the run branch", async () => {
    const h = agentHarness({ tasks: allPassing });
    const id = await h.project();
    const dir = await h.generate(id);
    const { run } = await h.planned(id);
    expect(run.gitStrategy).toBe("branch-per-task");
    await h.act(id, run.id, "start");
    const done = await h.until(id, run.id, "succeeded");

    expect(done.tasks.map((t) => [t.key, t.status, t.attempts.length])).toEqual([
      ["links.links-api", "done", 1],
      ["links", "done", 1],
      ["links-2", "done", 1],
      ["web", "done", 1],
    ]);
    expect(done.tasks[0]?.workspace).toMatchObject({
      runBranch: `jeeves/run-${run.id}`,
      branch: `jeeves/run-${run.id}-links.links-api`,
    });
    expect(git(dir, "branch", "--show-current")).toBe(`jeeves/run-${run.id}`);
    expect(git(dir, "rev-parse", "HEAD")).toBe(done.tasks[3]?.commit);
    expect(git(dir, "log", "--first-parent", "--format=%s").split("\n").slice(0, 6)).toEqual([
      `Merge jeeves/run-${run.id}-web`,
      `Merge jeeves/run-${run.id}-links-2`,
      `Merge jeeves/run-${run.id}-links`,
      `Merge jeeves/run-${run.id}-links.links-api`,
      `Jeeves: uncommitted project changes before run ${run.id}`,
      "Generate template project from design revision 1",
    ]);
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(done.usage.attempts).toEqual({ inputTokens: 4000, outputTokens: 800, known: true });

    // The run detail lists attempts without their logs and diffs; the attempt route has them.
    const summary = done.tasks[0]?.attempts[0] as unknown as Record<string, unknown>;
    expect(summary).not.toHaveProperty("diff");
    expect(summary).not.toHaveProperty("events");
    const attempt = await h.attempt(id, run.id, summary.id as number);
    expect(attempt).toMatchObject({
      status: "succeeded",
      summary: "Implemented links.links-api.",
      sessionId: expect.stringMatching(/^fake-session-/),
      changes: [{ path: featureFiles["links.links-api"], status: "added" }],
      checks: { ok: true, rejectedPaths: [], steps: [{ step: "unit-tests", status: "passed" }] },
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
    });
    expect(attempt.diff).toContain('+export const done = "links.links-api";');
    expect(attempt.events.map((e: { kind: string }) => e.kind)).toEqual(
      expect.arrayContaining(["git", "log", "files", "message", "step", "check"]),
    );
    // The brief went to the agent, in the project folder.
    expect(h.agent.requests[0]).toMatchObject({ workingDirectory: dir, model: "fake-coder" });
    expect(h.agent.requests[0]?.prompt).toContain("# Task: Create and fetch links");
    expect(h.agent.requests[0]?.prompt).toContain("POST /api/links returns 201 with a code");
  });

  it("a timed-out coding session is not resumed by its retry", async () => {
    const previous = process.env.JEEVES_AGENT_TIMEOUT_MIN;
    process.env.JEEVES_AGENT_TIMEOUT_MIN = "0.005";
    const half = featureFiles["links.links-api"] as string;
    try {
      const h = agentHarness({
        tasks: [
          {
            task: "links.links-api",
            attempts: [
              { write: { [half]: "export const created = 1;\n" }, hang: true },
              { append: { [half]: "export const fetched = 2;\n" } },
            ],
          },
        ],
        default: { message: "skip" },
      });
      const id = await h.project();
      await h.generate(id);
      await h.call("PUT", `/projects/${id}/run-settings`, { maxRetries: 1 });
      const { run } = await h.planned(id);
      await h.act(id, run.id, "start");
      const stopped = await h.until(id, run.id, "needs-attention");
      const task = stopped.tasks[0];
      expect(task?.status).toBe("done");
      expect(task?.attempts.map((a) => a.status)).toEqual(["failed", "succeeded"]);
      expect(task?.attempts[0]?.sessionId).toBeNull();
      const retry = h.agent.requests[1];
      expect(retry?.resumeSessionId).toBeUndefined();
      expect(retry?.prompt).toContain("## Earlier work on this task");
      expect(retry?.prompt).not.toContain("Jeeves ran its checks on your work");
    } finally {
      if (previous === undefined) delete process.env.JEEVES_AGENT_TIMEOUT_MIN;
      else process.env.JEEVES_AGENT_TIMEOUT_MIN = previous;
    }
  });

  it("direct: commits each task on the run branch", async () => {
    const h = agentHarness({ tasks: allPassing });
    const id = await h.project();
    const dir = await h.generate(id);
    const saved = await h.call("PUT", `/projects/${id}/run-settings`, { gitStrategy: "direct" });
    expect(saved.body).toEqual({ gitStrategy: "direct", maxRetries: 2 });
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    await h.until(id, run.id, "succeeded");
    expect(git(dir, "log", "--format=%s").split("\n").slice(0, 4)).toEqual([
      "web: Shorten form and recent links",
      "links-2: Count clicks",
      "links: Redirect short codes",
      "links.links-api: Create and fetch links",
    ]);
    expect(git(dir, "branch", "--list", "jeeves/*").split("\n")).toHaveLength(1);
  });

  it("a failing task is retried with the check output, then pauses as needs-attention", async () => {
    const failing = { write: { [featureFiles.links as string]: `// ${FAIL_MARKER}\n` } };
    const h = agentHarness({
      tasks: [
        { task: "links.links-api", attempts: [passing("links.links-api")] },
        { task: "links", attempts: [failing, failing, failing, passing("links")] },
        ...allPassing.slice(2),
      ],
    });
    const id = await h.project();
    const dir = await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    const stopped = await h.until(id, run.id, "needs-attention");
    expect(stopped.run.statusReason).toMatch(
      /^"Redirect short codes" failed after 3 attempts: Jeeves's checks failed/,
    );
    const task = stopped.tasks[1];
    expect(task?.status).toBe("needs-attention");
    expect(task?.attempts.map((a) => a.status)).toEqual(["failed", "failed", "failed"]);
    expect(stopped.tasks.slice(2).map((t) => t.status)).toEqual(["pending", "pending"]);
    // Retries continue the same session with the failure; nothing of the task is committed.
    const [first, second] = h.agent.requests.slice(1);
    expect(second?.resumeSessionId).toBe(first?.resumeSessionId ?? "fake-session-1");
    expect(second?.prompt).toContain("Jeeves ran its checks on your work and they did not pass");
    expect(second?.prompt).toContain(`Assertion failed in ${featureFiles.links}`);
    expect(git(dir, "branch", "--show-current")).toBe(`jeeves/run-${run.id}-links`);
    expect(git(dir, "log", "-1", "--format=%s")).toBe(`Merge jeeves/run-${run.id}-links.links-api`);

    // The person resumes: attempt 4 passes, and the rest of the plan runs.
    await h.act(id, run.id, "resume");
    const done = await h.until(id, run.id, "succeeded");
    expect(done.tasks[1]?.attempts.map((a) => a.status)).toEqual([
      "failed",
      "failed",
      "failed",
      "succeeded",
    ]);
  });

  it("rejects and reverts a change outside the task's owned paths", async () => {
    const h = agentHarness({
      tasks: [
        {
          task: "links.links-api",
          attempts: [
            {
              write: {
                [featureFiles["links.links-api"] as string]: "export const api = 1;\n",
                "frontends/web/src/pages/Sneaky.tsx": "export {};\n",
              },
            },
          ],
        },
      ],
    });
    const id = await h.project();
    const dir = await h.generate(id);
    await h.call("PUT", `/projects/${id}/run-settings`, { maxRetries: 0 });
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    const stopped = await h.until(id, run.id, "needs-attention");
    expect(stopped.run.statusReason).toBe(
      `"Create and fetch links" failed: Changed files outside the task's owned paths (reverted): frontends/web/src/pages/Sneaky.tsx`,
    );
    expect(existsSync(join(dir, "frontends/web/src/pages/Sneaky.tsx"))).toBe(false);
    expect(existsSync(join(dir, featureFiles["links.links-api"] as string))).toBe(true);
    const attempt = await h.attempt(id, run.id, stopped.tasks[0]?.attempts[0]?.id as number);
    expect(attempt.checks).toEqual({
      ok: false,
      rejectedPaths: ["frontends/web/src/pages/Sneaky.tsx"],
      steps: [],
      checks: [],
    });
    expect(attempt.feedback).toContain("- frontends/web/src/pages/Sneaky.tsx");
  });

  it("a provider out of quota moves the run to waiting_for_provider; Resume tries again", async () => {
    const h = agentHarness({
      tasks: [
        { task: "links.links-api", attempts: [{ error: "quota" }, passing("links.links-api")] },
      ],
      default: { write: { "services/links/src/features/x.ts": "export {};\n" } },
    });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    const waiting = await h.until(id, run.id, "waiting_for_provider");
    expect(waiting.run.statusReason).toMatch(/^The coding agent can't continue \(quota\)/);
    expect(waiting.tasks[0]?.status).toBe("pending");
    expect(waiting.tasks[0]?.attempts.map((a) => a.status)).toEqual(["failed"]);
    expect(h.agent.requests).toHaveLength(1);
    expect(waiting.actions).toEqual(["resume", "cancel"]);
    await h.act(id, run.id, "resume");
    await waitFor(async () => (await h.detail(id, run.id)).tasks[0]?.status === "done");
  });

  it("killing the server mid-task leads to a correct resume", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jeeves-exec-pg-"));
    const half = featureFiles["links.links-api"] as string;
    const script = {
      tasks: [
        {
          task: "links.links-api",
          attempts: [
            { write: { [half]: "export const created = 1;\n" }, hang: true },
            { append: { [half]: "export const fetched = 2;\n" } },
          ],
        },
      ],
      default: { message: "skip" },
    };
    try {
      const first = await openTestDb(dataDir);
      const firstJobs = await pgBossJobs({ db: fromPglite(first.client) });
      const h1 = agentHarness(script, { db: first.db, jobs: firstJobs });
      const id = await h1.project();
      const dir = await h1.generate(id);
      await h1.call("PUT", `/projects/${id}/run-settings`, { maxRetries: 0 });
      const { run } = await h1.planned(id);
      await h1.act(id, run.id, "start");
      await waitFor(async () => existsSync(join(dir, half)));
      // "Kill" the server: jobs dropped, the agent's session never finishes.
      await firstJobs.stop({ graceful: false });
      await h1.app.close();
      await first.close();

      const second = await openTestDb(dataDir);
      await recoverRuns(second.db);
      const secondJobs = await pgBossJobs({ db: fromPglite(second.client) });
      try {
        const h2 = agentHarness(script, { db: second.db, jobs: secondJobs });
        const paused = await h2.detail(id, run.id);
        expect(paused.run.status).toBe("paused");
        expect(paused.tasks[0]?.attempts.map((a) => a.status)).toEqual(["interrupted"]);
        // The interrupted work is still in the folder, on the task branch.
        expect(readFileSync(join(dir, half), "utf8")).toBe("export const created = 1;\n");

        await h2.act(id, run.id, "resume");
        await waitFor(async () => (await h2.detail(id, run.id)).tasks[0]?.status === "done");
        const prompt = h2.agent.requests[0]?.prompt ?? "";
        expect(prompt).toMatch(/^Jeeves task: links\.links-api, attempt 2\n/);
        expect(prompt).toContain("## Earlier work on this task");
        expect(prompt).toContain("+export const created = 1;");
        expect(h2.agent.requests[0]?.resumeSessionId).toBeUndefined();
        const commit = (await h2.detail(id, run.id)).tasks[0]?.commit as string;
        expect(git(dir, "show", `${commit}:${half}`)).toBe(
          "export const created = 1;\nexport const fetched = 2;",
        );
        await h2.act(id, run.id, "cancel");
      } finally {
        await secondJobs.stop();
        await second.close();
      }
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("P5 execution modes and implementation evidence", () => {
  it("pauses review mode only after a verified commit and resumes the next task after reload", async () => {
    const h = agentHarness({ tasks: allPassing });
    const id = await h.project();
    const dir = await h.generate(id);
    const { run } = await h.planned(id);
    expect(run.executionMode).toBe("continuous");
    expect(run.kind).toBe("initial-build");
    expect(run.evidence).toMatchObject({
      startingCommit: git(dir, "rev-parse", "HEAD"),
      designHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(
      (
        await h.call("PATCH", `/projects/${id}/runs/${run.id}/mode`, {
          executionMode: "review-after-task",
        })
      ).status,
    ).toBe(204);
    await h.act(id, run.id, "start");
    const first = await h.until(id, run.id, "paused");
    expect(first.run.statusReason).toContain("passed verification and was committed");
    expect(first.tasks[0]?.commit).toBe(git(dir, "rev-parse", "HEAD"));
    expect(first.tasks.map((t) => t.status)).toEqual(["done", "pending", "pending", "pending"]);
    expect(first.ledger.filter((e) => e.kind === "coding")[0]).toMatchObject({
      provider: "fake",
      model: "fake-coder",
      status: "completed",
      request: {
        prompt: expect.stringContaining("# Task:"),
        startingCommit: expect.stringMatching(/^[a-f0-9]{40}$/),
      },
    });
    // Another app instance reads the same persisted review pause.
    const reloaded = harness();
    await recoverRuns(db);
    expect((await reloaded.detail(id, run.id)).run.executionMode).toBe("review-after-task");
    for (let completed = 2; completed <= 4; completed++) {
      await h.act(id, run.id, "resume");
      const next = await h.until(id, run.id, completed === 4 ? "succeeded" : "paused");
      expect(next.tasks.filter((t) => t.status === "done")).toHaveLength(completed);
      expect(next.tasks[0]?.attempts).toHaveLength(1);
    }
    expect(
      (
        await h.call("POST", `/projects/${id}/runs/${run.id}/interventions`, {
          note: "Reviewed downloaded image manually.",
        })
      ).status,
    ).toBe(201);
    const done = await h.detail(id, run.id);
    expect(done.run.interventions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "execution-mode", note: "review-after-task" }),
        expect.objectContaining({
          action: "human-help",
          note: "Reviewed downloaded image manually.",
          at: expect.any(String),
        }),
      ]),
    );
    expect(done.implementation).toMatchObject({
      inputTokens: 4100,
      outputTokens: 820,
      records: 5,
      tokenRecords: 5,
      costRecords: 0,
    });
    expect(Object.values(done.taskUsage).map((u) => u.inputTokens)).toEqual([
      1000, 1000, 1000, 1000,
    ]);
  });

  it("retains planning corrections, failures, replans and feature usage without double counting", async () => {
    const h = harness({
      models: fakeModels([
        { text: "invalid", usage: { inputTokens: 7, outputTokens: 3 } },
        { error: "quota" },
      ]),
    });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    const first = await h.detail(id, run.id);
    expect(first.implementation).toMatchObject({
      inputTokens: 7,
      outputTokens: 3,
      records: 2,
      tokenRecords: 1,
      known: false,
    });
    expect(first.ledger.map((e) => e.status)).toEqual(["completed", "failed"]);
    expect(first.ledger[0]?.request).toMatchObject({
      instructions: expect.any(String),
      items: expect.any(Array),
      tools: expect.any(Array),
    });
    await h.act(id, run.id, "replan");
    await h.until(id, run.id, "planned");
    expect((await h.detail(id, run.id)).implementation).toMatchObject({
      inputTokens: 14,
      records: 4,
      tokenRecords: 2,
    });
    await h.act(id, run.id, "start");
    await h.until(id, run.id, "succeeded");
    const initialUsage = (await h.call("GET", `/projects/${id}/runs`)).body.implementation;
    const created = await h.call("POST", `/projects/${id}/runs`);
    expect(created.body.run).toMatchObject({ kind: "feature", parentRunId: run.id });
    await h.until(id, created.body.run.id, "planned");
    await h.act(id, created.body.run.id, "cancel");
    const total = (await h.call("GET", `/projects/${id}/runs`)).body.implementation;
    expect(total.records).toBe(initialUsage.records + 2);
    expect(total.inputTokens).toBe(initialUsage.inputTokens + 7);
    expect(total.costRecords).toBe(0);
    expect(total).not.toHaveProperty("costUsd");
  });

  it("keeps reported usage when a provider fails after reporting it", async () => {
    const executor: TaskExecutor = {
      execute: async (input) => {
        await input.saveInvocation?.({
          provider: "metered",
          model: "selected",
          prompt: "Exact task prompt",
          startingCommit: "abc",
        });
        await input.saveUsage?.({ inputTokens: 53, outputTokens: 11, known: true, costUsd: 0.03 });
        throw new ProviderError("metered", "quota", "limit reached");
      },
    };
    const h = harness({ executor });
    const id = await h.project();
    await h.generate(id);
    const { run } = await h.planned(id);
    await h.act(id, run.id, "start");
    const stopped = await h.until(id, run.id, "waiting_for_provider");
    expect(stopped.tasks[0]?.attempts[0]?.usage).toMatchObject({ inputTokens: 53, costUsd: 0.03 });
    expect(stopped.implementation).toMatchObject({
      inputTokens: 153,
      outputTokens: 31,
      records: 2,
      tokenRecords: 2,
      costRecords: 1,
      knownCostUsd: 0.03,
    });
    expect(stopped.ledger[1]).toMatchObject({
      provider: "metered",
      model: "selected",
      status: "failed",
      request: { prompt: "Exact task prompt" },
    });
  });

  it("records human task changes and refuses a changed generated baseline", async () => {
    const h = harness();
    const id = await h.project();
    const dir = await h.generate(id);
    const { run, tasks } = await h.planned(id);
    await h.call("PATCH", `/projects/${id}/runs/${run.id}/tasks/${tasks[0]?.id}`, {
      title: "Reviewed title",
    });
    expect((await h.detail(id, run.id)).run.interventions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "edit-task",
          taskId: tasks[0]?.id,
          note: expect.stringContaining("Reviewed title"),
        }),
      ]),
    );
    const path = join(dir, "jeeves/design.json");
    const design = JSON.parse(readFileSync(path, "utf8"));
    design.revision++;
    writeFileSync(path, JSON.stringify(design));
    const started = await h.act(id, run.id, "start");
    expect(started.status).toBe(409);
    expect(started.body.code).toBe("RUN_DESIGN_CHANGED");
  });
});

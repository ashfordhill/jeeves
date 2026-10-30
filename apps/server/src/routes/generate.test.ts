import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "@jeeves/generator";
import type { BaselineOptions, BaselineResult } from "@jeeves/generator/baseline";
import { designSchema, type OperationInput } from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db/client.ts";
import {
  failInterruptedGenerations,
  type GenerationEvent,
  type GeneratorRunner,
} from "../generate/service.ts";
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

/** Real generation (without `pnpm pack` or git) and a scripted baseline, so no Docker. */
function testRunner(overrides: Partial<GeneratorRunner> = {}): GeneratorRunner {
  return {
    generate: (options) =>
      generateProject({
        ...options,
        git: false,
        vendor: async (dir, runtimes) => {
          mkdirSync(join(dir, "vendor/jeeves"), { recursive: true });
          for (const r of runtimes)
            writeFileSync(join(dir, "vendor/jeeves", `${r.version}.tgz`), "");
          return [];
        },
      }),
    baseline: async (options: BaselineOptions): Promise<BaselineResult> => {
      const emit = options.onEvent ?? (() => {});
      for (const step of ["install", "typecheck", "compose-up"] as const) {
        emit({ type: "step", step, status: "running" });
        emit({ type: "log", step, line: `${step} output` });
        emit({ type: "step", step, status: "passed", durationMs: 5 });
      }
      emit({ type: "step", step: "test-packs", status: "running" });
      const check = {
        subject: "links",
        template: "http-service@0.1.0",
        id: "health",
        title: "the container starts and /health returns 200",
        status: "passed" as const,
        durationMs: 3,
      };
      emit({ type: "check", check });
      emit({ type: "step", step: "test-packs", status: "passed", durationMs: 5 });
      emit({ type: "step", step: "compose-down", status: "passed", durationMs: 1 });
      return { ok: true, steps: [], checks: [check] };
    },
    ...overrides,
  };
}

let db: Db;
let close: () => Promise<void>;
const projectsDir = mkdtempSync(join(tmpdir(), "jeeves-projects-"));
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

function harness(runner: GeneratorRunner = testRunner()) {
  const app = buildTestApp(db, { generator: runner, projectsDir });
  apps.push(app);
  const call = async (method: "GET" | "POST", url: string, body?: unknown) => {
    const res = await app.inject({
      method,
      url,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };
  return {
    call,
    async project(name = "Link shortener", ops = linkShortenerOps) {
      const created = await call("POST", "/projects", { name });
      const id = created.body.project.id as string;
      if (ops.length > 0) {
        const edited = await call("POST", `/projects/${id}/operations`, { baseRevision: 0, ops });
        expect(edited.status).toBe(200);
      }
      return id;
    },
    async events(projectId: string, generationId: number): Promise<GenerationEvent[]> {
      const res = await app.inject({
        method: "GET",
        url: `/projects/${projectId}/generations/${generationId}/events`,
      });
      expect(res.statusCode).toBe(200);
      return res.body
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as GenerationEvent);
    },
  };
}

describe("generate", () => {
  it("suggests an output folder per project until one is chosen", async () => {
    const h = harness();
    const id = await h.project("Shorty Links!");
    const res = await h.call("GET", `/projects/${id}/generation`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      outputDir: null,
      defaultOutputDir: join(projectsDir, "shorty-links"),
      latest: null,
    });
  });

  it("writes the project, runs the baseline, and streams progress to the end", async () => {
    const h = harness();
    const id = await h.project();
    const outputDir = join(projectsDir, "shorty");
    const started = await h.call("POST", `/projects/${id}/generations`, { outputDir });
    expect(started.status).toBe(202);
    expect(started.body.generation).toMatchObject({ status: "running", outputDir, baseline: true });

    const events = await h.events(id, started.body.generation.id);
    expect(events[0]?.type).toBe("snapshot");
    const done = events.at(-1);
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(done.generation.status).toBe("succeeded");
    expect(done.generation.steps.map((s) => [s.id, s.status])).toEqual([
      ["generate", "passed"],
      ["install", "passed"],
      ["typecheck", "passed"],
      ["compose-up", "passed"],
      ["test-packs", "passed"],
      ["behavior", "skipped"],
      ["compose-down", "passed"],
    ]);
    expect(done.generation.checks).toHaveLength(1);
    expect(done.generation.report?.scaffolded).toContain("services/links/src/main.ts");
    expect(existsSync(join(outputDir, "docker-compose.yml"))).toBe(true);
    expect(existsSync(join(outputDir, "jeeves/lock.json"))).toBe(true);

    const overview = await h.call("GET", `/projects/${id}/generation`);
    expect(overview.body.outputDir).toBe(outputDir);
    expect(overview.body.latest).toMatchObject({ id: done.generation.id, status: "succeeded" });
    expect(overview.body.latest.log).toContainEqual({ step: "install", line: "install output" });
  });

  it("can skip the baseline", async () => {
    const h = harness();
    const id = await h.project();
    const outputDir = join(projectsDir, "files-only");
    const started = await h.call("POST", `/projects/${id}/generations`, {
      outputDir,
      baseline: false,
    });
    const done = (await h.events(id, started.body.generation.id)).at(-1);
    expect(done?.type === "done" && done.generation.status).toBe("succeeded");
    expect(
      done?.type === "done" && done.generation.steps.filter((s) => s.status === "skipped").length,
    ).toBe(6);
  });

  it("reports a hand-edited generated file as blocked, with nothing written", async () => {
    const h = harness();
    const id = await h.project();
    const outputDir = join(projectsDir, "drift");
    const first = await h.call("POST", `/projects/${id}/generations`, {
      outputDir,
      baseline: false,
    });
    await h.events(id, first.body.generation.id);
    writeFileSync(join(outputDir, "docker-compose.yml"), "services: {}\n");

    const second = await h.call("POST", `/projects/${id}/generations`, { baseline: false });
    expect(second.body.generation.outputDir).toBe(outputDir);
    const done = (await h.events(id, second.body.generation.id)).at(-1);
    if (done?.type !== "done") throw new Error("no done event");
    expect(done.generation.status).toBe("blocked");
    expect(done.generation.error).toMatch(/changed outside Jeeves/);
    expect(done.generation.report?.problems).toEqual([
      expect.objectContaining({ path: "docker-compose.yml", kind: "edited" }),
    ]);
    expect(readFileSync(join(outputDir, "docker-compose.yml"), "utf8")).toBe("services: {}\n");
  });

  it("refuses a design that isn't ready, an empty one, and a relative folder", async () => {
    const h = harness();
    const incomplete = await h.project("Incomplete", [
      {
        op: "addElement",
        element: { id: "web", name: "Web", template: { id: "web-app", version: "0.1.0" } },
      },
    ]);
    const notReady = await h.call("POST", `/projects/${incomplete}/generations`, {});
    expect(notReady.status).toBe(422);
    expect(notReady.body.code).toBe("DESIGN_NOT_READY");

    const empty = await h.project("Empty", []);
    expect((await h.call("POST", `/projects/${empty}/generations`, {})).body.code).toBe(
      "DESIGN_EMPTY",
    );

    const ready = await h.project();
    const relative = await h.call("POST", `/projects/${ready}/generations`, {
      outputDir: "projects/shorty",
    });
    expect(relative.status).toBe(422);
    expect(relative.body.code).toBe("INVALID_OUTPUT_DIR");
  });

  it("runs one generation per project at a time, and cancel stops it", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = harness(
      testRunner({
        baseline: async (options) => {
          options.onEvent?.({ type: "step", step: "install", status: "running" });
          await gate;
          return { ok: false, steps: [], checks: [] };
        },
      }),
    );
    const id = await h.project();
    const outputDir = join(projectsDir, "busy");
    const first = await h.call("POST", `/projects/${id}/generations`, { outputDir });
    const busy = await h.call("POST", `/projects/${id}/generations`, { outputDir });
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe("GENERATE_BUSY");

    const generationId = first.body.generation.id as number;
    const following = h.events(id, generationId);
    expect(
      (await h.call("POST", `/projects/${id}/generations/${generationId}/cancel`)).status,
    ).toBe(202);
    release();
    const done = (await following).at(-1);
    expect(done?.type === "done" && done.generation.status).toBe("cancelled");
    expect(
      (await h.call("POST", `/projects/${id}/generations/${generationId}/cancel`)).body.code,
    ).toBe("NOT_RUNNING");
  });

  it("marks a generation that was running at restart as interrupted", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = harness(
      testRunner({ baseline: () => gate.then(() => ({ ok: true, steps: [], checks: [] })) }),
    );
    const id = await h.project();
    const started = await h.call("POST", `/projects/${id}/generations`, {
      outputDir: join(projectsDir, "restart"),
    });
    await failInterruptedGenerations(db);
    // A new server (empty memory) reads it from the database.
    const fresh = harness();
    const res = await fresh.call(
      "GET",
      `/projects/${id}/generations/${started.body.generation.id}`,
    );
    expect(res.body.generation).toMatchObject({ status: "interrupted" });
    release();
    await h.events(id, started.body.generation.id);
  });
});

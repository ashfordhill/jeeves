import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecipeDesign } from "@jeeves/generator";
import { builtinRegistry } from "@jeeves/registry";
import { architectureHandoffSchema, architectureProof } from "@jeeves/spec";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

describe("P57 read-only handoff API", () => {
  let database: Awaited<ReturnType<typeof openTestDb>>;
  let app: FastifyInstance;
  const directory = mkdtempSync(join(tmpdir(), "jeeves-p57-output-"));
  let id: string;
  beforeAll(async () => {
    database = await openTestDb();
    app = buildTestApp(database.db, {
      projectsDir: directory,
      generator: {
        generate: async () => {
          throw new Error("Handoff must never generate");
        },
        baseline: async () => {
          throw new Error("Handoff must never run checks");
        },
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { name: "P57 Inventory" },
    });
    id = created.json().project.id;
    const { design } = architectureProof("inventory");
    const saved = await app.inject({
      method: "POST",
      url: `/projects/${id}/operations`,
      payload: {
        baseRevision: 0,
        ops: [
          ...design.elements.map((element) => ({ op: "addElement", element })),
          ...design.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: design.architecture },
        ],
      },
    });
    expect(saved.statusCode).toBe(200);
  });
  afterAll(async () => {
    await app?.close();
    await database?.close();
    rmSync(directory, { recursive: true, force: true });
  });
  it("exports reproducibly without design/history/layout or generated output writes", async () => {
    const before = (await app.inject({ method: "GET", url: `/projects/${id}/design` })).body;
    const layout = (await app.inject({ method: "GET", url: `/projects/${id}/layout` })).body;
    const a = await app.inject({
      method: "GET",
      url: `/projects/${id}/architecture-handoff?baseRevision=1`,
    });
    expect(a.statusCode, a.body).toBe(200);
    expect(a.headers["cache-control"]).toBe("no-store");
    const s = architectureHandoffSchema.parse(a.json().snapshot);
    expect(s.status).toBe("Blocked");
    expect(s.contracts.length).toBeGreaterThan(5);
    expect(s.evidence.generation).toBeNull();
    expect(a.body).not.toContain(directory);
    expect(readdirSync(directory)).toEqual([]);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${id}/architecture-handoff?baseRevision=1`,
        })
      ).body,
    ).toBe(a.body);
    expect((await app.inject({ method: "GET", url: `/projects/${id}/design` })).body).toBe(before);
    expect((await app.inject({ method: "GET", url: `/projects/${id}/layout` })).body).toBe(layout);
  });
  it("separates executable versions and supplied recipe behavior from verification", async () => {
    const service = new DesignService(database.db, builtinRegistry());
    const project = await service.createProject(
      "Recipe review",
      createRecipeDesign(
        { id: "qr-studio", version: "0.1.0" },
        { title: "Recipe review", hostPort: 18734 },
      ),
    );
    const result = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/architecture-handoff?baseRevision=0`,
    });
    expect(result.statusCode, result.body).toBe(200);
    const snapshot = architectureHandoffSchema.parse(result.json().snapshot);
    expect(
      snapshot.coverage.some(
        (c) => c.category === "executable" && c.available && c.version === "0.1.0",
      ),
    ).toBe(true);
    expect(snapshot.coverage.find((c) => c.category === "recipe")).toMatchObject({
      id: "qr-studio",
      version: "0.1.0",
      available: true,
    });
    expect(snapshot.coverage.find((c) => c.category === "recipe")!.behavior.length).toBeGreaterThan(
      1,
    );
    expect(snapshot.evidence.generation).toBeNull();
    expect(readdirSync(directory)).toEqual([]);
  });
  it("refuses stale captures and requires an explicit base revision", async () => {
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${id}/architecture-handoff?baseRevision=0`,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ method: "GET", url: `/projects/${id}/architecture-handoff` })).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/projects/00000000-0000-4000-8000-000000000000/architecture-handoff?baseRevision=0",
        })
      ).statusCode,
    ).toBe(404);
  });
});

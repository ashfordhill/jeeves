import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecipeDesign } from "@jeeves/generator";
import { builtinRegistry } from "@jeeves/registry";
import {
  designSchema,
  emptyDesign,
  emptyLayout,
  suggestArchitectureAnnotations,
} from "@jeeves/spec";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { Db } from "../db/client.ts";
import { designRevisions, generations, layouts, runs } from "../db/schema.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { DesignService } from "./service.ts";

let db: Db, close: () => Promise<void>;
let service: DesignService;
let app: ReturnType<typeof buildTestApp>;
const generate = vi.fn(),
  baseline = vi.fn();
const directory = mkdtempSync(join(tmpdir(), "jeeves-p52-"));
beforeAll(async () => {
  ({ db, close } = await openTestDb());
  service = new DesignService(db, builtinRegistry());
  app = buildTestApp(db, { generator: { generate, baseline } });
});
afterAll(async () => {
  await app.close();
  await close();
  rmSync(directory, { recursive: true, force: true });
});
const call = async (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) => {
  const r = await app.inject({ method, url, ...(payload && { payload }) });
  return { status: r.statusCode, body: r.body ? r.json() : undefined };
};
const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/link-shortener.json", import.meta.url),
        "utf8",
      ),
    ),
  );
it("copies legacy identities and pins, preserves the exact baseline, isolates edits/evidence/output and detects source drift/deletion", async () => {
  const original = fixture();
  const source = await service.createProject("Legacy", { design: original, layout: emptyLayout() });
  // A persisted legacy document predates the current explicit conversion path.
  await db
    .update(designRevisions)
    .set({ document: { ...original, revision: 0 } })
    .where(eq(designRevisions.projectId, source.id));
  const sentinel = join(directory, "source-owned.txt");
  writeFileSync(sentinel, "original output");
  await service.updateProject(source.id, { outputDir: directory });
  await db.insert(generations).values({
    projectId: source.id,
    revision: 0,
    outputDir: directory,
    baseline: true,
    steps: [],
    status: "succeeded",
  });
  await db
    .insert(runs)
    .values({ projectId: source.id, designRevision: 0, outputDir: directory, status: "succeeded" });
  const sourceState = await service.getDesign(source.id);
  const response = await call("POST", `/projects/${source.id}/targets`, {
    name: "Proposed",
    baseRevision: 0,
  });
  expect(response.status).toBe(201);
  const target = response.body.project;
  expect(target).toMatchObject({
    revision: 0,
    outputDir: null,
    target: {
      sourceProjectId: source.id,
      sourceRevision: 0,
      baseline: { ...original, revision: 0 },
      recipeMode: "protected-copy",
    },
  });
  expect((await service.getDesign(target.id))?.design.elements).toEqual(original.elements);
  expect((await service.architecture(target.id))?.evidence).toMatchObject({
    generation: null,
    run: null,
    outputDir: null,
  });
  expect(await service.getDesign(source.id)).toEqual(sourceState);
  expect((await service.targetComparison(target.id))?.changes).toEqual([]);
  const id = original.elements[0]!.id;
  expect(
    (
      await service.edit(target.id, {
        baseRevision: 0,
        source: "api",
        ops: [{ op: "updateElement", id, name: "Proposed API" }],
      })
    ).ok,
  ).toBe(true);
  expect((await service.targetComparison(target.id))?.changes).toMatchObject([
    { kind: "changed", path: `elements/${id}` },
  ]);
  expect(
    (
      await service.edit(source.id, {
        baseRevision: 0,
        source: "api",
        ops: [{ op: "setNotes", id, notes: "Source changed" }],
      })
    ).ok,
  ).toBe(true);
  const comparison = await service.targetComparison(target.id);
  expect(comparison?.source).toMatchObject({ revision: 1, revisionChanged: true });
  expect(comparison?.source?.drift).toHaveLength(1);
  for (const endpoint of ["generations", "runs"]) {
    const blocked = await call(
      "POST",
      `/projects/${target.id}/${endpoint}`,
      endpoint === "generations" ? { outputDir: directory, baseline: false } : {},
    );
    expect(blocked).toMatchObject({ status: 422, body: { code: "PLANNING_WORKSPACE" } });
  }
  expect((await call("PATCH", `/projects/${target.id}`, { outputDir: directory })).status).toBe(
    422,
  );
  expect(generate).not.toHaveBeenCalled();
  expect(baseline).not.toHaveBeenCalled();
  expect(readFileSync(sentinel, "utf8")).toBe("original output");
  expect(
    await db.select().from(generations).where(eq(generations.projectId, source.id)),
  ).toHaveLength(1);
  expect(await db.select().from(runs).where(eq(runs.projectId, source.id))).toHaveLength(1);
  const restarted = new DesignService(db, builtinRegistry());
  expect((await restarted.targetComparison(target.id))?.origin).toEqual(target.target);
  await service.deleteProject(source.id);
  expect((await restarted.targetComparison(target.id))?.source).toBeNull();
  expect((await restarted.targetComparison(target.id))?.origin.baseline).toEqual({
    ...original,
    revision: 0,
  });
});
it("retains protected recipe contracts unless a conceptual replacement is explicitly requested with retained provenance", async () => {
  const initial = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { hostPort: 55432, title: "Recipe source" },
  );
  const source = await service.createProject("Recipe source", initial);
  const copy = await service.createTarget(source.id, {
    name: "Protected target",
    baseRevision: 0,
    recipeMode: "protected-copy",
  });
  expect(copy.ok).toBe(true);
  if (!copy.ok) return;
  const state = (await service.getDesign(copy.project.id))!;
  expect(state.design.recipe).toEqual(initial.design.recipe);
  const removed = await service.edit(copy.project.id, {
    baseRevision: 0,
    source: "api",
    ops: [{ op: "removeElement", id: initial.design.elements[0]!.id }],
  });
  expect(removed.ok).toBe(false);
  expect(
    (
      await service.edit(copy.project.id, {
        baseRevision: 0,
        source: "api",
        ops: [{ op: "setRecipe", recipe: null }],
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await call("POST", `/projects/${source.id}/targets`, {
        name: "Bad replacement",
        baseRevision: 0,
        recipeMode: "conceptual-replacement",
      })
    ).status,
  ).toBe(400);
  const replacement = await service.createTarget(source.id, {
    name: "Concept",
    baseRevision: 0,
    recipeMode: "conceptual-replacement",
    reason: "Explore a separately scalable redirect service.",
  });
  expect(replacement.ok).toBe(true);
  if (!replacement.ok) return;
  const proposed = (await service.getDesign(replacement.project.id))!.design;
  expect(proposed.recipe).toBeUndefined();
  expect(proposed.elements).toEqual(initial.design.elements);
  expect(replacement.project.target).toMatchObject({
    baseline: { recipe: initial.design.recipe },
    recipeMode: "conceptual-replacement",
    reason: expect.any(String),
  });
  expect(
    (await call("POST", `/projects/${replacement.project.id}/generations`, {})).body.code,
  ).toBe("PLANNING_WORKSPACE");
});
it("admits incomplete planning snapshots while keeping ordinary project creation strict", async () => {
  const design = {
    ...emptyDesign(),
    elements: [
      {
        id: "planned",
        name: "Undecided implementation",
        template: null,
        config: {},
        attachments: [],
        notes: "",
      },
    ],
  };
  expect(() => service.createProject("Strict", { design, layout: emptyLayout() })).toThrow();
  const source = await service.createProject("Incomplete");
  expect(
    (
      await service.edit(source.id, {
        baseRevision: 0,
        source: "api",
        ops: [{ op: "addElement", element: design.elements[0] }],
      })
    ).ok,
  ).toBe(true);
  const target = await service.createTarget(source.id, {
    name: "Incomplete target",
    baseRevision: 1,
    recipeMode: "protected-copy",
  });
  expect(target.ok).toBe(true);
  if (!target.ok) return;
  expect(
    (await service.getDesign(target.project.id))?.findings.some((f) => f.code === "NEEDS_TEMPLATE"),
  ).toBe(true);
  const count = (await service.listProjects()).length;
  expect(
    await call("POST", `/projects/${source.id}/targets`, { name: "Stale", baseRevision: 0 }),
  ).toMatchObject({ status: 409, body: { code: "REVISION_CONFLICT" } });
  expect(await service.listProjects()).toHaveLength(count);
});
it("rolls back every target row if persistence fails after project insertion", async () => {
  const source = await service.createProject("Atomic source");
  const count = (await service.listProjects()).length;
  const revisions = (await db.select().from(designRevisions)).length;
  await db.execute(
    sql`CREATE FUNCTION p52_reject_layout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT name FROM projects WHERE id=NEW.project_id)='FailTarget' THEN RAISE EXCEPTION 'P52 injected layout failure'; END IF; RETURN NEW; END $$`,
  );
  await db.execute(
    sql`CREATE TRIGGER p52_layout_failure BEFORE INSERT ON layouts FOR EACH ROW EXECUTE FUNCTION p52_reject_layout()`,
  );
  try {
    await expect(
      service.createTarget(source.id, {
        name: "FailTarget",
        baseRevision: 0,
        recipeMode: "protected-copy",
      }),
    ).rejects.toThrow();
  } finally {
    await db.execute(sql`DROP TRIGGER p52_layout_failure ON layouts`);
    await db.execute(sql`DROP FUNCTION p52_reject_layout()`);
  }
  expect(await service.listProjects()).toHaveLength(count);
  expect(await db.select().from(layouts)).toHaveLength(count);
  expect(await db.select().from(designRevisions)).toHaveLength(revisions);
  expect((await service.getDesign(source.id))?.design).toEqual(emptyDesign());
});
it("saves editable annotations with provenance through history and leaves the baseline untouched", async () => {
  const design = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/generated-workspace.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const source = await service.createProject("Bindings", { design, layout: emptyLayout() });
  const target = await service.createTarget(source.id, {
    name: "Annotated",
    baseRevision: 0,
    recipeMode: "protected-copy",
  });
  if (!target.ok) throw new Error("target failed");
  const current = (await service.getDesign(target.project.id))!;
  const architecture = suggestArchitectureAnnotations(current.design);
  architecture.components![0]!.name = "Editable responsibility";
  expect(
    (
      await service.edit(target.project.id, {
        baseRevision: 0,
        source: "api",
        ops: [{ op: "setArchitecture", architecture }],
      })
    ).ok,
  ).toBe(true);
  expect(
    (await service.getDesign(target.project.id))?.design.architecture?.components?.[0],
  ).toMatchObject({ name: "Editable responsibility", annotationOrigin: { revision: 0 } });
  await service.undo(target.project.id, 1, "api");
  expect((await service.getDesign(target.project.id))?.design.architecture).toBeUndefined();
  await service.redo(target.project.id, 2, "api");
  expect(
    (await service.getDesign(target.project.id))?.design.architecture?.components?.[0]?.name,
  ).toBe("Editable responsibility");
  expect(
    (await service.targetComparison(target.project.id))?.origin.baseline.architecture,
  ).toBeUndefined();
});
it("rejects structurally invalid source snapshots and refuses origin mutation through PATCH", async () => {
  const source = await service.createProject("Invalid historical source");
  const e = {
    id: "duplicate",
    name: "Unimplemented",
    template: null,
    config: {},
    attachments: [],
    notes: "",
  };
  await db
    .update(designRevisions)
    .set({ document: { ...emptyDesign(), elements: [e, e] } })
    .where(eq(designRevisions.projectId, source.id));
  const count = (await service.listProjects()).length;
  const result = await call("POST", `/projects/${source.id}/targets`, {
    name: "Invalid target",
    baseRevision: 0,
  });
  expect(result).toMatchObject({ status: 422, body: { code: "INVALID_OPERATION" } });
  expect(await service.listProjects()).toHaveLength(count);
  expect(
    (await call("PATCH", `/projects/${source.id}`, { target: { sourceProjectId: "changed" } }))
      .status,
  ).toBe(400);
});

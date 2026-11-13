import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildOperationsCommand,
  buildStudioCommand,
  designBlueprintV3,
  designOperations,
  operationContractsSchema,
  positiveCachePolicy,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { resolveFixtureSeedOps } from "../../../../packages/spec/src/fixtures/nc04-compatible.ts";
import fixture from "../../../../packages/spec/src/fixtures/nc04-resolve-v1.json" with {
  type: "json",
};
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("persists exact resolve mouse commands, policy edits/unknowns, stale refusal and one-step deletion Undo over disk reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-nc04-db-"));
  let database = await openTestDb(dir),
    app = buildTestApp(database.db);
  try {
    let service = new DesignService(database.db);
    const project = await service.createProject("NC04 copy");
    const seed = await service.edit(project.id, {
      baseRevision: 0,
      source: "api",
      ops: resolveFixtureSeedOps(),
    });
    if (!seed.ok) throw new Error(JSON.stringify(seed));
    const before = seed.state.design,
      operations = operationContractsSchema.parse(fixture);
    const saved = await service.edit(project.id, {
      baseRevision: before.revision,
      source: "canvas",
      ops: buildOperationsCommand(before, { operations }).ops,
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect((await app.inject({ url: `/projects/${project.id}/blueprint` })).statusCode).toBe(422);
    expect(
      (await app.inject({ url: `/projects/${project.id}/blueprint?version=3` })).json(),
    ).toEqual(designBlueprintV3(saved.state.design));
    const changed = structuredClone(operations),
      binding = changed.receivers[1]?.binding;
    if (binding?.kind !== "resolve-link") throw new Error();
    binding.cachePolicy = { ...positiveCachePolicy.ref, version: "2.0.0", sha256: "e".repeat(64) };
    const edit = await service.edit(project.id, {
      baseRevision: saved.state.design.revision,
      source: "canvas",
      ops: [{ op: "setOperations", operations: changed }],
    });
    if (!edit.ok) throw new Error(JSON.stringify(edit));
    expect(
      await service.edit(project.id, {
        baseRevision: saved.state.design.revision,
        source: "canvas",
        ops: [{ op: "setOperations", operations }],
      }),
    ).toMatchObject({ ok: false, reason: "conflict" });
    await app.close();
    await database.close();
    database = await openTestDb(dir);
    app = buildTestApp(database.db);
    service = new DesignService(database.db);
    expect((await service.getDesign(project.id))?.design).toEqual(edit.state.design);
    const removed = await service.edit(project.id, {
      baseRevision: edit.state.design.revision,
      source: "canvas",
      ops: buildStudioCommand(edit.state.design, { type: "removeTile", tile: "url-cache" }).ops,
    });
    if (!removed.ok) throw new Error(JSON.stringify(removed));
    expect(designOperations(removed.state.design).receivers.map((x) => x.id)).toEqual([
      "create-link",
    ]);
    const undo = await service.undo(project.id, removed.state.design.revision, "canvas");
    if (!undo.ok) throw new Error();
    expect(undo.state.design).toEqual({
      ...edit.state.design,
      revision: undo.state.design.revision,
    });
    const undoPolicy = await service.undo(project.id, undo.state.design.revision, "canvas");
    if (!undoPolicy.ok) throw new Error();
    expect(designOperations(undoPolicy.state.design)).toEqual(operations);
    const undoAll = await service.undo(project.id, undoPolicy.state.design.revision, "canvas");
    if (!undoAll.ok) throw new Error();
    expect(undoAll.state.design).toEqual({ ...before, revision: undoAll.state.design.revision });
  } finally {
    await app.close();
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);

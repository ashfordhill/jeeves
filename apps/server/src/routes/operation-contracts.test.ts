import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildOperationsCommand,
  buildStudioCommand,
  designBlueprintV3,
  designOperations,
  operationContractsSchema,
  ownershipSchema,
  studioArchitectureExample,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import ownershipFixture from "../../../../packages/spec/src/fixtures/nc02-ownership-v1.json" with {
  type: "json",
};
import fixture from "../../../../packages/spec/src/fixtures/nc03-create-v1.json" with {
  type: "json",
};
import { Workspace } from "../chat/tools.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("persists exact mouse/chat operation parity, refusals/conflicts and reload/history with one Undo across upgrade and deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-nc03-db-"));
  let database = await openTestDb(dir),
    app = buildTestApp(database.db);
  try {
    let service = new DesignService(database.db);
    const project = await service.createProject("NC03 copy"),
      old = structuredClone(studioArchitectureExample("studio-tinyurl").design);
    const shorten = old.architecture?.studio?.elements.find((x) => x.element === "shorten");
    if (!shorten || !("requestTimeoutMs" in shorten.settings)) throw new Error();
    shorten.settings.requestTimeoutMs = 10000;
    const seed = await service.edit(project.id, {
      baseRevision: 0,
      source: "api",
      ops: [
        ...old.elements.map((element) => ({ op: "addElement", element })),
        ...old.connections.map((connection) => ({ op: "connect", connection })),
        { op: "setArchitecture", architecture: old.architecture },
      ],
    });
    if (!seed.ok) throw new Error();
    const before = seed.state.design,
      operations = operationContractsSchema.parse(fixture),
      args = { baseRevision: before.revision, action: "preview", operations, upgrade: true },
      chat = new Workspace(before);
    expect(
      JSON.parse(chat.run("configureOperations", JSON.stringify({ ...args, action: "apply" }))).ok,
    ).toBe(false);
    expect(JSON.parse(chat.run("configureOperations", JSON.stringify(args))).canApply).toBe(true);
    expect(chat.pending).toEqual([]);
    expect(
      JSON.parse(chat.run("configureOperations", JSON.stringify({ ...args, action: "apply" }))).ok,
    ).toBe(true);
    const mouseOps = buildOperationsCommand(before, { operations, upgrade: true }).ops;
    expect(chat.pending).toEqual(mouseOps);
    const saved = await service.edit(project.id, {
      baseRevision: before.revision,
      source: "canvas",
      ops: mouseOps,
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect(saved.state.design).toEqual(chat.working);
    const defaultExport = await app.inject({ url: `/projects/${project.id}/blueprint` });
    expect(defaultExport.statusCode).toBe(422);
    expect(defaultExport.json().unsupported.map((x: { path: unknown }) => x.path)).toEqual([
      ["operations", "receivers", 0],
      ["operations", "calls", 0],
    ]);
    expect(
      (await app.inject({ url: `/projects/${project.id}/blueprint?version=3` })).json(),
    ).toEqual(designBlueprintV3(saved.state.design));
    expect(
      await service.edit(project.id, {
        baseRevision: before.revision,
        source: "canvas",
        ops: mouseOps,
      }),
    ).toMatchObject({ ok: false, reason: "conflict" });
    const bad = structuredClone(operations);
    if (!bad.calls[0]) throw new Error();
    bad.calls[0].expects.auth = "public";
    expect(
      await service.edit(project.id, {
        baseRevision: saved.state.design.revision,
        source: "api",
        ops: [
          { op: "setOwnership", ownership: ownershipSchema.parse(ownershipFixture) },
          { op: "setOperations", operations: bad },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect((await service.getDesign(project.id))?.design).toEqual(saved.state.design);
    await app.close();
    await database.close();
    database = await openTestDb(dir);
    app = buildTestApp(database.db);
    service = new DesignService(database.db);
    expect((await service.getDesign(project.id))?.design).toEqual(saved.state.design);
    const removed = await service.edit(project.id, {
      baseRevision: saved.state.design.revision,
      source: "canvas",
      ops: buildStudioCommand(saved.state.design, { type: "removeLink", link: "shorten-db" }).ops,
    });
    if (!removed.ok) throw new Error(JSON.stringify(removed));
    expect(designOperations(removed.state.design)).toEqual({ receivers: [], calls: [] });
    const restored = await service.undo(project.id, removed.state.design.revision, "canvas");
    if (!restored.ok) throw new Error();
    expect(restored.state.design).toEqual({
      ...saved.state.design,
      revision: restored.state.design.revision,
    });
    const undo = await service.undo(project.id, restored.state.design.revision, "canvas");
    if (!undo.ok) throw new Error();
    expect(undo.state.design).toEqual({ ...before, revision: undo.state.design.revision });
    const redo = await service.redo(project.id, undo.state.design.revision, "canvas");
    if (!redo.ok) throw new Error();
    expect(designOperations(redo.state.design)).toEqual(operations);
  } finally {
    await app.close();
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);

import { buildGenerationCommand, designBlueprintV3, designGeneration } from "@jeeves/spec";
import { expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../../packages/spec/src/fixtures/yv2-selections.ts";
import { turnContext } from "../chat/tools.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("persists an atomic selection/ownership batch, carries chat/v3 declarations and restores target deletion with Undo/Redo", async () => {
  const database = await openTestDb(),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  try {
    const project = await service.createProject("Generation source boundary"),
      source = generationSourceFixture();
    if (source.schemaVersion !== 3 || !source.ownership) throw new Error();
    const seeded = await service.edit(project.id, {
      baseRevision: 0,
      source: "api",
      ops: [
        ...source.elements.map((element) => ({ op: "addElement" as const, element })),
        ...source.connections.map((connection) => ({ op: "connect" as const, connection })),
        { op: "setArchitecture", architecture: source.architecture },
      ],
    });
    if (!seeded.ok) throw new Error(JSON.stringify(seeded));
    const before = seeded.state.design,
      ownership = structuredClone(source.ownership);
    if (!ownership.owners[0]) throw new Error();
    ownership.owners[0].name = "Reviewed owner name";
    const generation = generationSelectionsFixture(),
      saved = await service.edit(project.id, {
        baseRevision: before.revision,
        source: "api",
        ops: buildGenerationCommand(before, { generation, ownership, upgrade: true }).ops,
      });
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect((await service.getDesign(project.id))?.design).toEqual(saved.state.design);
    expect(turnContext(saved.state.design, saved.state.findings, [])).toContain(
      `"declaredGeneration":${JSON.stringify(generation)}`,
    );
    const lossy = await app.inject({ url: `/projects/${project.id}/blueprint` });
    expect(lossy.statusCode).toBe(422);
    expect(lossy.json().unsupported.map((entry: { path: unknown }) => entry.path)).toContainEqual([
      "generation",
      "selections",
      0,
    ]);
    expect(
      (await app.inject({ url: `/projects/${project.id}/blueprint?version=3` })).json(),
    ).toEqual(designBlueprintV3(saved.state.design));
    const deleted = await service.edit(project.id, {
      baseRevision: saved.state.design.revision,
      source: "api",
      ops: [{ op: "removeElement", id: "search" }],
    });
    if (!deleted.ok) throw new Error(JSON.stringify(deleted));
    expect(designGeneration(deleted.state.design)?.selections).toHaveLength(8);
    const undoDelete = await service.undo(project.id, deleted.state.design.revision, "api");
    if (!undoDelete.ok) throw new Error();
    expect(undoDelete.state.design).toEqual({
      ...saved.state.design,
      revision: undoDelete.state.design.revision,
    });
    const undoAttach = await service.undo(project.id, undoDelete.state.design.revision, "api");
    if (!undoAttach.ok) throw new Error();
    expect(undoAttach.state.design).toEqual({
      ...before,
      revision: undoAttach.state.design.revision,
    });
    const redo = await service.redo(project.id, undoAttach.state.design.revision, "api");
    if (!redo.ok) throw new Error();
    expect(designGeneration(redo.state.design)).toEqual(generation);
    expect(redo.state.design).toMatchObject({ ownership });
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);

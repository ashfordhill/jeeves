import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildOwnershipCommand,
  buildStudioCommand,
  designBlueprintV3,
  designOwnership,
  emptyOwnership,
  ownershipSchema,
  studioArchitectureExample,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import fixture from "../../../../packages/spec/src/fixtures/nc02-ownership-v1.json" with {
  type: "json",
};
import { Workspace } from "../chat/tools.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("saves mouse/chat equal declarations once, persists reload and refuses stale/atomic edits with exact cross-version Undo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-nc02-db-"));
  let database = await openTestDb(dir),
    app = buildTestApp(database.db);
  try {
    let service = new DesignService(database.db);
    const project = await service.createProject("NC02 copy"),
      old = studioArchitectureExample("studio-tinyurl").design;
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
      ownership = ownershipSchema.parse(fixture),
      args = { baseRevision: before.revision, action: "preview", ownership, upgrade: true };
    const chat = new Workspace(before);
    expect(JSON.parse(chat.run("configureOwnership", JSON.stringify(args))).canApply).toBe(true);
    expect(chat.pending).toEqual([]);
    expect(
      JSON.parse(chat.run("configureOwnership", JSON.stringify({ ...args, action: "apply" }))).ok,
    ).toBe(true);
    const mouseOps = buildOwnershipCommand(before, { ownership, upgrade: true }).ops;
    expect(chat.pending).toEqual(mouseOps);

    const saved = await service.edit(project.id, {
      baseRevision: before.revision,
      source: "canvas",
      ops: mouseOps,
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect(saved.state.design).toEqual(chat.working);
    const lossy = await app.inject({ url: `/projects/${project.id}/blueprint` });
    expect(lossy.statusCode).toBe(422);
    expect(lossy.json().unsupported.map((x: { path: unknown }) => x.path)).toContainEqual([
      "ownership",
      "grants",
      2,
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
    expect(
      await service.edit(project.id, {
        baseRevision: saved.state.design.revision,
        source: "api",
        ops: [
          { op: "setOwnership", ownership: emptyOwnership() },
          { op: "disconnect", id: "missing" },
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
      ops: buildStudioCommand(saved.state.design, { type: "removeLink", link: "redirect-db" }).ops,
    });
    if (!removed.ok) throw new Error(JSON.stringify(removed));
    expect(
      designOwnership(removed.state.design).dependencies.some(
        (x) => x.connection === "redirect-db",
      ),
    ).toBe(false);
    expect(designOwnership(removed.state.design).grants).toEqual(ownership.grants);
    const undoRemoval = await service.undo(project.id, removed.state.design.revision, "canvas");
    if (!undoRemoval.ok) throw new Error();
    expect(undoRemoval.state.design).toEqual({
      ...saved.state.design,
      revision: undoRemoval.state.design.revision,
    });
    const undo = await service.undo(project.id, undoRemoval.state.design.revision, "canvas");
    if (!undo.ok) throw new Error();
    expect(undo.state.design).toEqual({ ...before, revision: undo.state.design.revision });
    const redo = await service.redo(project.id, undo.state.design.revision, "canvas");
    if (!redo.ok) throw new Error();
    expect(designOwnership(redo.state.design)).toEqual(ownership);
  } finally {
    await app.close();
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000);

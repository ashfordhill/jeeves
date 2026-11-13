import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  designBlueprintV3,
  emptyDesign,
  studioArchitectureExample,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("saves the entire new v3 default as one revision, refuses exact v2 losses, reloads from disk and undoes in one step", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-nc06-"));
  let database = await openTestDb(dir),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  try {
    const project = await service.createProject("NC06 atomic foundation"),
      source = studioArchitectureExample("studio-tinyurl-foundation").design;
    const failure = await service.edit(project.id, {
      baseRevision: 0,
      source: "canvas",
      ops: [...studioStudySeedOperations(source), { op: "disconnect", id: "missing" }],
    });
    expect(failure.ok).toBe(false);
    expect((await service.getDesign(project.id))?.design).toEqual(emptyDesign());
    const result = await service.edit(project.id, {
      baseRevision: 0,
      source: "canvas",
      ops: studioStudySeedOperations(source),
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.state.design).toEqual({ ...source, revision: 1 });
    const refusal = await app.inject({ url: `/projects/${project.id}/blueprint` });
    expect(refusal.statusCode).toBe(422);
    const unsupported = refusal.json().unsupported;
    expect(unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["scope", "profile"] }),
        expect.objectContaining({ path: ["ownership", "owners", 0] }),
        expect.objectContaining({ path: ["operations", "receivers", 0] }),
        expect.objectContaining({ path: ["operations", "calls", 1] }),
      ]),
    );
    const blueprint = (
      await app.inject({ url: `/projects/${project.id}/blueprint?version=3` })
    ).json();
    expect(blueprint).toEqual(designBlueprintV3(result.state.design, project.name));
    await app.close();
    await database.close();
    database = await openTestDb(dir);
    app = buildTestApp(database.db);
    service = new DesignService(database.db);
    expect((await service.getDesign(project.id))?.design).toEqual(result.state.design);
    expect(
      (await app.inject({ url: `/projects/${project.id}/blueprint?version=3` })).json(),
    ).toEqual(blueprint);
    const undo = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/undo`,
      payload: { baseRevision: 1 },
    });
    expect(undo.statusCode).toBe(200);
    expect(undo.json().design).toEqual({ ...emptyDesign(), revision: 2 });
    expect(undo.json().history.canUndo).toBe(false);
    const redo = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/redo`,
      payload: { baseRevision: 2 },
    });
    expect(redo.json().design).toEqual({ ...source, revision: 3 });
  } finally {
    await app.close();
    await database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);

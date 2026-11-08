import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDesignScopeCommand,
  designBlueprint,
  designScope,
  emptyDesignScope,
  studioArchitectureExample,
  tinyurlDesignScope,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

describe("persistent requirements API and history", () => {
  it("keeps legacy reads pure, refuses lossy exports, persists reload/edit and undoes across versions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jeeves-nc01-db-"));
    let database = await openTestDb(dir);
    let app = buildTestApp(database.db);
    try {
      let service = new DesignService(database.db);
      const project = await service.createProject("NC01 legacy copy");
      const old = studioArchitectureExample("studio-tinyurl").design;
      const seeded = await service.edit(project.id, {
        baseRevision: 0,
        source: "api",
        ops: [
          ...old.elements.map((element) => ({ op: "addElement", element })),
          ...old.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: old.architecture },
        ],
      });
      if (!seeded.ok) throw new Error(JSON.stringify(seeded));
      const before = seeded.state.design;
      const url = `/projects/${project.id}/blueprint`;
      expect((await app.inject({ url })).json()).toEqual(designBlueprint(before));
      expect((await app.inject({ url: `${url}?version=3` })).json()).toMatchObject({
        blueprint: 3,
        sourceSchemaVersion: 2,
        profileStatus: "unspecified",
      });
      expect((await service.getDesign(project.id))?.design).toEqual(before);
      expect((await app.inject({ url: `${url}?version=4` })).statusCode).toBe(400);
      const scope = tinyurlDesignScope();
      scope.customRequirements.push({
        id: "abuse-rule",
        requirement: "Define abuse review policy",
        criticality: "required",
        element: "shorten",
      });
      const upgraded = await service.edit(project.id, {
        baseRevision: before.revision,
        source: "canvas",
        ops: buildDesignScopeCommand(before, { scope, upgrade: true }).ops,
      });
      if (!upgraded.ok) throw new Error(JSON.stringify(upgraded));
      const refusal = await app.inject({ url });
      expect(refusal.statusCode).toBe(422);
      expect(refusal.json()).toMatchObject({
        code: "UNSUPPORTED_BLUEPRINT_CONTENT",
        requestedVersion: 2,
        supportedVersion: 3,
        unsupported: expect.arrayContaining([
          expect.objectContaining({ path: ["scope", "customRequirements", 0] }),
        ]),
      });
      const v3 = (await app.inject({ url: `${url}?version=3` })).json();
      expect(v3).toMatchObject({
        scope: { ...scope, requirements: expect.arrayContaining(scope.requirements) },
        profileStatus: "known",
        templateAvailability: "none",
        runtimeVerification: "none",
      });
      const stale = await service.edit(project.id, {
        baseRevision: before.revision,
        source: "api",
        ops: [{ op: "setDesignScope", scope: emptyDesignScope() }],
      });
      expect(stale).toMatchObject({ ok: false, reason: "conflict" });
      const invalid = await service.edit(project.id, {
        baseRevision: upgraded.state.design.revision,
        source: "api",
        ops: [
          { op: "setDesignScope", scope: emptyDesignScope() },
          { op: "disconnect", id: "missing" },
        ],
      });
      expect(invalid).toMatchObject({ ok: false, reason: "invalid" });
      expect((await service.getDesign(project.id))?.design).toEqual(upgraded.state.design);
      await app.close();
      await database.close();
      database = await openTestDb(dir);
      app = buildTestApp(database.db);
      service = new DesignService(database.db);
      const reloaded = await service.getDesign(project.id);
      expect(reloaded?.design).toEqual(upgraded.state.design);
      const editedScope = structuredClone(scope);
      editedScope.profile = { id: "future-profile", version: "2.0.0" };
      const edited = await service.edit(project.id, {
        baseRevision: reloaded?.design.revision ?? -1,
        source: "canvas",
        ops: buildDesignScopeCommand(reloaded?.design ?? before, { scope: editedScope }).ops,
      });
      if (!edited.ok) throw new Error(JSON.stringify(edited));
      expect((await app.inject({ url: `${url}?version=3` })).json()).toMatchObject({
        scope: { ...editedScope, requirements: expect.arrayContaining(editedScope.requirements) },
        profileStatus: "unresolved",
      });
      const undoEdit = await service.undo(project.id, edited.state.design.revision, "canvas");
      if (!undoEdit.ok) throw new Error(JSON.stringify(undoEdit));
      expect(designScope(undoEdit.state.design)).toEqual(scope);
      const undoUpgrade = await service.undo(project.id, undoEdit.state.design.revision, "canvas");
      if (!undoUpgrade.ok) throw new Error(JSON.stringify(undoUpgrade));
      expect(undoUpgrade.state.design).toEqual({
        ...before,
        revision: undoUpgrade.state.design.revision,
      });
      expect((await app.inject({ url })).json()).toEqual(designBlueprint(undoUpgrade.state.design));
      const redo = await service.redo(project.id, undoUpgrade.state.design.revision, "canvas");
      if (!redo.ok) throw new Error(JSON.stringify(redo));
      expect(designScope(redo.state.design)).toEqual(scope);
    } finally {
      await app.close();
      await database.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000); // Two real PGlite starts, migrations and disk reload can exceed 5s under browser load.
});

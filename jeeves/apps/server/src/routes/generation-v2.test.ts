import { assembleV2, canonicalJson, sha256 } from "@jeeves/generator";
import {
  buildGenerationPresetCommand,
  buildSupportedAuthoringCommand,
  type DesignDocument,
} from "@jeeves/spec";
import { expect, it, vi } from "vitest";
import { DesignService } from "../design/service.ts";
import { scaffoldArchive } from "../generation/archive.ts";
import { executingGenerationRegistry } from "../generation/support.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("exports actual saved v2 consumers deterministically, preserves partial hooks and refuses stale/unknown/unsupported source", async () => {
  const database = await openTestDb(),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  const registry = executingGenerationRegistry();
  const source = (design: DesignDocument) => ({
    profileId: "selected-source-v2",
    baseRevision: design.revision,
    sourceSha256: sha256(canonicalJson(design)),
  });
  try {
    for (const preset of ["youtube", "video"] as const) {
      const project = await service.createProject(`Selected ${preset}`);
      const initial = await service.getDesign(project.id);
      if (!initial) throw new Error();
      const saved = await service.edit(project.id, {
        baseRevision: 0,
        source: "api",
        ops: buildGenerationPresetCommand(initial.design, { preset }).ops,
      });
      if (!saved.ok) throw new Error(JSON.stringify(saved));
      const before = await service.getDesign(project.id),
        url = `/projects/${project.id}/experimental-generation`;
      const request = (
        action: "preview" | "download",
        design: DesignDocument,
        archiveSha256?: string,
      ) =>
        app.inject({
          method: "POST",
          url: `${url}/${action}`,
          payload: { ...source(design), ...(archiveSha256 && { archiveSha256 }) },
        });
      const preview = await request("preview", saved.state.design);
      expect(preview.statusCode).toBe(200);
      const data = preview.json();
      expect(data).toMatchObject({
        mode: "selected-source-v2",
        selectedSource: {
          projectId: project.id,
          canonicalSha256: source(saved.state.design).sourceSha256,
        },
        report: {
          semanticComplete: preset === "video",
          applicationComplete: false,
          runtimeVerification: "none",
          strictReadiness: "not-assessed",
        },
      });
      const expected = assembleV2({ designJson: canonicalJson(saved.state.design) }, registry),
        archive = scaffoldArchive(expected.files);
      const first = await request("download", saved.state.design, data.archive.sha256),
        second = await request("download", saved.state.design, data.archive.sha256);
      expect(first.statusCode).toBe(200);
      expect(first.rawPayload.equals(archive)).toBe(true);
      expect(first.rawPayload.equals(second.rawPayload)).toBe(true);
      expect(sha256(first.rawPayload)).toBe(data.archive.sha256);
      expect(first.headers["x-source-sha256"]).toBe(source(saved.state.design).sourceSha256);
      expect((await request("download", saved.state.design, "0".repeat(64))).json().code).toBe(
        "ARCHIVE_CONFLICT",
      );
      expect(await service.getDesign(project.id)).toEqual(before);
      if (preset === "video") {
        expect(data.report.gaps.some((gap: { required: boolean }) => gap.required)).toBe(true);
        expect(expected.files.some((file) => file.path === "src/services/youtube.ts")).toBe(false);
        continue;
      }
      const row = saved.state.design.architecture?.studio?.elements.find(
        (row) => row.element === "metadata-cache",
      );
      if (row?.settings.kind !== "cache") throw new Error();
      const changed = await service.edit(project.id, {
        baseRevision: saved.state.design.revision,
        source: "api",
        ops: buildSupportedAuthoringCommand(
          saved.state.design,
          { type: "edit", element: row.element, settings: { ...row.settings, ttlSeconds: 420 } },
          registry.installed,
        ).ops,
      });
      if (!changed.ok) throw new Error(JSON.stringify(changed));
      expect((await request("download", saved.state.design, data.archive.sha256)).json().code).toBe(
        "SOURCE_CONFLICT",
      );
      expect(
        (await request("download", changed.state.design, data.archive.sha256)).json().code,
      ).toBe("ARCHIVE_CONFLICT");
      const updated = (await request("preview", changed.state.design)).json();
      expect(updated.archive.sha256).not.toBe(data.archive.sha256);
      const updatedBundle = assembleV2(
        { designJson: canonicalJson(changed.state.design) },
        registry,
      );
      const output = (path: string) =>
        new TextDecoder().decode(updatedBundle.files.find((file) => file.path === path)?.bytes);
      expect(output("src/features/application-bindings.ts")).toContain('"cache.ttlSeconds":420');
      expect(output("src/features/service-resources.ts")).toContain(
        'ttlSeconds: input(s, "cache.ttlSeconds")',
      );
      const spy = vi.spyOn(DesignService.prototype, "getDesign");
      spy.mockResolvedValueOnce(changed.state).mockResolvedValueOnce(undefined);
      try {
        expect(
          (await request("download", changed.state.design, updated.archive.sha256)).json().code,
        ).toBe("SOURCE_CONFLICT");
      } finally {
        spy.mockRestore();
      }
      const unknown = structuredClone(changed.state.design);
      if (unknown.schemaVersion !== 3 || !unknown.generation?.selections[0]) throw new Error();
      unknown.generation.selections[0].template.id = "unknown";
      // Historic/unknown source stays diagnosable but can never select an old archive.
      const unknownSpy = vi
        .spyOn(DesignService.prototype, "getDesign")
        .mockResolvedValue({ ...changed.state, design: unknown });
      try {
        const response = await request("download", unknown, updated.archive.sha256);
        expect(response.statusCode).toBe(422);
        expect(response.json().code).toBe("UNSUPPORTED_SOURCE");
      } finally {
        unknownSpy.mockRestore();
      }
      const unsupported = structuredClone(changed.state.design);
      const host = unsupported.architecture?.studio?.elements.find(
        (row) => row.element === "upload",
      );
      if (host?.settings.kind !== "uploads") throw new Error();
      host.settings.language = "go";
      const unsupportedSpy = vi
        .spyOn(DesignService.prototype, "getDesign")
        .mockResolvedValue({ ...changed.state, design: unsupported });
      try {
        expect((await request("download", unsupported, updated.archive.sha256)).statusCode).toBe(
          422,
        );
      } finally {
        unsupportedSpy.mockRestore();
      }
    }
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);

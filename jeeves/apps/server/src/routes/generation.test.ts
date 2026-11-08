import {
  assembleExperimental,
  canonicalJson,
  loadYoutubeLocalInput,
  localV1Templates,
  sha256,
  youtubeLocalProfile,
} from "@jeeves/generator";
import { type DesignDocument, studioStudySeedOperations } from "@jeeves/spec";
import { expect, it, vi } from "vitest";
import { DesignService } from "../design/service.ts";
import { scaffoldArchive } from "../generation/archive.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("previews/downloads the real frozen scaffold from an exact source copy without changing projects, history, layout or strict readiness", async () => {
  const database = await openTestDb(),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  try {
    const input = loadYoutubeLocalInput(),
      frozen = JSON.parse(input.artifacts["design.json"]) as DesignDocument;
    const project = await service.createProject("Exact local source copy");
    const edits = [
      studioStudySeedOperations(frozen),
      [{ op: "updateArchitectureSystem", name: "Temporary" }],
      [
        {
          op: "updateArchitectureSystem",
          name: frozen.architecture?.system.name,
          description: frozen.architecture?.system.description,
        },
      ],
    ];
    for (const [baseRevision, ops] of edits.entries())
      expect((await service.edit(project.id, { baseRevision, source: "api", ops })).ok).toBe(true);
    const before = {
      projects: await service.listProjects(),
      state: await service.getDesign(project.id),
      layout: await service.getLayout(project.id),
      blueprint: await service.blueprint(project.id, 3),
    };
    const body = {
      profileId: youtubeLocalProfile.id,
      baseRevision: 3,
      sourceSha256: sha256(canonicalJson(before.state?.design)),
    };
    expect(body.sourceSha256).toBe(youtubeLocalProfile.sourceCanonicalSha256);
    const url = `/projects/${project.id}/experimental-generation`;
    const preview = await app.inject({ method: "POST", url: `${url}/preview`, payload: body });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["cache-control"]).toBe("no-store");
    const data = preview.json();
    expect(data).toMatchObject({
      status: "experimental-partial",
      selectedSource: { projectId: project.id, revision: 3, matchesFrozenProfile: true },
      profile: { projectId: youtubeLocalProfile.projectId },
      archive: { files: 108 },
      settings: { unsupported: 25 },
      report: { strictReadiness: { generationEligible: false } },
    });
    expect(
      data.report.settings.filter((item: { status: string }) => item.status === "unsupported"),
    ).toHaveLength(25);
    const expected = scaffoldArchive(assembleExperimental(input, localV1Templates).files);
    const download = () =>
      app.inject({
        method: "POST",
        url: `${url}/download`,
        payload: { ...body, archiveSha256: data.archive.sha256 },
      });
    const first = await download(),
      second = await download();
    expect(first.statusCode).toBe(200);
    expect(first.headers["content-type"]).toBe("application/zip");
    expect(first.headers["x-source-project"]).toBe(project.id);
    expect(first.rawPayload.equals(expected)).toBe(true);
    expect(second.rawPayload.equals(first.rawPayload)).toBe(true);
    expect(sha256(first.rawPayload)).toBe(data.archive.sha256);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/download`,
          payload: { ...body, archiveSha256: "0".repeat(64) },
        })
      ).json().code,
    ).toBe("ARCHIVE_CONFLICT");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/preview`,
          payload: { ...body, baseRevision: 2 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/preview`,
          payload: { ...body, sourceSha256: "0".repeat(64) },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/preview`,
          payload: { ...body, profileId: "other" },
        })
      ).json().code,
    ).toBe("UNSUPPORTED_PROFILE");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/preview`,
          payload: { ...body, outputDirectory: "/tmp/app" },
        })
      ).statusCode,
    ).toBe(400);
    expect({
      projects: await service.listProjects(),
      state: await service.getDesign(project.id),
      layout: await service.getLayout(project.id),
      blueprint: await service.blueprint(project.id, 3),
    }).toEqual(before);
    // A concurrent saved edit between the route's two reads refuses the old frozen source.
    const spy = vi.spyOn(DesignService.prototype, "getDesign");
    spy
      .mockResolvedValueOnce(before.state)
      .mockResolvedValueOnce(
        before.state
          ? { ...before.state, design: { ...before.state.design, revision: 4 } }
          : undefined,
      );
    try {
      expect((await download()).json().code).toBe("SOURCE_CONFLICT");
    } finally {
      spy.mockRestore();
    }
    const edit = await service.edit(project.id, {
      baseRevision: 3,
      source: "api",
      ops: [{ op: "updateArchitectureSystem", name: "Changed source" }],
    });
    if (!edit.ok) throw new Error("Expected saved edit");
    const changed = await app.inject({
      method: "POST",
      url: `${url}/preview`,
      payload: { ...body, baseRevision: 4, sourceSha256: sha256(canonicalJson(edit.state.design)) },
    });
    expect(changed.statusCode).toBe(422);
    expect(changed.json().code).toBe("UNSUPPORTED_SOURCE");
    await service.deleteProject(project.id);
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);

it("refuses unsupported saved sources and missing projects instead of exporting the frozen application", async () => {
  const database = await openTestDb(),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  try {
    const project = await service.createProject("Unsupported normal design");
    const state = await service.getDesign(project.id);
    const payload = {
      profileId: youtubeLocalProfile.id,
      baseRevision: 0,
      sourceSha256: sha256(canonicalJson(state?.design)),
    };
    const url = `/projects/${project.id}/experimental-generation/preview`;
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("UNSUPPORTED_SOURCE");
    expect(response.json().message).toContain("no older baseline was exported");
    await service.deleteProject(project.id);
    expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(404);
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);

it("bounds ZIP output and refuses unsafe paths, collisions and file/directory aliases", () => {
  const file = (path: string, bytes = new Uint8Array()) => ({ path, bytes });
  for (const files of [
    [],
    Array.from({ length: 257 }, (_, i) => file(`${i}`)),
    [file("../x")],
    [file(".git/config")],
    [file("A"), file("a")],
    [file("a"), file("a/b")],
    [file("huge", new Uint8Array(8 * 1024 * 1024 + 1))],
    [file("a", new Uint8Array(8 * 1024 * 1024)), file("b", new Uint8Array(8 * 1024 * 1024))],
  ])
    expect(() => scaffoldArchive(files)).toThrow();
});

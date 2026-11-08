import { createFakeProvider } from "@jeeves/providers";
import { designReadiness } from "@jeeves/spec";
import { expect, it } from "vitest";
import { narrowReadinessSeedOps } from "../../../../packages/spec/src/fixtures/nc05-narrow.ts";
import { ChatService } from "../chat/service.ts";
import { turnContext, Workspace } from "../chat/tools.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";

it("returns the identical read-only saved-snapshot report in actual chat and blueprint v3, with strict tool inputs", async () => {
  const database = await openTestDb(),
    app = buildTestApp(database.db),
    service = new DesignService(database.db);
  try {
    const project = await service.createProject("NC05 report parity");
    const seeded = await service.edit(project.id, {
      baseRevision: 0,
      source: "api",
      ops: narrowReadinessSeedOps(),
    });
    if (!seeded.ok) throw new Error(JSON.stringify(seeded));
    const before = await service.getDesign(project.id),
      design = seeded.state.design,
      report = designReadiness(design);
    const workspace = new Workspace(design),
      generation = workspace.generation,
      reviewed = workspace.reviewedGeneration;
    const summary = JSON.parse(workspace.run("getDesign", "{}")).readiness;
    expect(summary).toMatchObject({
      compositionSha256: report.composition.sha256,
      generationEligible: false,
      designValidity: { status: "valid", blockers: 0 },
      contractCompleteness: { status: "complete", blockers: 0 },
      implementationAvailability: { status: "unavailable", blockers: 2 },
      runtimeEvidence: { status: "none", blockers: 1 },
      detailTool: "readReadiness",
    });
    expect(summary.composition).toBeUndefined();
    expect(turnContext(design, [], [])).toContain(JSON.stringify(summary));
    expect(JSON.parse(workspace.run("readReadiness", "{}"))).toEqual(report);
    expect(JSON.parse(workspace.run("readReadiness", '{"manifest":{}}')).ok).toBe(false);
    expect(workspace.generation).toBe(generation);
    expect(workspace.reviewedGeneration).toBe(reviewed);
    expect(workspace.pending).toEqual([]);
    const blueprint = await app.inject({ url: `/projects/${project.id}/blueprint?version=3` });
    expect(blueprint.statusCode).toBe(200);
    expect(blueprint.json().readiness).toEqual(report);
    const provider = createFakeProvider((request, round) => {
      if (round === 0) return { toolCalls: [{ name: "readReadiness", arguments: {} }] };
      const result = request.items.find((item) => item.type === "tool-result");
      if (result?.type !== "tool-result") throw new Error("Expected real report tool output");
      expect(JSON.parse(result.output)).toEqual(report);
      return {
        text: "Complete declarations; implementation unavailable and runtime evidence none.",
      };
    });
    const chat = new ChatService(database.db, service, () => ({ provider, model: "fixture" }));
    const started = await chat.start(project.id, {
      message: "Read compatibility",
      fileIds: [],
      selection: ["operation:create-link"],
      baseRevision: design.revision,
    });
    if (!started.ok) throw new Error(started.message);
    const turn = await started.run(() => {});
    expect(turn.status).toBe("done");
    expect(turn.activity).toContainEqual(
      expect.objectContaining({ tool: "readReadiness", ok: true }),
    );
    expect(turn.changed).toEqual([]);
    expect(await service.getDesign(project.id)).toEqual(before);
    expect((await app.inject({ url: `/projects/${project.id}/blueprint` })).statusCode).toBe(422);
    await service.deleteProject(project.id);
  } finally {
    await app.close();
    await database.close();
  }
}, 15000);

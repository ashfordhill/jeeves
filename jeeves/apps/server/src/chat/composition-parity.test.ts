import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleV2, canonicalJson, loadLocalV2Registry, sha256 } from "@jeeves/generator";
import {
  applyOperations,
  buildStudioCommand,
  buildSupportedAuthoringCommand,
  designBlueprintV3,
  designGeneration,
  designSchema,
  generationExportBlockers,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { compositionCases } from "../../../../../field-projects/generator-system/fixtures/rg-composition/design.ts";
import { foundationsDesign } from "../../../../../field-projects/generator-system/fixtures/rg-foundations/design.ts";
import { workloadDesign } from "../../../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { DesignService } from "../design/service.ts";
import { buildTestApp, openTestDb } from "../test-support.ts";
import { Workspace } from "./tools.ts";

const registry = loadLocalV2Registry();
const generator = fileURLToPath(new URL("../../../../../jeeves-generator/", import.meta.url));
const rawApply = (
  design: ReturnType<typeof foundationsDesign>,
  command: Parameters<typeof buildStudioCommand>[1],
) => {
  const result = applyOperations(design, buildStudioCommand(design, command).ops);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.design;
};

for (const row of compositionCases)
  it(`RG22 ${row.id}: mouse/chat/preview/download/CLI agree`, async () => {
    const before = row.design(),
      snapshot = structuredClone(before),
      command = row.command(before);
    const workspace = new Workspace(before);
    const chat = JSON.parse(
      workspace.run("applyStudioCommands", JSON.stringify({ commands: [command] })),
    );
    expect(chat.ok).toBe(row.accepted);
    if (row.accepted) {
      const batch = buildSupportedAuthoringCommand(before, command, registry.installed);
      const applied = applyOperations(before, batch.ops);
      if (!applied.ok) throw Error(JSON.stringify(applied.errors));
      expect(workspace.working).toEqual(applied.design);
    } else {
      expect(() => buildSupportedAuthoringCommand(before, command, registry.installed)).toThrow();
      expect(workspace.working).toEqual(snapshot);
      expect(workspace.pending).toEqual([]);
    }
    expect(before).toEqual(snapshot);
    // Raw/imported source stays parseable; unsafe composition is refused at export boundaries.
    const saved = rawApply(before, command);
    expect(designSchema.safeParse(saved).success).toBe(true);
    const blockers = generationExportBlockers(saved, registry.installed);
    expect(blockers.length === 0).toBe(row.accepted);
    if (row.reason)
      expect(blockers.map((finding) => finding.message).join("\n")).toContain(row.reason);
    const database = await openTestDb(),
      app = buildTestApp(database.db),
      service = new DesignService(database.db);
    const root = await mkdtemp(join(tmpdir(), "jeeves-rg22-parity-"));
    try {
      const project = await service.createProject(`RG22 ${row.id}`);
      if (saved.schemaVersion !== 3 || !saved.generation) throw Error("No generation");
      const imported = await service.edit(project.id, {
        baseRevision: 0,
        source: "api",
        ops: [
          ...studioStudySeedOperations(saved),
          { op: "setGeneration", generation: saved.generation },
        ],
      });
      if (!imported.ok) throw Error(JSON.stringify(imported));
      const actual = imported.state.design;
      let archiveSha256 = "0".repeat(64);
      for (const action of ["preview", "download"]) {
        const response = await app.inject({
          method: "POST",
          url: `/projects/${project.id}/experimental-generation/${action}`,
          payload: {
            profileId: "selected-source-v2",
            baseRevision: actual.revision,
            sourceSha256: sha256(canonicalJson(actual)),
            ...(action === "download" && { archiveSha256 }),
          },
        });
        expect(response.statusCode).toBe(row.accepted ? 200 : 422);
        if (!row.accepted)
          expect(response.json().findings).toEqual(
            generationExportBlockers(actual, registry.installed),
          );
        if (row.accepted && action === "preview") {
          archiveSha256 = response.json().archive.sha256;
          expect(response.json().report.applicationComplete).toBe(false);
          expect(
            response.json().report.gaps.some((gap: { required: boolean }) => gap.required),
          ).toBe(true);
        }
      }
      const input = join(root, "design.json"),
        destination = join(root, "app");
      await writeFile(input, JSON.stringify(saved));
      let output = "",
        error = "";
      try {
        output = execFileSync(
          process.execPath,
          ["--import", "tsx", "src/v2/cli.ts", input, destination],
          { cwd: generator, encoding: "utf8", stdio: "pipe" },
        );
      } catch (failure) {
        error = String((failure as { stderr: string }).stderr);
      }
      expect(existsSync(destination)).toBe(row.accepted);
      if (row.accepted) expect(output).toContain("applicationComplete: false");
      else {
        expect(error).toContain("UNSUPPORTED_SOURCE");
        expect(error).toContain(row.reason);
      }
      expect((await service.getDesign(project.id))?.design).toEqual(actual);
    } finally {
      await app.close();
      await database.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);

it("RG22 refused chat batch has no earlier side effect and hidden fields stay unavailable", () => {
  const design = foundationsDesign(),
    workspace = new Workspace(design);
  const command = compositionCases
    .find((row) => row.id === "internal-http-reader")
    ?.command(design);
  const run = (commands: unknown[]) =>
    JSON.parse(workspace.run("applyStudioCommands", JSON.stringify({ commands })));
  expect(run([{ type: "editTile", tile: "items-api", name: "Must not persist" }, command]).ok).toBe(
    false,
  );
  expect(workspace.working).toEqual(design);
  expect(workspace.pending).toEqual([]);
  for (const [setting, value] of [
    ["retry", true],
    ["retentionSeconds", 1],
    ["secret", true],
    ["advanced", true],
  ]) {
    expect(run([{ type: "setSetting", module: "record-reader", setting, value }]).ok).toBe(false);
    expect(workspace.working).toEqual(design);
  }
});

it("RG22 saved incompatible source supports label edits, array shifts and explicit repair", () => {
  const base = foundationsDesign();
  const invalidCase = compositionCases.find((row) => row.id === "internal-http-reader"),
    validCase = compositionCases[0];
  if (!invalidCase || !validCase) throw Error("Missing independent case");
  const invalid = rawApply(base, invalidCase.command(base));
  const apply = (design: typeof invalid, command: Parameters<typeof buildStudioCommand>[1]) => {
    const batch = buildSupportedAuthoringCommand(design, command, registry.installed),
      result = applyOperations(design, batch.ops);
    if (!result.ok) throw Error(JSON.stringify(result.errors));
    return result.design;
  };
  const renamed = apply(invalid, {
    type: "editComponent",
    component: "record-reader",
    name: "A different reader label",
  });
  expect(generationExportBlockers(renamed, registry.installed)).toHaveLength(1);
  expect(designGeneration(renamed)).toEqual(designGeneration(invalid));
  const shifted = apply(renamed, { type: "removeModule", module: "create" });
  expect(generationExportBlockers(shifted, registry.installed)).toHaveLength(1);
  const repaired = apply(shifted, validCase.command(shifted));
  expect(generationExportBlockers(repaired, registry.installed)).toEqual([]);
  const output = assembleV2({ designJson: JSON.stringify(repaired) }, registry);
  expect(output.manifest.extensionApi.version).toBe(8);
  expect(output.report.extensionApi.version).toBe(8);
  expect(designBlueprintV3(repaired).generation).toEqual(designGeneration(repaired));
  expect(output.report.applicationComplete).toBe(false);
});

it("RG22 detects an additional caller requirement at an already-refused link", () => {
  const base = workloadDesign();
  const link = base.architecture?.studio?.componentConnections?.find(
    (entry) => entry.from === "send" && entry.slot === "workload",
  );
  if (!link) throw Error("Missing workload link");
  const missing = rawApply(base, { type: "disconnectModule", link: link.id });
  const incomplete = rawApply(missing, {
    type: "addModule",
    host: "callee",
    kind: "auth-guard",
    id: "required-user",
  });
  expect(generationExportBlockers(incomplete, registry.installed)).toHaveLength(1);
  const before = structuredClone(incomplete);
  expect(() =>
    buildSupportedAuthoringCommand(
      incomplete,
      {
        type: "connectModule",
        module: "required-user",
        slot: "identity",
        target: { tile: "issuer" },
      },
      registry.installed,
    ),
  ).toThrow("requires an end-user credential");
  expect(incomplete).toEqual(before);
});

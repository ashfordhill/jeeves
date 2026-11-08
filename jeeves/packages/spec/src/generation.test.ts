import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { designSchema } from "./design.ts";
import { designReadiness } from "./design-readiness.ts";
import { isStructural } from "./findings.ts";
import legacy from "./fixtures/nc01-schema2.json" with { type: "json" };
import { generationSelectionsFixture, generationSourceFixture } from "./fixtures/yv2-selections.ts";
import { designGeneration, generationFindings, generationSchema } from "./generation.ts";
import { generationTemplates, knownGenerationTemplate } from "./generation-catalog.ts";
import { buildGenerationCommand, previewGeneration } from "./generation-command.ts";
import { readinessSubject } from "./readiness-subject.ts";
import {
  designBlueprint,
  designBlueprintV3,
  designBlueprintV3Schema,
  unsupportedBlueprintV2,
} from "./studio-blueprint.ts";
import { buildStudioCommand } from "./studio-operations.ts";

const attached = () => {
  const source = generationSourceFixture(),
    generation = generationSelectionsFixture();
  const result = applyOperations(source, buildGenerationCommand(source, { generation }).ops);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};

describe("experimental generation source boundary", () => {
  it("preserves absent declarations and v1 meaning, and round-trips strict v3 bindings without defaults", () => {
    const old = designSchema.parse(legacy.design),
      source = generationSourceFixture();
    expect(old).toEqual(legacy.design);
    expect(designBlueprint(old)).toEqual(legacy.blueprint);
    expect(source).not.toHaveProperty("generation");
    expect(readinessSubject(source)).not.toHaveProperty("generation");
    expect(designBlueprintV3(source)).not.toHaveProperty("generation");
    expect(
      designSchema.safeParse({ ...old, generation: generationSelectionsFixture() }).success,
    ).toBe(false);
    expect(() =>
      buildGenerationCommand(old, { generation: generationSelectionsFixture() }),
    ).toThrow("explicitly upgrade");
    const design = attached(),
      bp = designBlueprintV3(design);
    expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
    expect(designBlueprintV3Schema.parse(bp)).toEqual(bp);
    expect(bp.generation).toEqual(designGeneration(design));
    if (!bp.generation) throw new Error();
    bp.generation.selections.splice(0);
    expect(designGeneration(design)?.selections).toHaveLength(10);
    expect(
      generationSchema.safeParse({ ...generationSelectionsFixture(), config: {} }).success,
    ).toBe(false);
    const malformed = generationSelectionsFixture();
    Object.assign(malformed.selections[0]?.binding ?? {}, { callback: "run()" });
    expect(generationSchema.safeParse(malformed).success).toBe(false);
  });

  it("uses actual publish/consume directions, guard identity and cross-role lifecycle authority; catalog presence cannot execute", () => {
    const source = generationSourceFixture(),
      design = attached();
    expect(generationFindings(design).filter(isStructural)).toEqual([]);
    expect(previewGeneration(source, { generation: generationSelectionsFixture() }).canApply).toBe(
      true,
    );
    expect(
      generationFindings(design).filter((entry) => entry.code === "NEEDS_TEMPLATE"),
    ).toHaveLength(10);
    const report = designReadiness(design);
    expect(report.generationEligible).toBe(false);
    expect(report.composition.sha256).not.toBe(designReadiness(source).composition.sha256);
    expect(report.contractCompleteness.blockers).toContainEqual(
      expect.objectContaining({ target: { path: ["generation"] } }),
    );
    const unknown = generationSelectionsFixture();
    if (!unknown.selections[0]) throw new Error();
    unknown.selections[0].template.sha256 = "f".repeat(64);
    expect(knownGenerationTemplate(unknown.selections[0].template)).toBeUndefined();
    const saved = applyOperations(source, [{ op: "setGeneration", generation: unknown }]);
    if (!saved.ok) throw new Error();
    expect(designGeneration(saved.design)).toEqual(unknown);
    expect(generationFindings(saved.design)).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        target: { element: "upload", path: ["generation", "selections", 0, "template"] },
        message: expect.stringContaining("Unresolved exact"),
      }),
    );
    expect(unsupportedBlueprintV2(design).map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        ["generation", "version"],
        ["generation", "runtime"],
        ["generation", "preset"],
        ["generation", "selections", 9],
      ]),
    );
    expect(() => designBlueprint(design)).toThrow("cannot represent");
  });

  it("refuses canonical mismatches even on historically invalid source, without mutating either input", () => {
    const source = attached(),
      invalid = generationSelectionsFixture();
    const row = invalid.selections[0];
    if (row?.binding.kind !== "owned-multipart") throw new Error();
    row.binding.state.connection = "handler-metadata";
    expect(applyOperations(source, [{ op: "setGeneration", generation: invalid }])).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "CONFIG_INVALID",
          target: {
            element: "upload",
            path: ["generation", "selections", 0, "binding", "state", "connection"],
          },
        }),
      ]),
    });
    const historical = designSchema.parse({ ...source, generation: invalid });
    expect(
      applyOperations(historical, [{ op: "updateElement", id: "search", name: "Renamed" }]).ok,
    ).toBe(false);
    row.template = generationTemplates["video-hls"].ref;
    expect(applyOperations(source, [{ op: "setGeneration", generation: invalid }]).ok).toBe(false);
    expect(designGeneration(source)).toEqual(generationSelectionsFixture());
    expect(generationSourceFixture()).not.toHaveProperty("generation");
  });

  it("cleans deleted targets and component targets, but refuses surviving bound dependencies", () => {
    const source = attached();
    const deleted = applyOperations(source, [{ op: "removeElement", id: "search" }]);
    if (!deleted.ok) throw new Error(JSON.stringify(deleted.errors));
    expect(designGeneration(deleted.design)?.selections.map((entry) => entry.id)).not.toContain(
      "query",
    );
    expect(designGeneration(deleted.design)?.selections.map((entry) => entry.id)).not.toContain(
      "search-api",
    );
    expect(applyOperations(source, [{ op: "disconnect", id: "upload-state" }]).ok).toBe(false);
    expect(applyOperations(source, [{ op: "removeElement", id: "upload" }]).ok).toBe(false); // surviving lifecycle requires upload
    const componentSource = generationSourceFixture(),
      generation = generationSelectionsFixture();
    generation.selections = generation.selections.filter((entry) => entry.id === "query");
    const query = generation.selections[0];
    if (!query) throw new Error();
    query.target = { kind: "component", component: "search-query", host: "search" };
    const selected = applyOperations(componentSource, [{ op: "setGeneration", generation }]);
    if (!selected.ok) throw new Error();
    const removed = applyOperations(
      selected.design,
      buildStudioCommand(selected.design, { type: "removeComponent", components: ["search-query"] })
        .ops,
    );
    if (!removed.ok) throw new Error(JSON.stringify(removed.errors));
    expect(designGeneration(removed.design)?.selections).toEqual([]);
    expect(designGeneration(source)?.selections).toHaveLength(10);
  });
});

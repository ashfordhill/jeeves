import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { designSchema } from "./design.ts";
import {
  buildDesignScopeCommand,
  designScope,
  emptyDesignScope,
  previewDesignScope,
  tinyurlDesignScope,
  unresolvedDesignScope,
} from "./design-scope.ts";
import fixture from "./fixtures/nc01-schema2.json" with { type: "json" };
import {
  designBlueprint,
  designBlueprintV3,
  designBlueprintV3Schema,
  UnsupportedBlueprintContentError,
} from "./studio-blueprint.ts";
import { buildStudioCommand } from "./studio-operations.ts";
import { studioChanges } from "./studio-review.ts";
import { validateDesign } from "./validate.ts";

const legacy = () => designSchema.parse(structuredClone(fixture.design));
const upgrade = (scope = tinyurlDesignScope()) => {
  const result = applyOperations(
    legacy(),
    buildDesignScopeCommand(legacy(), { scope, upgrade: true }).ops,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
describe("persistent scope and explicit version boundary", () => {
  it("reads a frozen schema-v2 fixture and exports its exact v2 meaning without migration", () => {
    const design = legacy();
    expect(design).toEqual(fixture.design);
    expect(validateDesign(design)).toEqual([]);
    expect(designBlueprint(design)).toEqual(fixture.blueprint);
    const projected = designBlueprintV3(design);
    expect(projected).toMatchObject({
      blueprint: 3,
      sourceSchemaVersion: 2,
      scope: emptyDesignScope(),
      profileStatus: "unspecified",
    });
    expect(projected.unresolvedRequirements.map((item) => item.id)).toContain(
      "contracts-unspecified",
    );
    expect(design).toEqual(fixture.design);
    expect(designSchema.safeParse({ ...design, scope: emptyDesignScope() }).success).toBe(false);
    const emptyUpgrade = upgrade(emptyDesignScope());
    expect(designBlueprint(emptyUpgrade)).toEqual({
      ...fixture.blueprint,
      revision: emptyUpgrade.revision,
    });
  });
  it("previews a single explicit upgrade, preserves all old semantics and reports unimplemented contracts", () => {
    const design = legacy();
    const scope = tinyurlDesignScope();
    scope.customRequirements.push({
      id: "create-contract",
      requirement: "Enforce tenant-specific destination rules",
      criticality: "required",
      element: "shorten",
      connection: "shorten-db",
    });
    expect(() => buildDesignScopeCommand(design, { scope })).toThrow("explicitly upgrade");
    const preview = previewDesignScope(design, scope);
    expect(preview).toMatchObject({ fromSchema: 2, toSchema: 3, scope, profileStatus: "known" });
    expect(
      preview.unresolved
        .filter((item) => item.id === "create-contract")
        .map((item) => item.source)
        .sort(),
    ).toEqual(["contract", "custom"]);
    expect(design).toEqual(fixture.design);
    const upgraded = upgrade(scope);
    expect(upgraded).toEqual({ ...design, schemaVersion: 3, revision: design.revision + 1, scope });
    expect(studioChanges(design, upgraded)).toEqual([
      {
        type: "scope",
        id: "persistent-scope",
        name: "Profile and persistent requirements",
        change: "added",
      },
    ]);
    const paths = validateDesign(upgraded)
      .filter((item) => item.target.path?.at(-1) === "create-contract")
      .map((item) => item.target.path);
    expect(paths).toContainEqual(["scope", "contract", "create-contract"]);
    expect(paths).toContainEqual(["scope", "customRequirements", "create-contract"]);
  });
  it("retains required excluded features and unknown exact profiles as saveable unresolved intent", () => {
    const scope = tinyurlDesignScope();
    const customSlugs = scope.requirements.find((item) => item.feature === "custom-slugs");
    if (customSlugs) customSlugs.disposition = "included";
    const design = upgrade(scope);
    expect(designScope(design)).toEqual(scope);
    expect(unresolvedDesignScope(design)).toContainEqual(
      expect.objectContaining({
        id: "unsupported-custom-slugs",
        criticality: "required",
        requirement: expect.stringContaining("blocks the narrow profile"),
      }),
    );
    scope.profile = { id: "future-profile", version: "9.2.0" };
    const unknown = upgrade(scope);
    expect(designBlueprintV3(unknown)).toMatchObject({
      scope: { ...scope, requirements: expect.arrayContaining(scope.requirements) },
      profileStatus: "unresolved",
    });
    for (const profile of [
      { id: "Bad Ref", version: "1.0.0" },
      { id: "future-profile", version: "latest" },
      { id: "future-profile", version: "01.0.0" },
    ]) {
      expect(
        applyOperations(legacy(), [{ op: "upgradeDesign", scope: { ...scope, profile } } as never])
          .ok,
      ).toBe(false);
    }
    expect(applyOperations(legacy(), [{ op: "setDesignScope", scope }]).ok).toBe(false);
  });
  it("refuses lossy v2 export with every exact unsupported path and projects v3 deterministically", () => {
    const scope = tinyurlDesignScope();
    scope.customRequirements.push({
      id: "custom-rule",
      requirement: "Define a rule",
      criticality: "advisory",
    });
    const design = upgrade(scope);
    let refusal: UnsupportedBlueprintContentError | undefined;
    try {
      designBlueprint(design);
    } catch (error) {
      if (error instanceof UnsupportedBlueprintContentError) refusal = error;
      else throw error;
    }
    expect(refusal?.unsupported).toHaveLength(12);
    expect(refusal?.unsupported.map((item) => item.path)).toContainEqual([
      "scope",
      "customRequirements",
      0,
    ]);
    const blueprint = designBlueprintV3(design);
    expect(designBlueprintV3Schema.parse(blueprint)).toEqual(blueprint);
    expect(designBlueprintV3(design)).toEqual(blueprint);
    expect(blueprint).toMatchObject({ templateAvailability: "none", runtimeVerification: "none" });
    expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
  });
  it("keeps targeted custom requirements unresolved after target removal and refuses bad batches atomically", () => {
    const scope = tinyurlDesignScope();
    scope.customRequirements.push({
      id: "read-rule",
      requirement: "Define restricted Stats access",
      criticality: "required",
      element: "stats-api",
      connection: "stats-read",
    });
    const design = upgrade(scope);
    const removed = applyOperations(
      design,
      buildStudioCommand(design, { type: "removeTile", tile: "stats-api" }).ops,
    );
    if (!removed.ok) throw new Error(JSON.stringify(removed.errors));
    expect(designScope(removed.design)).toEqual(scope);
    expect(unresolvedDesignScope(removed.design)).toContainEqual(
      expect.objectContaining({
        source: "custom",
        id: "read-rule",
        requirement: expect.stringContaining(
          "Target missing: element stats-api, connection stats-read",
        ),
      }),
    );
    const before = structuredClone(design);
    const failed = applyOperations(design, [
      { op: "setDesignScope", scope: emptyDesignScope() },
      { op: "disconnect", id: "missing" },
    ]);
    expect(failed.ok).toBe(false);
    expect(design).toEqual(before);
    expect(applyOperations(design, [{ op: "setDesignScope", scope }], { baseRevision: 0 }).ok).toBe(
      false,
    );
  });
});

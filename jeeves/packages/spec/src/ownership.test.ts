import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { emptyDesignScope, tinyurlDesignScope, unresolvedDesignScope } from "./design-scope.ts";
import { isStructural } from "./findings.ts";
import legacyFixture from "./fixtures/nc01-schema2.json" with { type: "json" };
import fixture from "./fixtures/nc02-ownership-v1.json" with { type: "json" };
import {
  buildOwnershipCommand,
  cleanOwnershipChange,
  designOwnership,
  emptyOwnership,
  ownershipFindings,
  ownershipSchema,
  previewOwnership,
} from "./ownership.ts";
import {
  designBlueprint,
  designBlueprintV3,
  designBlueprintV3Schema,
  unsupportedBlueprintV2,
} from "./studio-blueprint.ts";
import { buildStudioCommand } from "./studio-operations.ts";
import { studioChanges } from "./studio-review.ts";
import { validateDesign } from "./validate.ts";

const required = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("Missing test fixture row");
  return value;
};
const legacy = () => designSchema.parse(structuredClone(legacyFixture.design));
const model = () => ownershipSchema.parse(structuredClone(fixture));
const upgraded = () => {
  const old = legacy(),
    result = applyOperations(
      old,
      buildOwnershipCommand(old, { ownership: model(), upgrade: true }).ops,
    );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const set = (design: DesignDocument, ownership = model()) =>
  applyOperations(design, [{ op: "setOwnership", ownership }]);

describe("explicit logical authority, role grants and dependency declarations", () => {
  it("preserves exact schema2 meaning; absent declarations never migrate or infer from labels/packages", () => {
    const old = legacy();
    expect(old).toEqual(legacyFixture.design);
    expect(validateDesign(old)).toEqual([]);
    expect(designBlueprint(old)).toEqual(legacyFixture.blueprint);
    expect(designOwnership(old)).toEqual(emptyOwnership());
    expect(() => buildOwnershipCommand(old, { ownership: model() })).toThrow("explicitly upgrade");
    expect(designSchema.safeParse({ ...old, ownership: model() }).success).toBe(false);
    const result = applyOperations(old, [{ op: "upgradeDesign", scope: emptyDesignScope() }]);
    if (!result.ok) throw new Error();
    expect(result.design).not.toHaveProperty("ownership");
    expect(ownershipFindings(result.design).some((x) => x.message.includes("unspecified"))).toBe(
      true,
    );
    expect(designBlueprint(result.design)).toEqual({
      ...legacyFixture.blueprint,
      revision: result.design.revision,
    });
  });
  it("declares create write, same-owner resolve read and cache read/fill independently from legacy inference", () => {
    const before = legacy(),
      preview = previewOwnership(before, model());
    expect(preview.canApply).toBe(true);
    expect(before).toEqual(legacyFixture.design);
    const design = upgraded();
    expect(design.architecture).toEqual(before.architecture);
    expect(design.elements).toEqual(before.elements);
    expect(design.connections).toEqual(before.connections);
    const bp = designBlueprintV3(design);
    expect(bp.ownership).toEqual(
      expect.objectContaining({
        grants: expect.arrayContaining(model().grants),
        dependencies: expect.arrayContaining(model().dependencies),
      }),
    );
    expect(bp.connections.find((x) => x.id === "redirect-cache")?.access).toBe("write"); // explicitly disclosed legacy approximation
    expect(bp.ownership.dependencies.find((x) => x.connection === "redirect-cache")?.access).toBe(
      "read-write",
    );
    expect(bp.ownership.dependencies.find((x) => x.connection === "redirect-db")?.access).toBe(
      "read",
    );
    expect(studioChanges(before, design).map((x) => x.type)).toContain("ownership");
    expect(designBlueprintV3Schema.parse(bp)).toEqual(bp);
    expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
  });
  it("refuses incompatible requests and foreign writes even when roles share a deployable", () => {
    const design = upgraded(),
      before = structuredClone(design);
    const cache = model();
    required(cache.grants.find((x) => x.resource === "url-cache")).access = "read";
    const invalid = set(design, cache);
    expect(invalid).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "CONFIG_INVALID",
          message: expect.stringContaining("requires both read and write"),
        }),
      ]),
    });
    const foreign = model();
    foreign.owners.push({ id: "other", name: "Other" });
    required(foreign.roles.find((x) => x.element === "shorten")).owner = "other";
    expect(set(design, foreign)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("Foreign-owner direct write") }),
      ]),
    });
    foreign.grants = [];
    expect(set(design, foreign).ok).toBe(false); // removing the grant cannot hide the foreign request
    expect(design).toEqual(before);
    expect(
      applyOperations(design, [
        { op: "setOwnership", ownership: model() },
        { op: "disconnect", id: "missing" },
      ]).ok,
    ).toBe(false);
    expect(design).toEqual(before);
  });
  it("requires a deliberate foreign read boundary and retains its missing published contract as unresolved", () => {
    const design = upgraded(),
      foreign = model();
    foreign.owners.push({ id: "readers", name: "Readers" });
    required(foreign.roles.find((x) => x.element === "redirect")).owner = "readers";
    required(foreign.resources.find((x) => x.element === "url-cache")).authority = "readers";
    expect(set(design, foreign).ok).toBe(false);
    required(
      foreign.grants.find((x) => x.resource === "url-db" && x.role === "redirect"),
    ).boundary = "published-read";
    const result = set(design, foreign);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(ownershipFindings(result.design)).toContainEqual(
      expect.objectContaining({
        code: "CONFIG_REQUIRED",
        message: expect.stringContaining(
          "no pinned published contract, freshness or failure behavior",
        ),
      }),
    );
    expect(designBlueprintV3(result.design).runtimeVerification).toBe("none");
    required(foreign.grants.find((x) => x.boundary)).access = "read-write";
    expect(set(design, foreign).ok).toBe(false);
  });
  it("retains missing old intent as readiness while rejecting missing explicit references, kinds, duplicates and projection cycles", () => {
    const design = upgraded(),
      missing = model();
    missing.grants = [];
    const result = set(design, missing);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(
        ownershipFindings(result.design).filter((x) =>
          x.message.includes("role grant is unspecified"),
        ),
      ).toHaveLength(3);
    const invalids = [
      { ...model(), roles: [{ element: "url-db", owner: "links", kind: "api" as const }] },
      {
        ...model(),
        resources: [{ element: "redirect", authority: "links", kind: "source" as const }],
      },
      { ...model(), dependencies: [{ connection: "redirect-clicks", access: "write" as const }] },
      { ...model(), grants: [{ role: "missing", resource: "url-db", access: "read" as const }] },
      { ...model(), owners: [] },
      { ...model(), roles: [...model().roles, ...model().roles] },
      {
        ...model(),
        resources: [
          {
            element: "url-db",
            authority: "links",
            kind: "projection" as const,
            source: "url-cache",
          },
          {
            element: "url-cache",
            authority: "links",
            kind: "projection" as const,
            source: "url-db",
          },
        ],
      },
      {
        ...model(),
        resources: [
          { element: "url-db", authority: "links", kind: "projection" as const, source: "url-db" },
        ],
      },
    ];
    for (const invalid of invalids) expect(set(design, invalid).ok).toBe(false);
  });
  it("previews exact owner/role/authority transfers and removals; canonical deletion cleans dependent rows or refuses", () => {
    const design = upgraded();
    if (design.schemaVersion !== 3) throw new Error();
    design.scope.customRequirements.push({
      id: "keep",
      requirement: "Keep this obligation",
      criticality: "required",
      element: "shorten",
      connection: "shorten-db",
    });
    const moved = model();
    moved.owners.push({ id: "other", name: "Other" });
    required(moved.roles.find((x) => x.element === "shorten")).owner = "other";
    const clean = cleanOwnershipChange(design, moved),
      preview = previewOwnership(design, clean);
    expect(
      preview.changes.filter((x) => x.change === "removed").map((x) => `${x.field}/${x.id}`),
    ).toEqual(["grants/shorten/url-db", "dependencies/shorten-db"]);
    expect(set(design, clean).ok).toBe(true);
    const removeOwner = cleanOwnershipChange(design, { ...model(), owners: [] });
    expect(removeOwner).toEqual(emptyOwnership());
    const transferResource = model();
    transferResource.owners.push({ id: "other", name: "Other" });
    required(transferResource.resources.find((x) => x.element === "url-db")).authority = "other";
    const cleanResource = cleanOwnershipChange(design, transferResource);
    expect(cleanResource.grants.map((x) => x.resource)).toEqual(["url-cache"]);
    expect(cleanResource.dependencies.map((x) => x.connection)).toEqual(["redirect-cache"]);
    const removed = applyOperations(
      design,
      buildStudioCommand(design, { type: "removeTile", tile: "shorten" }).ops,
    );
    if (!removed.ok) throw new Error(JSON.stringify(removed.errors));
    expect(designOwnership(removed.design).roles.map((x) => x.element)).not.toContain("shorten");
    expect(designOwnership(removed.design).dependencies.map((x) => x.connection)).not.toContain(
      "shorten-db",
    );
    expect(removed.design.schemaVersion === 3 && removed.design.scope).toEqual(design.scope);
    expect(
      unresolvedDesignScope(removed.design).find((x) => x.id === "keep")?.requirement,
    ).toContain("Target missing");
    expect(
      applyOperations(
        design,
        buildStudioCommand(design, { type: "removeTile", tile: "url-db" }).ops,
      ).ok,
    ).toBe(false); // surviving projection cannot lose its source
    const removedCache = applyOperations(
      design,
      buildStudioCommand(design, { type: "removeTile", tile: "url-cache" }).ops,
    );
    expect(removedCache.ok).toBe(true);
    if (removedCache.ok)
      expect(
        designOwnership(removedCache.design).grants.some((x) => x.resource === "url-cache"),
      ).toBe(false);
  });
  it("refuses all v3 rows in v2 even with empty scope, exports stable explicit v3 meaning and does not erase operation gaps", () => {
    const design = upgraded(),
      expected = Object.entries(model()).flatMap(([field, rows]) =>
        rows.map((_, index) => ["ownership", field, index]),
      );
    expect(unsupportedBlueprintV2(design).map((x) => x.path)).toEqual(expected);
    expect(() => designBlueprint(design)).toThrow("version=3");
    const a = designBlueprintV3(design),
      reordered = structuredClone(design);
    if (reordered.schemaVersion !== 3 || !reordered.ownership) throw new Error();
    for (const rows of Object.values(reordered.ownership)) rows.reverse();
    expect(designBlueprintV3(reordered).ownership).toEqual(a.ownership);
    const scoped = applyOperations(design, [{ op: "setDesignScope", scope: tinyurlDesignScope() }]);
    if (!scoped.ok) throw new Error();
    expect(unresolvedDesignScope(scoped.design).some((x) => x.id === "create-contract")).toBe(true);
    expect(ownershipFindings(scoped.design).filter(isStructural)).toEqual([]);
  });
});

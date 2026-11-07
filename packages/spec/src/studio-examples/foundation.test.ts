import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyOperations } from "../apply.ts";
import { emptyDesign } from "../design.ts";
import { designReadiness } from "../design-readiness.ts";
import legacy from "../fixtures/nc01-schema2.json" with { type: "json" };
import { studioWarnings } from "../studio-warnings.ts";
import {
  DEFAULT_STUDIO_EXAMPLE_ID,
  studioArchitectureExample,
  studioStudySeedOperations,
} from "./index.ts";

describe("versioned foundation study and complete atomic seed", () => {
  it.each(["studio-tinyurl", "studio-tinyurl-foundation", "studio-youtube", "studio-marketplace"])(
    "roundtrips all semantics of %s through ordinary operations",
    (id) => {
      const { design } = studioArchitectureExample(id),
        before = structuredClone(design);
      const result = applyOperations(emptyDesign(), studioStudySeedOperations(design));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error();
      expect(result.design).toEqual({ ...design, revision: 1 });
      expect(design).toEqual(before);
    },
  );
  it("keeps the extended identity and goal intact and chooses a distinct narrow v3 default", () => {
    expect(studioArchitectureExample("studio-tinyurl").design).toEqual(legacy.design);
    expect(DEFAULT_STUDIO_EXAMPLE_ID).toBe("studio-tinyurl-foundation");
    const design = studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design;
    expect(design.schemaVersion).toBe(3);
    expect(design.elements).toHaveLength(4);
    expect(design.connections).toHaveLength(3);
    expect(design.architecture?.studio?.components).toBeUndefined();
    expect(design.architecture?.studio?.elements.some((x) => x.owner)).toBe(false);
    const description = design.architecture?.system.description ?? "";
    expect(createHash("sha256").update(description).digest("hex")).toBe(
      design.architecture?.studio?.origin?.goalManifestSha256,
    );
    expect(studioWarnings(design)).toEqual([]);
    expect(designReadiness(design)).toMatchObject({
      designValidity: { status: "valid" },
      contractCompleteness: { status: "complete" },
      implementationAvailability: { status: "unavailable" },
      runtimeEvidence: { status: "none" },
      generationEligible: false,
    });
    if (design.schemaVersion !== 3) throw new Error();
    expect(design.operations?.receivers[0]?.binding).toMatchObject({ authVerifier: null });
    expect(design.ownership?.grants).toContainEqual({
      role: "create-api",
      resource: "links-db",
      access: "read-write",
    });
    expect(design.scope.requirements.filter((x) => x.disposition === "excluded")).toHaveLength(6);
  });
  it("refuses a failed final seed operation atomically without upgrading the input", () => {
    const original = emptyDesign(),
      snapshot = structuredClone(original);
    const result = applyOperations(original, [
      ...studioStudySeedOperations(studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design),
      { op: "disconnect", id: "missing" },
    ]);
    expect(result.ok).toBe(false);
    expect(original).toEqual(snapshot);
  });
  it.each(["custom", "excluded"])("retains required %s extras as contract blockers", (mode) => {
    const design = studioArchitectureExample(DEFAULT_STUDIO_EXAMPLE_ID).design;
    if (design.schemaVersion !== 3) throw new Error();
    if (mode === "custom")
      design.scope.customRequirements.push({
        id: "review",
        requirement: "Require a custom deployment policy",
        criticality: "required",
      });
    else {
      const row = design.scope.requirements.find((x) => x.feature === "custom-slugs");
      if (row) row.disposition = "included";
    }
    expect(designReadiness(design).contractCompleteness.status).toBe("incomplete");
    expect(designReadiness(design).generationEligible).toBe(false);
  });
});

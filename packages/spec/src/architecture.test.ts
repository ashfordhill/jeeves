import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureSchema, validateArchitecture } from "./architecture.ts";
import { designSchema } from "./design.ts";
import { sampleDesign, testLookup } from "./test-support.ts";

const intent = () =>
  architectureSchema.parse({
    system: { name: "Inventory", description: "Track stock" },
    nodes: [
      { id: "operator", kind: "person", name: "Operator" },
      { id: "supplier", kind: "external-system", name: "Supplier portal" },
    ],
    relationships: [
      {
        id: "manage",
        from: "operator",
        to: "system",
        description: "Manages stock",
        container: "api",
      },
    ],
  });
describe("architecture intent", () => {
  it("preserves old documents and keeps people/external systems separate from executable elements", () => {
    const design = sampleDesign();
    expect(designSchema.parse(design)).toEqual(design);
    expect(design).not.toHaveProperty("architecture");
    design.architecture = intent();
    expect(validateArchitecture(design)).toEqual([]);
    expect(design.elements).toEqual(sampleDesign().elements);
    expect(
      architectureSchema.safeParse({
        ...intent(),
        nodes: [{ id: "system", kind: "person", name: "bad" }],
      }).success,
    ).toBe(false);
  });
  it("rejects missing/duplicate context references and invalid bindings atomically", () => {
    for (const mutate of [
      (model: ReturnType<typeof intent>) => {
        model.nodes.push(model.nodes[0]!);
      },
      (model: ReturnType<typeof intent>) => {
        model.relationships[0]!.from = "missing";
      },
      (model: ReturnType<typeof intent>) => {
        model.relationships[0]!.container = "missing";
      },
      (model: ReturnType<typeof intent>) => {
        model.relationships[0]!.to = "operator";
      },
      (model: ReturnType<typeof intent>) => {
        model.relationships[0]!.to = "supplier";
      },
    ]) {
      const design = sampleDesign(),
        architecture = intent();
      mutate(architecture);
      const result = applyOperations(
        design,
        [{ op: "setArchitecture", architecture }],
        testLookup,
        { baseRevision: design.revision },
      );
      expect(result.ok).toBe(false);
      expect(design).not.toHaveProperty("architecture");
    }
  });
  it("retains context intent as a visible warning when a bound element is removed", () => {
    const design = sampleDesign();
    design.architecture = intent();
    const result = applyOperations(design, [{ op: "removeElement", id: "api" }], testLookup, {
      baseRevision: design.revision,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.architecture?.relationships[0]).not.toHaveProperty("container");
    expect(result.design.architecture?.relationships[0]?.description).toBe("Manages stock");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "ARCHITECTURE_UNBOUND", severity: "warning" }),
    );
    expect(design.architecture.relationships[0]?.container).toBe("api");
  });
});

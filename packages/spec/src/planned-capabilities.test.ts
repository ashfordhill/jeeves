import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureExample, architectureExamples } from "./architecture-examples.ts";
import { architectureViews } from "./architecture-view.ts";
import { designSchema, emptyDesign } from "./design.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import { plannedCapabilities, plannedConfigSchema } from "./planned-capabilities.ts";
import { sampleDesign, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

describe("planned architecture authoring", () => {
  it.each(architectureExamples)(
    "$name saves through the normal atomic API and stays explicitly planned",
    ({ id }) => {
      const { design } = architectureExample(id);
      expect(designSchema.parse(design)).toEqual(design);
      const result = applyOperations(
        emptyDesign(),
        [
          ...design.elements.map((element) => ({ op: "addElement" as const, element })),
          ...design.connections.map((connection) => ({ op: "connect" as const, connection })),
          { op: "setArchitecture", architecture: design.architecture! },
        ],
        testLookup,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.design.revision).toBe(1);
      expect(result.findings.filter(isStructural)).toEqual([]);
      expect(blocksGenerate(result.findings)).toBe(true);
      const views = architectureViews(result.design, testLookup, "Example");
      expect(
        views.containers.nodes
          .filter((node) => node.binding)
          .every((node) => node.support === "planned"),
      ).toBe(true);
      expect(
        views.components.flatMap((view) => view.nodes).filter((node) => node.kind === "component")
          .length,
      ).toBeGreaterThan(4);
      expect(
        views.containers.edges.filter((edge) => edge.connection).every((edge) => edge.declared),
      ).toBe(true);
    },
  );
  it("every catalog entry has valid defaults and rejects arbitrary settings", () => {
    expect(new Set(plannedCapabilities.map((entry) => entry.id)).size).toBe(
      plannedCapabilities.length,
    );
    for (const capability of plannedCapabilities) {
      const schema = plannedConfigSchema(capability.id);
      expect(schema.safeParse({}).success, capability.id).toBe(true);
      expect(schema.safeParse({ invented: "setting" }).success).toBe(false);
    }
  });
  it("refuses malformed capability config and missing endpoints without changing the input", () => {
    const { design } = architectureExample("link-platform");
    const before = structuredClone(design);
    expect(
      applyOperations(
        design,
        [{ op: "updateElement", id: "cache", config: { ttl: -1 } }],
        testLookup,
      ).ok,
    ).toBe(false);
    expect(
      applyOperations(
        design,
        [
          {
            op: "connect",
            connection: { ...design.connections[0]!, id: "broken", to: { element: "missing" } },
          },
        ],
        testLookup,
      ).ok,
    ).toBe(false);
    expect(design).toEqual(before);
  });
  it("planned arrows cannot satisfy required executable ports", () => {
    const design = sampleDesign();
    const calls = design.connections.find((connection) => connection.kind === "calls")!;
    calls.planned = {
      label: "Future calls",
      protocol: "HTTPS",
      interaction: "Request / response",
      security: "User identity",
    };
    const findings = validateDesign(design, testLookup);
    expect(findings.some((finding) => finding.code === "UNCONNECTED_REQUIRED_PORT")).toBe(true);
    expect(findings.some((finding) => finding.code === "NEEDS_TEMPLATE")).toBe(true);
  });
  it("retains component intent after application removal and rejects new missing bindings", () => {
    const { design } = architectureExample("social");
    const result = applyOperations(design, [{ op: "removeElement", id: "api" }], testLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.architecture?.components).toEqual(design.architecture?.components);
    expect(result.findings.some((finding) => finding.code === "ARCHITECTURE_UNBOUND")).toBe(true);
    const architecture = structuredClone(result.design.architecture!);
    architecture.system.description = "An unrelated documentation edit";
    expect(
      applyOperations(result.design, [{ op: "setArchitecture", architecture }], testLookup).ok,
    ).toBe(true);
    architecture.components?.push({
      id: "bad",
      element: "missing",
      name: "Missing owner",
      responsibility: "",
      config: {},
      members: [],
      usesResources: [],
      usesConnections: [],
    });
    expect(
      applyOperations(result.design, [{ op: "setArchitecture", architecture }], testLookup).ok,
    ).toBe(false);
  });
});

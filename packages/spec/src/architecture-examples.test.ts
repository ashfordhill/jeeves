import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { containerContext } from "./architecture.ts";
import {
  architectureExample,
  architectureExamples,
  legacyArchitectureExample,
} from "./architecture-examples.ts";
import { architectureViews } from "./architecture-view.ts";
import { testLookup } from "./test-support.ts";

for (const example of architectureExamples) {
  it(`${example.id} supplies bounded C4 content with explicit technologies and labeled dependencies`, () => {
    const { design, layout } = architectureExample(example.id);
    expect(design.elements.length).toBeLessThanOrEqual(15);
    expect(Object.keys(layout.items).sort()).toEqual(design.elements.map((item) => item.id).sort());
    for (const element of design.elements) {
      expect(element.description?.length).toBeGreaterThan(10);
      expect(element.technology?.length).toBeGreaterThan(3);
      expect(element.template).toBeNull();
    }
    for (const component of design.architecture!.components!) {
      expect(component.responsibility.length).toBeGreaterThan(10);
      expect(component.technology?.length).toBeGreaterThan(3);
      expect(
        component.usesConnections.length > 0 ||
          design.architecture!.componentRelationships?.some(
            (edge) => edge.from === component.id || edge.to === component.id,
          ),
      ).toBe(true);
    }
    const views = architectureViews(design, testLookup, example.name);
    for (const view of views.components) {
      expect(view.nodes.filter((node) => node.kind === "component").length).toBeLessThanOrEqual(
        example.id === "qrwty-target" ? 14 : 10,
      );
      for (const edge of view.edges) {
        expect(edge.description).not.toMatch(
          /^(calls|uses-database|depends-on|Declared use|Uses store)$/,
        );
        expect(edge.protocol?.length).toBeGreaterThan(0);
        if (!edge.connection) continue;
        const connection = design.connections.find((item) => item.id === edge.connection)!;
        if (connection.from.element === view.container)
          expect(edge.to).toBe(`container:${connection.to.element}`);
        else expect(edge.from).toBe(`container:${connection.from.element}`);
      }
    }
    expect(
      views.containers.nodes.filter(
        (node) =>
          node.name ===
          (example.id === "qrwty-target" ? "Billing: Payment provider" : "Payment provider"),
      ),
    ).toHaveLength(1);
    expect(
      views.containers.nodes.filter(
        (node) =>
          node.name ===
          (example.id === "qrwty-target" ? "E-mail provider" : "E-mail delivery provider"),
      ),
    ).toHaveLength(1);
    expect(views.context.nodes.filter((node) => node.kind === "external-system")).toHaveLength(
      example.id === "qrwty-target" ? 5 : 2,
    );
    expect(
      views.containers.edges.every(
        (edge) => Boolean(edge.protocol) && edge.protocol !== "Undecided",
      ),
    ).toBe(true);
  });
}

describe("QRWTY target study", () => {
  it("includes the reviewed product scope while keeping destination navigation in the visitor browser", () => {
    const { design } = architectureExample("qrwty-target");
    expect(design.elements).toHaveLength(13);
    expect(design.architecture!.system.name).toContain("target architecture");
    expect(design.architecture!.nodes.map((node) => node.name)).toEqual([
      "Link owner",
      "QR visitor",
      "Support staff",
      "Payment provider",
      "E-mail provider",
      "DNS and certificate provider",
      "Destination website",
      "Developer integration",
    ]);
    expect(design.architecture!.scenarios).toHaveLength(6);
    expect(design.architecture!.system.deliveryModel).toBe("Hosted");
    expect(design.connections.some((connection) => connection.to.element === "destination")).toBe(
      false,
    );
    expect(
      design.architecture!.relationships.find((relation) => relation.to === "destination"),
    ).toMatchObject({ from: "visitor" });
  });
  it("creates independent editable copies", () => {
    const first = architectureExample("qrwty-target");
    first.design.elements[0]!.name = "Changed";
    expect(architectureExample("qrwty-target").design.elements[0]!.name).toBe("Application API");
    expect(() => architectureExample("unknown")).toThrow("Unknown architecture example");
  });
});

it("external context bindings reject invalid reuse atomically and survive renames without matching names", () => {
  const { design } = legacyArchitectureExample("qrwty-target");
  const before = structuredClone(design);
  for (const container of ["missing", "api", "db"]) {
    const architecture = structuredClone(design.architecture!);
    architecture.nodes.find((node) => node.id === "payment-provider")!.container = container;
    expect(applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup).ok).toBe(
      false,
    );
  }
  const duplicate = structuredClone(design.architecture!);
  duplicate.nodes.find((node) => node.id === "email-provider")!.container = "billing";
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture: duplicate }], testLookup).ok,
  ).toBe(false);
  const person = structuredClone(design.architecture!);
  person.nodes[0]!.container = "billing";
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture: person }], testLookup).ok,
  ).toBe(false);
  const renamed = applyOperations(
    design,
    [{ op: "updateElement", id: "billing", name: "Renamed provider" }],
    testLookup,
  );
  expect(renamed.ok).toBe(true);
  if (renamed.ok)
    expect(
      containerContext(renamed.design).nodes.some((node) => node.id === "payment-provider"),
    ).toBe(false);
  const removed = applyOperations(design, [{ op: "removeElement", id: "billing" }], testLookup);
  expect(removed.ok).toBe(true);
  if (removed.ok) {
    expect(
      removed.design.architecture!.nodes.find((node) => node.id === "payment-provider"),
    ).not.toHaveProperty("container");
    expect(
      containerContext(removed.design).nodes.some((node) => node.id === "payment-provider"),
    ).toBe(true);
  }
  expect(design).toEqual(before);
});

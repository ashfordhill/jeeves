import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureExample, architectureExamples } from "./architecture-examples.ts";
import { architectureViews } from "./architecture-view.ts";
import { connectionSchema, upgradeDesign } from "./design.ts";
import { connectionPresentation } from "./relationship-display.ts";
import { sampleDesign, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

describe("relationship presentation", () => {
  it("derives defaults from current target names without migrating old documents", () => {
    const design = sampleDesign();
    const original = structuredClone(design);
    expect(connectionPresentation(design.connections[0]!, design)).toEqual({
      description: "Reads and writes API DB records",
      protocol: "SQL",
      interaction: "Request / response",
      planned: false,
    });
    expect(connectionPresentation(design.connections[1]!, design).description).toBe("Calls API");
    expect(design).toEqual(original);
    design.elements[1]!.name = "Inventory";
    expect(connectionPresentation(design.connections[0]!, design).description).toBe(
      "Reads and writes Inventory records",
    );
  });

  it("bounds metadata and keeps semantic findings and endpoints unchanged", () => {
    const design = sampleDesign();
    const findings = validateDesign(design, testLookup);
    const edited = applyOperations(
      design,
      [
        {
          op: "updateConnection",
          id: "c-call",
          label: " Loads stock ",
          protocol: "HTTPS/JSON",
          interaction: "Streaming",
        },
      ],
      testLookup,
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.findings).toEqual(findings);
    expect(edited.design.connections.map((item) => item.id)).toEqual(
      design.connections.map((item) => item.id),
    );
    expect(edited.design.connections[1]).toMatchObject({
      ...upgradeDesign(design).connections[1],
      label: "Loads stock",
    });
    expect(
      connectionSchema.safeParse({ ...design.connections[0], label: "x".repeat(121) }).success,
    ).toBe(false);
    expect(
      connectionSchema.safeParse({ ...design.connections[0], interaction: "planned" }).success,
    ).toBe(false);
    const failed = applyOperations(
      design,
      [
        { op: "updateConnection", id: "c-db", label: "Reads stock" },
        { op: "updateConnection", id: "missing", protocol: "SQL" },
      ],
      testLookup,
    );
    expect(failed.ok).toBe(false);
    expect(design.connections[0]).not.toHaveProperty("label");
  });

  for (const example of architectureExamples)
    it(`${example.id} keeps meaningful labels, protocols and async semantics at C2/C3`, () => {
      const design = architectureExample(example.id).design;
      const views = architectureViews(design, testLookup, example.name);
      for (const view of [views.containers, ...views.components]) {
        for (const edge of view.edges.filter((item) => item.connection)) {
          const connection = design.connections.find((item) => item.id === edge.connection)!;
          expect(edge).toMatchObject(connectionPresentation(connection, design));
          expect(edge.description).not.toMatch(
            /^(calls|depends-on|uses-database|Declared use|Uses store)$/,
          );
        }
      }
      expect(views.containers.edges.some((edge) => edge.interaction === "Asynchronous")).toBe(true);
      const connection = design.connections[0]!;
      const result = applyOperations(
        design,
        [{ op: "updateConnection", id: connection.id, protocol: "AMQP", interaction: "Streaming" }],
        testLookup,
      );
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.design.connections[0]!.planned).toMatchObject({
          protocol: "AMQP",
          interaction: "Streaming",
        });
      expect(
        applyOperations(
          design,
          [{ op: "updateConnection", id: connection.id, label: "" }],
          testLookup,
        ).ok,
      ).toBe(false);
    });
});

import { readFileSync } from "node:fs";
import {
  applyOperations,
  blocksGenerate,
  type DesignDocument,
  designSchema,
  isStructural,
  layoutSchema,
  upgradeDesign,
  validateDesign,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { builtinRegistry } from "./builtin.ts";

const registry = builtinRegistry();

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/designs/${name}`, import.meta.url), "utf8"),
  );
}
const design = (name: string): DesignDocument => designSchema.parse(fixture(name));

describe("fixture designs", () => {
  it("link-shortener is complete and generatable", () => {
    const doc = design("link-shortener.json");
    expect(validateDesign(doc, registry)).toEqual([]);
    const layout = layoutSchema.parse(fixture("link-shortener.layout.json"));
    expect(Object.keys(layout.items)).toEqual(["web", "links", "links-db", "note-analytics"]);
  });

  it("link-shortener can be rebuilt from an empty design with one batch", () => {
    const doc = design("link-shortener.json");
    const result = applyOperations(
      { ...doc, revision: 0, elements: [], connections: [], annotations: [] },
      [
        ...doc.elements.map((element) => ({ op: "addElement" as const, element })),
        ...doc.connections.map((connection) => ({ op: "connect" as const, connection })),
        ...doc.annotations.map((annotation) => ({ op: "addAnnotation" as const, annotation })),
      ],
      registry,
      { baseRevision: 0 },
    );
    expect(result.ok && { ...result.design, revision: doc.revision }).toEqual(upgradeDesign(doc));
  });

  it("incomplete has only readiness findings, which block Generate", () => {
    const findings = validateDesign(design("incomplete.json"), registry);
    expect(findings.map((f) => [f.code, f.target])).toEqual([
      ["NEEDS_TEMPLATE", { element: "payments" }],
      ["CONFIG_REQUIRED", { element: "storefront", path: ["title"] }],
      ["UNCONNECTED_REQUIRED_PORT", { element: "storefront", attachment: "storefront-client" }],
    ]);
    expect(findings.some(isStructural)).toBe(false);
    expect(blocksGenerate(findings)).toBe(true);
  });

  it("incomplete becomes generatable through operations", () => {
    const result = applyOperations(
      design("incomplete.json"),
      [
        { op: "removeElement", id: "payments" },
        { op: "updateElement", id: "storefront", config: { title: "Storefront" } },
        {
          op: "connect",
          connection: {
            id: "storefront-calls-shop",
            kind: "calls",
            from: { element: "storefront", attachment: "storefront-client" },
            to: { element: "shop", attachment: "shop-api" },
          },
        },
      ],
      registry,
      { baseRevision: 3 },
    );
    expect(result.ok && result.findings).toEqual([]);
  });

  it("invalid has the expected structural problems", () => {
    const findings = validateDesign(design("invalid.json"), registry);
    expect(findings.map((f) => [f.code, f.target])).toEqual([
      ["CONFIG_INVALID", { element: "api", path: ["port"] }],
      ["CONFIG_INVALID", { element: "api", path: ["colour"] }],
      ["UNKNOWN_TEMPLATE", { element: "cache" }],
      ["ATTACHMENT_INCOMPATIBLE", { element: "web", attachment: "web-server" }],
      ["PORT_INCOMPATIBLE", { connection: "web-uses-api" }],
      ["UNKNOWN_REFERENCE", { connection: "api-to-ghost" }],
    ]);
    expect(findings.every(isStructural)).toBe(true);
  });
});

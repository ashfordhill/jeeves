import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ContractTypesError, contractTypes } from "./types.ts";

const fixture = (name: string) => new URL(`../test-fixtures/${name}`, import.meta.url);

describe("contractTypes", () => {
  it("emits openapi-typescript-shaped types (golden file, type-checked by test-fixtures/usage.ts)", () => {
    const document = parse(readFileSync(fixture("links.openapi.yaml"), "utf8"));
    const expected = readFileSync(fixture("links.openapi.ts"), "utf8");
    expect(contractTypes(document, "test-fixtures/links.openapi.yaml")).toBe(expected);
  });

  it("is deterministic", () => {
    const document = parse(readFileSync(fixture("links.openapi.yaml"), "utf8"));
    expect(contractTypes(document, "x")).toBe(contractTypes(structuredClone(document), "x"));
  });

  it("parenthesizes unions inside arrays and intersections", () => {
    const types = contractTypes(
      {
        openapi: "3.1.0",
        paths: {},
        components: {
          schemas: {
            List: { type: "array", items: { type: ["string", "null"] } },
            Both: {
              allOf: [
                { $ref: "#/components/schemas/List" },
                { oneOf: [{ const: 1 }, { const: "a" }] },
              ],
            },
            Pairs: { type: "array", items: { type: "array", prefixItems: [{ type: "string" }] } },
          },
        },
      },
      "x",
    );
    expect(types).toContain("List: (string | null)[];");
    expect(types).toContain('Both: components["schemas"]["List"] & (1 | "a");');
    expect(types).toContain("Pairs: [string, ...unknown[]][];");
  });

  it("reports every problem at once", () => {
    const run = () =>
      contractTypes(
        {
          openapi: "3.0.3",
          paths: {
            "/a": { get: { responses: {} } },
            "/b": {
              get: { operationId: "same", responses: {} },
              post: {
                operationId: "same",
                responses: { "200": { $ref: "#/components/responses/Missing" } },
              },
            },
          },
        },
        "contracts/x.openapi.yaml",
      );
    expect(run).toThrow(ContractTypesError);
    try {
      run();
    } catch (error) {
      expect((error as ContractTypesError).problems).toEqual([
        '"openapi" must be 3.1.x (got "3.0.3")',
        "GET /a has no operationId",
        'operationId "same" is used twice',
        "$ref #/components/responses/Missing points at nothing",
      ]);
      expect((error as Error).message).toContain("contracts/x.openapi.yaml");
    }
  });
});

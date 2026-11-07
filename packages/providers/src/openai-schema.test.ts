import { describe, expect, it } from "vitest";
import { strictArguments } from "./openai-schema.ts";

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

describe("OpenAI strict argument codec", () => {
  it("keeps omission, explicit null, empty values and defaults distinct", () => {
    const schema = object(
      {
        owner: { anyOf: [{ type: "string" }, { type: "null" }] },
        enabled: { type: "boolean", default: true },
        label: { type: "string", maxLength: 4 },
        requiredNullable: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      ["requiredNullable"],
    );
    const codec = strictArguments(schema);
    expect(JSON.parse(codec.encode('{"requiredNullable":null}'))).toEqual({
      owner: null,
      enabled: null,
      label: null,
      requiredNullable: null,
    });
    expect(
      JSON.parse(codec.encode('{"owner":null,"enabled":false,"label":"","requiredNullable":null}')),
    ).toEqual({ owner: { value: null }, enabled: false, label: "", requiredNullable: null });
    for (const args of [
      { requiredNullable: null },
      { owner: null, requiredNullable: "x" },
      { owner: "id", enabled: false, label: "", requiredNullable: null },
    ])
      expect(JSON.parse(codec.decode(codec.encode(JSON.stringify(args))))).toEqual(args);
    expect(codec.parameters).toEqual(strictArguments(schema).parameters);
    expect(JSON.stringify(codec.parameters)).not.toContain('"default"');
    expect(schema.properties.enabled).toEqual({ type: "boolean", default: true });
  });

  it("preserves scalar and array constraints and refuses extras before normalization", () => {
    const codec = strictArguments(
      object(
        {
          values: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: { type: "integer", minimum: 2, maximum: 5 },
          },
          text: { type: "string", minLength: 1, maxLength: 3, pattern: "^[a-z]+$" },
          choice: { type: "string", enum: ["a", "b"] },
          literal: { type: "boolean", const: false },
        },
        ["values", "text", "choice", "literal"],
      ),
    );
    const good = { values: [2], text: "ok", choice: "a", literal: false };
    expect(JSON.parse(codec.decode(codec.encode(JSON.stringify(good))))).toEqual(good);
    for (const bad of [
      { ...good, values: [] },
      { ...good, values: [1] },
      { ...good, values: [2.1] },
      { ...good, values: [6] },
      { ...good, values: [2, 3, 4] },
      { ...good, text: "" },
      { ...good, text: "toolong" },
      { ...good, text: "BAD" },
      { ...good, choice: "c" },
      { ...good, literal: true },
      { ...good, extra: null },
    ])
      expect(() => codec.decode(JSON.stringify(bad))).toThrow(/Invalid strict wire/);
    expect(() => codec.decode("{bad json")).toThrow();
    expect(() => codec.decode("null")).toThrow();
    expect(() => codec.decode('{"__proto__":null}')).toThrow();
  });

  it("converts only provably exclusive oneOf branches to anyOf", () => {
    const schema = object(
      {
        from: {
          oneOf: [
            object({ lane: { type: "string", const: "upload" } }, ["lane"]),
            object({ tile: { type: "string" } }, ["tile"]),
          ],
        },
      },
      ["from"],
    );
    const codec = strictArguments(schema);
    expect(JSON.stringify(codec.parameters)).not.toContain('"oneOf"');
    for (const from of [{ lane: "upload" }, { tile: "worker" }]) {
      const json = JSON.stringify({ from });
      expect(codec.decode(codec.encode(json))).toBe(json);
    }
    expect(() => codec.decode('{"from":{"lane":"upload","tile":"worker"}}')).toThrow();
    expect(() =>
      strictArguments(
        object({ value: { oneOf: [{ type: "string" }, { type: "string", minLength: 2 }] } }),
      ),
    ).toThrow(/not provably disjoint/);
  });

  it.each([
    "$ref",
    "$defs",
    "allOf",
    "not",
    "if",
    "format",
    "patternProperties",
    "dependentRequired",
    "unknownFutureConstraint",
  ])("refuses unaudited %s instead of discarding it", (keyword) => {
    expect(() =>
      strictArguments(object({ value: { type: "string", [keyword]: "unsupported" } })),
    ).toThrow(new RegExp(keyword.replaceAll("$", "\\$")));
  });

  it("rejects open objects, implicit types, type arrays and unsupported roots explicitly", () => {
    for (const schema of [
      { type: "object" },
      { type: "object", properties: {}, additionalProperties: true },
      object({ x: {} }),
      object({ x: { type: ["string", "null"] } }),
      { anyOf: [object({}), object({})] },
      object({ x: false }),
      object({ x: { type: "string" } }, ["missing"]),
    ])
      expect(() => strictArguments(schema)).toThrow(/Unsupported OpenAI tool schema/);
  });

  it("checks emitted nesting, property, enum and string budgets", () => {
    let nested: Record<string, unknown> = { type: "string" };
    for (let i = 0; i < 11; i++) nested = object({ child: nested }, ["child"]);
    expect(() => strictArguments(nested)).toThrow(/nesting/);
    expect(() =>
      strictArguments(
        object(
          Object.fromEntries(
            Array.from({ length: 5001 }, (_, i) => [String(i), { type: "string" }]),
          ),
        ),
      ),
    ).toThrow(/budget/);
    expect(() =>
      strictArguments(
        object({
          value: { type: "string", enum: Array.from({ length: 1001 }, (_, i) => String(i)) },
        }),
      ),
    ).toThrow(/budget/);
    expect(() => strictArguments(object({ ["x".repeat(120_001)]: { type: "string" } }))).toThrow(
      /budget/,
    );
    expect(() =>
      strictArguments(
        object({
          value: {
            type: "string",
            enum: Array.from({ length: 251 }, (_, i) => String(i).padStart(60, "x")),
          },
        }),
      ),
    ).toThrow(/15000/);
  });
});

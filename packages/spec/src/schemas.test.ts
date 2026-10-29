import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkConfig, resolveConfig } from "./config.ts";
import { designSchema } from "./design.ts";
import { layoutSchema, pruneLayout } from "./layout.ts";
import { operationBatchJsonSchema, operationBatchSchema, operationTypes } from "./operations.ts";
import { sampleDesign } from "./test-support.ts";

describe("operation JSON Schema", () => {
  const schema = operationBatchJsonSchema() as {
    properties: { ops: { items: { oneOf?: unknown[]; anyOf?: unknown[] } } };
  };

  it("exports every operation type", () => {
    const variants = schema.properties.ops.items.oneOf ?? schema.properties.ops.items.anyOf ?? [];
    const ops = variants.map(
      (v) => (v as { properties: { op: { const: string } } }).properties.op.const,
    );
    expect(ops.sort()).toEqual([...operationTypes].sort());
    expect(ops).toHaveLength(12);
  });

  it("is plain JSON", () => {
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });

  it("matches what the Zod schema accepts", () => {
    const batch = { baseRevision: 0, ops: [{ op: "setNotes", id: "api", notes: "x" }] };
    expect(operationBatchSchema.parse(batch)).toEqual(batch);
    expect(operationBatchSchema.safeParse({ baseRevision: -1, ops: [] }).success).toBe(false);
  });
});

describe("design schema", () => {
  it("fills in defaults", () => {
    const doc = designSchema.parse({
      schemaVersion: 1,
      revision: 0,
      elements: [{ id: "a", name: "A", template: null }],
    });
    expect(doc).toEqual({
      schemaVersion: 1,
      revision: 0,
      elements: [{ id: "a", name: "A", template: null, config: {}, attachments: [], notes: "" }],
      connections: [],
      annotations: [],
    });
  });

  it("rejects bad IDs and unknown fields", () => {
    const base = { schemaVersion: 1, revision: 0 };
    expect(
      designSchema.safeParse({ ...base, elements: [{ id: "Links", name: "x", template: null }] })
        .success,
    ).toBe(false);
    expect(designSchema.safeParse({ ...base, extra: true }).success).toBe(false);
    expect(designSchema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
  });
});

describe("layout", () => {
  it("parses and prunes entries for removed items", () => {
    const layout = layoutSchema.parse({
      schemaVersion: 1,
      items: {
        api: { x: 0, y: 0, parent: "frame" },
        "site-client": { x: 1, y: 2, parent: "gone-frame" },
        removed: { x: 5, y: 5 },
      },
    });
    expect(pruneLayout(layout, sampleDesign()).items).toEqual({
      api: { x: 0, y: 0, parent: "frame" },
      "site-client": { x: 1, y: 2 },
    });
  });
});

describe("config", () => {
  const schema = z.object({
    name: z.string().min(1),
    port: z.int().default(80),
    mode: z.enum(["a", "b"]).optional(),
  });

  it("separates missing required values from invalid ones", () => {
    expect(checkConfig(schema, {})).toEqual({ invalid: [], missing: ["name"] });
    expect(checkConfig(schema, { name: "", port: "x", other: 1 })).toEqual({
      invalid: [
        { path: ["name"], message: expect.any(String) },
        { path: ["port"], message: expect.any(String) },
        { path: ["other"], message: 'Unknown config key "other"' },
      ],
      missing: [],
    });
  });

  it("resolves defaults", () => {
    expect(resolveConfig(schema, { name: "x" })).toEqual({ name: "x", port: 80 });
    expect(() => resolveConfig(schema, {})).toThrow();
  });
});

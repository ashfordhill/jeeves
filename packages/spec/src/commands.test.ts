import { describe, expect, it } from "vitest";
import { resourceConfigSchema, resourceInputSchema } from "./resources.ts";

const model = () => ({
  resources: [
    {
      id: "print",
      name: "print",
      access: "owner",
      fields: [
        { id: "size", name: "size", type: "integer", required: true, minimum: 256, maximum: 1024 },
        {
          id: "style",
          name: "style",
          type: "enum",
          required: false,
          values: ["square", "rounded"],
        },
      ],
      belongsTo: [],
      operations: ["create", "read"],
    },
  ],
  acceptanceCases: ["SAVE-1"],
  extensions: [
    {
      id: "save",
      operationId: "savePrint",
      method: "POST",
      path: "/print/{id}/save",
      access: "owner",
      acceptance: ["SAVE-1"],
      notes: "Save a revision",
      contract: {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: { size: { type: "integer" } },
                required: ["size"],
              },
            },
          },
        },
        responses: { "201": { description: "Saved" } },
      },
    },
  ],
});
describe("bounded fields and owner commands", () => {
  it("validates typed inputs without coercion and exports a JSON schema", () => {
    const parsed = resourceConfigSchema.parse(model());
    const input = resourceInputSchema(parsed.resources[0]!, parsed);
    expect(input.parse({ size: 256, style: "rounded" })).toEqual({ size: 256, style: "rounded" });
    expect(input.parse({ size: 1024, style: null })).toEqual({ size: 1024, style: null });
    for (const value of [
      { size: 255 },
      { size: 1025 },
      { size: 256.5 },
      { size: "256" },
      { size: 512, style: "dots" },
      { size: null },
      { size: 512, ownerId: "caller" },
    ])
      expect(input.safeParse(value).success).toBe(false);
  });
  it.each([
    "public-post",
    "missing-body",
    "get-body",
    "loose-body",
    "other-method",
    "backwards-range",
    "duplicate-enum",
    "unsafe-enum",
  ])("rejects %s", (kind) => {
    const value = model();
    const extension = value.extensions[0]!;
    if (kind === "public-post") extension.access = "public";
    if (kind === "missing-body") Reflect.deleteProperty(extension.contract, "requestBody");
    if (kind === "get-body") extension.method = "GET";
    if (kind === "loose-body")
      extension.contract.requestBody.content["application/json"].schema.additionalProperties = true;
    if (kind === "other-method") extension.method = "PATCH";
    if (kind === "backwards-range") value.resources[0]!.fields[0]!.minimum = 2048;
    if (kind === "duplicate-enum") value.resources[0]!.fields[1]!.values = ["square", "square"];
    if (kind === "unsafe-enum")
      value.resources[0]!.fields[1]!.values = ["sql'); DROP TABLE print;--"];
    expect(resourceConfigSchema.safeParse(value).success).toBe(false);
  });
});

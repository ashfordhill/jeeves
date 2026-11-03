/** Portable logical schema catalog. No OpenAPI interpreter or serializer/runtime is supplied. */
import type { z } from "zod";
import { type ArchitectureContract, architectureContractSchema } from "./architecture-contracts.ts";
import type { ContractField, ContractValue } from "./contract-shapes.ts";
import { inspectContractTransport } from "./contract-transport.ts";
import { contractTypeKey, inspectContractShape } from "./contract-type-resolution.ts";

export type ContractJsonSchema = z.core.JSONSchema.JSONSchema;
export type ContractSchemaIssue = { code: string; path: (string | number)[]; message: string };
export type ContractSchemaExport =
  | { ok: true; schema: ContractJsonSchema; issues: [] }
  | { ok: false; issues: ContractSchemaIssue[] };
const pointer = (part: string) => part.replace(/~/g, "~0").replace(/\//g, "~1");
const ref = (key: string): ContractJsonSchema => ({ $ref: `#/$defs/${pointer(key)}` });
function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Strict contract inspection omitted a required value.");
  return value;
}

/** API documents are catalogs: select an input/output/body ref from x-jeeves.operations.
 * Data/event documents additionally select their payload as the root instance schema.
 * All references are local; every referenced definition is included without expanding the graph.
 */
export function exportContractJsonSchema(contract: ArchitectureContract): ContractSchemaExport {
  const parsed = architectureContractSchema.safeParse(contract);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        code: "INVALID_CONTRACT",
        path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      })),
    };
  const shape = parsed.data.shape;
  if (!shape)
    return {
      ok: false,
      issues: [
        {
          code: "SOURCE_REFERENCE",
          path: ["source"],
          message:
            "Legacy source references retain their authoritative source definition; no second editable or inferred logical schema is created.",
        },
      ],
    };
  const issues = [...inspectContractShape(shape).issues, ...inspectContractTransport(shape).issues];
  if (["data", "event"].includes(contract.kind) ? !shape.payload.length : !shape.operations.length)
    issues.push({
      code: "UNRESOLVED",
      path: [],
      message: "Define the contract payload or operations before exporting logical schemas.",
    });
  if (issues.length) return { ok: false, issues };
  const object = (fields: ContractField[]): ContractJsonSchema => ({
    type: "object",
    properties: Object.fromEntries(
      fields.map((f) => [
        f.name,
        { ...value(f), ...(f.description ? { description: f.description } : {}) },
      ]),
    ),
    required: fields.filter((f) => f.required).map((f) => f.name),
    additionalProperties: false,
  });
  const value = (v: ContractValue): ContractJsonSchema => {
    let schema: ContractJsonSchema;
    switch (v.type) {
      case "ref":
        schema = ref(`type.${contractTypeKey(defined(v.ref))}`);
        break;
      case "object":
        schema = object(defined(v.fields));
        break;
      case "array":
        schema = { type: "array", items: value(defined(v.items)) };
        break;
      case "map":
        schema = {
          type: "object",
          propertyNames: {
            type: "string",
            minLength: defined(v.keys).minLength ?? 0,
            maxLength: defined(v.keys).maxLength,
          },
          additionalProperties: value(defined(v.values)),
          minProperties: v.minEntries ?? 0,
          maxProperties: v.maxEntries,
        };
        break;
      case "tagged-union":
        schema = {
          oneOf: defined(v.variants).map(value),
          "x-jeeves-discriminator": v.discriminator,
        };
        break;
      case "text":
        schema = { type: "string", ...(v.enumValues ? { enum: v.enumValues } : {}) };
        break;
      case "uuid":
        schema = { type: "string", format: "uuid" };
        break;
      case "http-url":
        schema = { type: "string", format: "uri", pattern: "^https?://" };
        break;
      case "timestamp":
        schema = { type: "string", format: "date-time" };
        break;
      case "integer":
      case "number":
      case "boolean":
        schema = { type: v.type };
        break;
      case "unresolved":
        throw new Error("Unresolved contract passed strict inspection.");
    }
    for (const key of [
      "minLength",
      "maxLength",
      "minimum",
      "maximum",
      "minItems",
      "maxItems",
    ] as const)
      if (v[key] !== undefined) schema[key] = v[key];
    return v.nullable ? { anyOf: [schema, { type: "null" }] } : schema;
  };
  const definitions: Record<string, ContractJsonSchema> = Object.fromEntries(
    (shape.types ?? []).map((t) => [`type.${contractTypeKey(t)}`, value(t.value)]),
  );
  const define = (key: string, fields: ContractField[]) => {
    definitions[key] = object(fields);
    return ref(key);
  };
  const operations = shape.operations.map((operation) => {
    const prefix = `operation.${operation.id}`;
    const input = define(`${prefix}.input`, operation.input);
    const output = define(`${prefix}.output`, operation.output);
    const outcomes = (operation.outcomes ?? []).map((o) => ({
      id: o.id,
      ...(o.status !== undefined ? { status: o.status } : {}),
      payload: define(`${prefix}.outcome.${o.id}`, o.payload ?? operation.output),
    }));
    const property = (key: string, field: ContractField) => ({
      $ref: `#/$defs/${pointer(key)}/properties/${pointer(field.name)}`,
    });
    const transport = operation.transport;
    return {
      id: operation.id,
      input,
      output,
      outcomes,
      ...(transport
        ? {
            transport: {
              ...transport,
              parameters: transport.parameters.map((p) => ({
                ...p,
                required: defined(operation.input.find((f) => f.id === p.field)).required,
                schema: property(
                  `${prefix}.input`,
                  defined(operation.input.find((f) => f.id === p.field)),
                ),
              })),
              ...(transport.request?.kind === "json"
                ? {
                    request: {
                      ...transport.request,
                      schema: define(
                        `${prefix}.request`,
                        operation.input.filter(
                          (f) =>
                            transport.request?.kind === "json" &&
                            transport.request.fields.includes(f.id),
                        ),
                      ),
                    },
                  }
                : {}),
              responses: transport.responses.map((response, i) => {
                const outcome = operation.outcomes?.find((o) => o.id === response.outcome);
                const fields = outcome?.payload ?? operation.output;
                const key = outcome ? `${prefix}.outcome.${outcome.id}` : `${prefix}.output`;
                return {
                  ...response,
                  headers: response.headers.map((h) => ({
                    ...h,
                    required: defined(fields.find((f) => f.id === h.field)).required,
                    schema: property(key, defined(fields.find((f) => f.id === h.field))),
                  })),
                  ...(response.body?.kind === "json"
                    ? {
                        body: {
                          ...response.body,
                          schema: define(
                            `${prefix}.response.${i}`,
                            fields.filter(
                              (f) =>
                                response.body?.kind === "json" &&
                                response.body.fields.includes(f.id),
                            ),
                          ),
                        },
                      }
                    : {}),
                };
              }),
            },
          }
        : {}),
    };
  });
  const payload = ["data", "event"].includes(contract.kind)
    ? define("payload", shape.payload)
    : undefined;
  return {
    ok: true,
    issues: [],
    schema: JSON.parse(
      JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $defs: definitions,
        ...(payload ?? {}),
        "x-jeeves": {
          id: contract.id,
          version: contract.version,
          kind: contract.kind,
          purpose: "Logical contract schemas; no runtime availability or verification claim.",
          ...(payload ? { payload } : {}),
          operations,
        },
      }),
    ),
  };
}

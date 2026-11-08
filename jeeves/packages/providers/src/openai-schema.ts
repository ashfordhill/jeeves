/**
 * A deliberately finite JSON Schema codec for OpenAI strict function arguments. The application's
 * schemas and ModelItems remain canonical. Never parse-and-sanitize: validate the whole input
 * before removing omission sentinels. Server command validation still decides what can be done.
 */
import { z } from "zod";

type Schema = Record<string, unknown>;
type Node = {
  schema: Schema;
  canonical: z.ZodType;
  wire: z.ZodType;
  encode(value: unknown): unknown;
  decode(value: unknown): unknown;
};

export type StrictArguments = {
  parameters: Schema;
  encode(argumentsJson: string): string;
  decode(argumentsJson: string): string;
};

const metadata = ["description", "default", "$schema"];
const primitives = ["string", "number", "integer", "boolean", "null"];
const identity = (value: unknown) => value;
const record = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function unsupported(path: string, reason: string): never {
  throw new Error(`Unsupported OpenAI tool schema at ${path}: ${reason}`);
}

/** Closed objects, disjoint literals/types or recursively disjoint unions prove exclusivity. */
function disjoint(a: Schema, b: Schema): boolean {
  const branches = (s: Schema) => (s.oneOf ?? s.anyOf) as Schema[] | undefined;
  const aa = branches(a);
  const bb = branches(b);
  if (aa) return aa.every((branch) => disjoint(branch, b));
  if (bb) return bb.every((branch) => disjoint(a, branch));
  if (a.type !== b.type) {
    return ![a.type, b.type].every((type) => type === "integer" || type === "number");
  }
  const values = (s: Schema) =>
    Object.hasOwn(s, "const") ? [s.const] : (s.enum as unknown[] | undefined);
  const av = values(a);
  const bv = values(b);
  if (av && bv && av.every((value) => !bv.includes(value))) return true;
  if (a.type !== "object") return false;
  const ap = a.properties as Record<string, Schema>;
  const bp = b.properties as Record<string, Schema>;
  const ar = (a.required ?? []) as string[];
  const br = (b.required ?? []) as string[];
  return (
    ar.some((key) => !Object.hasOwn(bp, key)) ||
    br.some((key) => !Object.hasOwn(ap, key)) ||
    ar.some((key) => {
      const left = ap[key];
      const right = bp[key];
      return br.includes(key) && left !== undefined && right !== undefined && disjoint(left, right);
    })
  );
}

export function strictArguments(parameters: Schema): StrictArguments {
  function compile(input: unknown, path: string): Node {
    if (!record(input)) unsupported(path, "expected an explicit schema object");
    const schema = input;
    const unionKey = Object.hasOwn(schema, "oneOf") ? "oneOf" : "anyOf";
    const union = schema[unionKey];
    const type = schema.type;
    const keys = union
      ? [unionKey]
      : type === "object"
        ? ["type", "properties", "required", "additionalProperties"]
        : type === "array"
          ? ["type", "items", "minItems", "maxItems"]
          : type === "string"
            ? ["type", "enum", "const", "minLength", "maxLength", "pattern"]
            : type === "number" || type === "integer"
              ? ["type", "enum", "const", "minimum", "maximum"]
              : ["type", "enum", "const"];
    for (const key of Object.keys(schema))
      if (![...metadata, ...keys].includes(key))
        unsupported(`${path}.${key}`, "keyword not audited");
    if (
      schema.$schema !== undefined &&
      schema.$schema !== "https://json-schema.org/draft/2020-12/schema"
    )
      unsupported(path, "only draft 2020-12 is audited");
    if (schema.description !== undefined && typeof schema.description !== "string")
      unsupported(path, "description must be a string");
    const description = schema.description ? { description: schema.description } : {};
    if (union) {
      if (!Array.isArray(union) || union.length < 2)
        unsupported(path, "unions need at least two branches");
      const children = union.map((branch, i) => compile(branch, `${path}.${unionKey}[${i}]`));
      if (unionKey === "oneOf") {
        for (const [i, left] of children.entries())
          for (const [j, right] of children.entries())
            if (
              j > i &&
              (!disjoint(union[i] as Schema, union[j] as Schema) ||
                !disjoint(left.schema, right.schema))
            )
              unsupported(path, `oneOf branches ${i} and ${j} are not provably disjoint`);
      }
      const convert = (value: unknown, direction: "encode" | "decode") => {
        const matches = children.filter(
          (child) =>
            (direction === "encode" ? child.canonical : child.wire).safeParse(value).success,
        );
        const results = matches.map((child) => child[direction](value));
        if (
          !results.length ||
          results.some((result) => JSON.stringify(result) !== JSON.stringify(results[0]))
        )
          throw new Error(`Ambiguous or invalid union arguments at ${path}`);
        return results[0];
      };
      return {
        schema: { ...description, anyOf: children.map((child) => child.schema) },
        canonical: z.union(children.map((child) => child.canonical)),
        wire: z.union(children.map((child) => child.wire)),
        encode: (value) => convert(value, "encode"),
        decode: (value) => convert(value, "decode"),
      };
    }
    if (type === "object") {
      if (!record(schema.properties) || schema.additionalProperties !== false)
        unsupported(path, "objects require properties and additionalProperties: false");
      const properties = schema.properties;
      const required = schema.required ?? [];
      if (
        !Array.isArray(required) ||
        required.some((key) => typeof key !== "string" || !Object.hasOwn(properties, key)) ||
        new Set(required).size !== required.length
      )
        unsupported(path, "required must list distinct declared properties");
      const children = Object.entries(properties).map(([key, value]) => {
        const child = compile(value, `${path}.${key}`);
        const optional = !required.includes(key);
        // A wrapper distinguishes omitted owner from an explicit null that clears ownership.
        const wrapped = optional && child.canonical.safeParse(null).success;
        const wireSchema = wrapped
          ? {
              type: "object",
              properties: { value: child.schema },
              required: ["value"],
              additionalProperties: false,
            }
          : child.schema;
        const wire = wrapped ? z.strictObject({ value: child.wire }) : child.wire;
        const defaultNote =
          record(value) && Object.hasOwn(value, "default")
            ? ` Server default when omitted: ${JSON.stringify(value.default)}.`
            : "";
        return {
          key,
          child,
          optional,
          wrapped,
          canonical: optional ? child.canonical.optional() : child.canonical,
          wire: optional ? wire.nullable() : wire,
          schema: optional
            ? {
                description: `null omits this field.${wrapped ? " Supply {value: ...} to set it, including {value: null} for explicit null." : ""}${defaultNote}`,
                anyOf: [wireSchema, { type: "null" }],
              }
            : wireSchema,
        };
      });
      return {
        schema: {
          ...description,
          type: "object",
          properties: Object.fromEntries(children.map(({ key, schema }) => [key, schema])),
          required: children.map(({ key }) => key),
          additionalProperties: false,
        },
        canonical: z.strictObject(
          Object.fromEntries(children.map(({ key, canonical }) => [key, canonical])),
        ),
        wire: z.strictObject(Object.fromEntries(children.map(({ key, wire }) => [key, wire]))),
        encode(value) {
          const object = value as Schema;
          return Object.fromEntries(
            children.map(({ key, child, optional, wrapped }) => [
              key,
              optional && !Object.hasOwn(object, key)
                ? null
                : wrapped
                  ? { value: child.encode(object[key]) }
                  : child.encode(object[key]),
            ]),
          );
        },
        decode(value) {
          const object = value as Schema;
          return Object.fromEntries(
            children
              .filter(({ key, optional }) => !optional || object[key] !== null)
              .map(({ key, child, wrapped }) => [
                key,
                child.decode(wrapped ? (object[key] as Schema).value : object[key]),
              ]),
          );
        },
      };
    }
    const bound = (key: string) => {
      const value = schema[key];
      if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value)))
        unsupported(`${path}.${key}`, "expected a finite number");
      return value as number | undefined;
    };
    const size = (key: string) => {
      const value = bound(key);
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
        unsupported(`${path}.${key}`, "expected a nonnegative integer");
      return value;
    };
    if (type === "array") {
      const child = compile(schema.items, `${path}.items`);
      let canonical = z.array(child.canonical);
      let wire = z.array(child.wire);
      for (const key of ["minItems", "maxItems"] as const) {
        const value = size(key);
        if (value === undefined) continue;
        canonical = key === "minItems" ? canonical.min(value) : canonical.max(value);
        wire = key === "minItems" ? wire.min(value) : wire.max(value);
      }
      const { $schema: _, default: _default, ...wireSchema } = schema;
      return {
        schema: { ...wireSchema, items: child.schema },
        canonical,
        wire,
        encode: (value) => (value as unknown[]).map(child.encode),
        decode: (value) => (value as unknown[]).map(child.decode),
      };
    }
    if (!primitives.includes(type as string))
      unsupported(path, `type ${JSON.stringify(type)} not audited`);
    let validator: z.ZodType;
    if (type === "string") {
      let string = z.string();
      const min = size("minLength");
      const max = size("maxLength");
      if (min !== undefined) string = string.min(min);
      if (max !== undefined) string = string.max(max);
      if (schema.pattern !== undefined) {
        if (typeof schema.pattern !== "string") unsupported(path, "pattern must be a string");
        string = string.regex(new RegExp(schema.pattern));
      }
      validator = string;
    } else if (type === "number" || type === "integer") {
      let number = type === "integer" ? z.int() : z.number();
      const min = bound("minimum");
      const max = bound("maximum");
      if (min !== undefined) number = number.min(min);
      if (max !== undefined) number = number.max(max);
      validator = number;
    } else validator = type === "null" ? z.null() : z.boolean();
    if (Object.hasOwn(schema, "enum") && Object.hasOwn(schema, "const"))
      unsupported(path, "enum and const together are not audited");
    const values = Object.hasOwn(schema, "const") ? [schema.const] : schema.enum;
    if (values !== undefined) {
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.some((value) => !validator.safeParse(value).success)
      )
        unsupported(path, "enum/const must contain values matching the type and constraints");
      validator = validator.refine((value) => values.includes(value), "Value outside enum");
    }
    const { $schema: _, default: _default, const: _const, ...wireSchema } = schema;
    return {
      schema: { ...wireSchema, ...(values !== undefined && { enum: values }) },
      canonical: validator,
      wire: validator,
      encode: identity,
      decode: identity,
    };
  }

  if (parameters.type !== "object") unsupported("$", "root must be an object");
  const root = compile(parameters, "$");
  // Check the emitted schema, including presence wrappers, against the documented API limits.
  let properties = 0;
  let enums = 0;
  let strings = 0;
  function limits(schema: Schema, depth: number) {
    if (depth > 10) unsupported("$", "wire schema exceeds 10 nesting levels");
    if (schema.type === "object") {
      const entries = Object.entries(schema.properties as Record<string, Schema>);
      properties += entries.length;
      for (const [key, child] of entries) {
        strings += key.length;
        limits(child, depth + 1);
      }
    }
    if (schema.type === "array") limits(schema.items as Schema, depth + 1);
    if (schema.anyOf) for (const child of schema.anyOf as Schema[]) limits(child, depth);
    if (schema.enum) {
      const values = schema.enum as unknown[];
      const length = values.reduce<number>(
        (sum, value) => sum + (typeof value === "string" ? value.length : 0),
        0,
      );
      enums += values.length;
      strings += length;
      if (values.length > 250 && length > 15_000)
        unsupported("$", "large enum exceeds 15000 characters");
    }
  }
  limits(root.schema, 1);
  if (properties > 5000 || enums > 1000 || strings > 120_000)
    unsupported("$", "wire schema exceeds property, enum or string budget");
  const convert = (json: string, direction: "encode" | "decode") => {
    const value: unknown = JSON.parse(json);
    const validation = (direction === "encode" ? root.canonical : root.wire).safeParse(value);
    if (!validation.success)
      throw new Error(
        `Invalid ${direction === "encode" ? "canonical" : "strict wire"} tool arguments: ${z.prettifyError(validation.error)}`,
      );
    const result = root[direction](value);
    // This check detects a codec mismatch; canonical Zod/command validation is still required.
    (direction === "encode" ? root.wire : root.canonical).parse(result);
    return JSON.stringify(result);
  };
  return {
    parameters: root.schema,
    encode: (json) => convert(json, "encode"),
    decode: (json) => convert(json, "decode"),
  };
}

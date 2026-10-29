/**
 * The model behind the schema-driven config form: fields read from a template's config JSON
 * Schema, text-to-value parsing, and per-field errors from the template's Zod schema (the same
 * `checkConfig` the server validates with). Template configs are flat objects of scalars, so
 * that's what gets dedicated inputs; anything else falls back to a JSON field.
 */
import { type ConfigValues, checkConfig, type TemplateManifest } from "@jeeves/spec";

type FieldBase = {
  key: string;
  title: string;
  description?: string;
  /** No default and must be set (a `CONFIG_REQUIRED` finding until it is). */
  required: boolean;
  default?: unknown;
};

export type ConfigField = FieldBase &
  (
    | { type: "integer" | "number"; min?: number; max?: number }
    | { type: "string" }
    | { type: "boolean" }
    | { type: "enum"; options: string[] }
    | { type: "json" }
  );

type JsonProperty = {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
};

export function configFields(schema: Record<string, unknown>): ConfigField[] {
  const properties = (schema.properties ?? {}) as Record<string, JsonProperty>;
  const required = new Set((schema.required ?? []) as string[]);
  return Object.entries(properties).map(([key, prop]) => {
    const base: FieldBase = {
      key,
      title: prop.title ?? key,
      ...(prop.description ? { description: prop.description } : {}),
      required: required.has(key),
      ...("default" in prop ? { default: prop.default } : {}),
    };
    if (prop.enum?.every((v) => typeof v === "string")) {
      return { ...base, type: "enum", options: prop.enum as string[] };
    }
    switch (prop.type) {
      case "integer":
      case "number":
        return {
          ...base,
          type: prop.type,
          ...(prop.minimum !== undefined ? { min: prop.minimum } : {}),
          ...(prop.maximum !== undefined ? { max: prop.maximum } : {}),
        };
      case "string":
        return { ...base, type: "string" };
      case "boolean":
        return { ...base, type: "boolean" };
      default:
        return { ...base, type: "json" };
    }
  });
}

export type Parsed = { ok: true; value: unknown } | { ok: false; message: string };

/** Turns what was typed into a config value. Empty text means "not set" (`undefined`). */
export function parseFieldInput(field: ConfigField, raw: string): Parsed {
  const text = raw.trim();
  if (text === "" && field.type !== "string") return { ok: true, value: undefined };
  switch (field.type) {
    case "integer":
    case "number": {
      const value = Number(text);
      if (!Number.isFinite(value)) return { ok: false, message: "Enter a number." };
      if (field.type === "integer" && !Number.isInteger(value))
        return { ok: false, message: "Enter a whole number." };
      return { ok: true, value };
    }
    case "string":
      return { ok: true, value: raw === "" ? undefined : raw };
    case "json":
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch {
        return { ok: false, message: "Enter valid JSON." };
      }
    default:
      return { ok: true, value: text };
  }
}

/** Text shown in a field for a stored value; empty when unset so the default shows as a hint. */
export function formatFieldValue(field: ConfigField, value: unknown): string {
  if (value === undefined) return "";
  if (field.type === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

/** The config with one key set, or removed when `value` is undefined. */
export function withValue(config: ConfigValues, key: string, value: unknown): ConfigValues {
  const next = { ...config };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** Why a config would be rejected, per top-level key. Missing required values aren't errors. */
export function configErrors(
  schema: TemplateManifest["config"],
  config: ConfigValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const problem of checkConfig(schema, config).invalid) {
    const key = String(problem.path[0] ?? "");
    errors[key] ??= problem.message;
  }
  return errors;
}

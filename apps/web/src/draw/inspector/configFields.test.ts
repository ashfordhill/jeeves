import { builtinRegistry } from "@jeeves/registry";
import { describe, expect, it } from "vitest";
import {
  configErrors,
  configFields,
  formatFieldValue,
  parseFieldInput,
  withValue,
} from "./configFields.ts";

const registry = builtinRegistry();
const ref = (id: string) => ({ id, version: "0.1.0" });
const schemaOf = (id: string) => {
  const described = registry.describe(ref(id));
  if (!described) throw new Error(id);
  return described.configJsonSchema;
};

describe("config fields from JSON Schema", () => {
  it("reads titles, defaults, bounds, enums, and required keys", () => {
    expect(configFields(schemaOf("http-service"))).toEqual([
      {
        key: "port",
        title: "Port",
        required: false,
        default: 8080,
        type: "integer",
        min: 1,
        max: 65535,
      },
      {
        key: "replicas",
        title: "Replicas",
        description: "Local Docker only runs one unless scaled manually.",
        required: false,
        default: 1,
        type: "integer",
        min: 1,
        max: 10,
      },
      {
        key: "logLevel",
        title: "Log level",
        required: false,
        default: "info",
        type: "enum",
        options: ["debug", "info", "warn", "error"],
      },
    ]);
    const [title] = configFields(schemaOf("web-app"));
    expect(title).toMatchObject({ key: "title", type: "string", required: true });
    expect(title && "default" in title).toBe(false);
  });

  it("falls back to a JSON field for types without a dedicated input", () => {
    const [field] = configFields({ properties: { tags: { type: "array" } } });
    expect(field?.type).toBe("json");
    if (!field) return;
    expect(parseFieldInput(field, '["a"]')).toEqual({ ok: true, value: ["a"] });
    expect(parseFieldInput(field, "[")).toMatchObject({ ok: false });
    expect(formatFieldValue(field, ["a"])).toBe('[\n  "a"\n]');
  });

  it("parses typed text, with empty meaning not set", () => {
    const [port] = configFields(schemaOf("http-service"));
    if (!port) throw new Error("no port");
    expect(parseFieldInput(port, " 9000 ")).toEqual({ ok: true, value: 9000 });
    expect(parseFieldInput(port, "")).toEqual({ ok: true, value: undefined });
    expect(parseFieldInput(port, "80.5")).toEqual({ ok: false, message: "Enter a whole number." });
    expect(parseFieldInput(port, "abc")).toEqual({ ok: false, message: "Enter a number." });
  });

  it("sets and clears keys without touching the others", () => {
    expect(withValue({ port: 1, replicas: 2 }, "port", undefined)).toEqual({ replicas: 2 });
    expect(withValue({ replicas: 2 }, "port", 80)).toEqual({ replicas: 2, port: 80 });
  });

  it("reports malformed values per key with the template's own schema", () => {
    const manifest = registry.get(ref("http-service"));
    if (!manifest) throw new Error("no manifest");
    expect(configErrors(manifest.config, { port: 8080 })).toEqual({});
    expect(Object.keys(configErrors(manifest.config, { port: 70000 }))).toEqual(["port"]);
    // A missing required value is a readiness finding, not an error that blocks saving.
    const web = registry.get(ref("web-app"));
    if (!web) throw new Error("no manifest");
    expect(configErrors(web.config, {})).toEqual({});
  });
});

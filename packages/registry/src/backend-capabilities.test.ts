import { backendCapabilityDescriptorSchema, templateManifestSchema } from "@jeeves/spec";
import { expect, it } from "vitest";
import { z } from "zod";
import { builtinManifests, builtinRegistry } from "./builtin.ts";
import { createRegistry } from "./registry.ts";

const descriptor = backendCapabilityDescriptorSchema.parse({
  schemaVersion: 1,
  id: "synthetic",
  version: "v1",
  name: "Test-only descriptor",
  targets: ["component"],
  provides: [
    {
      kind: "component",
      shapes: ["map", "tagged-union"],
      options: [{ path: "config.retention", support: { kind: "range", minimum: 1, maximum: 365 } }],
    },
  ],
  requires: {
    hostRoles: ["service"],
    hostTemplates: [],
    storeTemplates: [],
    transports: ["REST"],
    context: ["session-principal"],
    revocation: ["read", "idempotent-replay"],
  },
  dependencies: [],
  conflicts: [],
  hooks: [],
  evidencePackIds: ["test-only-pack"],
  origin: { kind: "library", package: "test-only", version: "1.0.0" },
});
const input = {
  id: "synthetic",
  version: "1.0.0",
  kind: "attachment" as const,
  displayName: "Synthetic",
  description: "Isolated test",
  config: z.object({}),
  card: { icon: "box" },
  capabilities: [descriptor],
};
it("serializes exact descriptors deterministically and independently of executable Zod config", () => {
  const r = createRegistry([input]);
  const description = r.describe(input);
  expect(description?.capabilities).toEqual([descriptor]);
  expect(JSON.stringify(description)).toBe(JSON.stringify(r.describe(input)));
  expect(JSON.stringify(description)).not.toContain('"safeParse"');
  const described = description?.capabilities?.[0];
  if (described) described.name = "Changed local description";
  expect(r.get(input)?.capabilities?.[0]?.name).toBe("Test-only descriptor");
  expect(z.toJSONSchema(backendCapabilityDescriptorSchema)).toHaveProperty("properties.requires");
});
it("rejects duplicate exact descriptors while preserving every legacy manifest and registry entry", () => {
  expect(() => createRegistry([{ ...input, capabilities: [descriptor, descriptor] }])).toThrow(
    /repeats an exact capability/,
  );
  const r = builtinRegistry();
  expect(r.list()).toHaveLength(builtinManifests.length);
  for (const m of r.list()) {
    expect(m.capabilities).toBeUndefined();
    expect(r.describe(m)).not.toHaveProperty("capabilities");
  }
  const { capabilities: _capabilities, ...legacy } = input;
  expect(templateManifestSchema.parse(legacy)).not.toHaveProperty("capabilities");
});

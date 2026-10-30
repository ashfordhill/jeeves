import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { designSchema, upgradeDesign } from "./design.ts";
import { resourceConfigJsonSchema, resourceConfigSchema } from "./resources.ts";
import { subtypeDiscards } from "./subtype.ts";
import { sampleDesign, t, testLookup } from "./test-support.ts";

const model = () =>
  resourceConfigSchema.parse({
    resources: [
      {
        id: "qr",
        name: "qr",
        access: "owner",
        fields: [{ id: "url", name: "destination", type: "http-url", required: true }],
        belongsTo: [],
        operations: ["create", "read", "list", "update"],
      },
    ],
    extensions: [],
  });
describe("structured resources", () => {
  it("exports its Zod schema as model-tool JSON Schema", () => {
    const schema = resourceConfigJsonSchema();
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
    expect(schema.properties).toHaveProperty("resources");
  });
  it.each([
    "duplicate-resource",
    "reserved-field",
    "internal-crud",
    "dangling-parent",
    "cycle",
    "operation-collision",
    "missing-acceptance",
    "missing-contract",
  ])("rejects %s", (kind) => {
    const value = model();
    const qr = value.resources[0]!;
    if (kind === "duplicate-resource") value.resources.push(structuredClone(qr));
    if (kind === "reserved-field") qr.fields[0]!.name = "ownerId";
    if (kind === "internal-crud") qr.access = "internal";
    if (kind === "dangling-parent")
      qr.belongsTo.push({ id: "parent", resource: "other-service", required: true });
    if (kind === "cycle") qr.belongsTo.push({ id: "parent", resource: "qr", required: true });
    if (["operation-collision", "missing-acceptance", "missing-contract"].includes(kind)) {
      value.extensions.push({
        id: "extra",
        operationId: kind === "operation-collision" ? "readQr" : "extra",
        method: "GET",
        path: "/extra",
        access: "owner",
        acceptance: ["A1"],
        notes: "Implement extra",
        dependencies: [],
        contract: { parameters: [], responses: { "200": { description: "Success" } } },
      });
      if (kind !== "missing-acceptance") value.acceptanceCases.push("A1");
      if (kind === "missing-contract") value.extensions[0]!.contract.responses = {};
    }
    expect(resourceConfigSchema.safeParse(value).success).toBe(false);
  });
});

describe("v2 compatibility and reviewed edits", () => {
  it("lifts repeated legacy attachment connections independently without changing IDs, notes or layout", () => {
    const legacy = sampleDesign();
    const converted = upgradeDesign(legacy);
    expect(converted.schemaVersion).toBe(2);
    expect(converted.elements).toEqual(legacy.elements);
    expect(converted.connections.map((c) => c.id)).toEqual(legacy.connections.map((c) => c.id));
    for (let i = 0; i < legacy.connections.length; i++) {
      const old = legacy.connections[i]!;
      const next = converted.connections[i]!;
      expect(next.from).toEqual({ element: old.from.element });
      expect(next.to).toEqual({ element: old.to.element });
      expect(next.config?.fromCapability).toBe(old.from.attachment);
      expect(next.config?.toCapability).toBe(old.to.attachment);
    }
    expect(upgradeDesign(converted)).toEqual(converted);
    expect(legacy.schemaVersion).toBe(1);
    expect(designSchema.parse(converted)).toEqual(converted);
  });
  it("requires the exact revision and discard list and prevents chat self-approval", () => {
    const before = sampleDesign();
    const discarded = subtypeDiscards(before, before.elements[0]!);
    const op = {
      op: "changeSubtype" as const,
      id: "api",
      template: t("web"),
      confirmation: { revision: before.revision, discarded },
    };
    expect(applyOperations(before, [{ ...op, confirmation: undefined }], testLookup).ok).toBe(
      false,
    );
    expect(
      applyOperations(
        before,
        [{ ...op, confirmation: { revision: before.revision - 1, discarded } }],
        testLookup,
      ).ok,
    ).toBe(false);
    expect(
      applyOperations(
        before,
        [{ ...op, confirmation: { revision: before.revision, discarded: [] } }],
        testLookup,
      ).ok,
    ).toBe(false);
    expect(applyOperations(before, [op], testLookup, { allowSubtypeConfirmation: false }).ok).toBe(
      false,
    );
    expect(before).toEqual(sampleDesign());
    const result = applyOperations(before, [{ ...op, template: null }], testLookup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.design.elements[0]!.notes).toBe(before.elements[0]!.notes);
      expect(result.design.elements[0]!.attachments).toEqual([]);
    }
  });
});

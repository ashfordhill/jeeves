import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import {
  type ArchitectureContract,
  architectureContractReview,
  architectureContractSchema,
  type ContractField,
  type ContractShape,
  type ContractTypeDefinition,
  type ContractValue,
  contractValueSchema,
  inspectContractShape,
  resolveContractValue,
  validateArchitectureContracts,
} from "./architecture-contracts.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
} from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { targetChanges } from "./architecture-targets.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { operationSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";

const field = (name: string, value: ContractValue, required = true): ContractField => ({
  id: name,
  name,
  required,
  description: "",
  ...value,
});
const ref = (id: string, version = "v1"): ContractValue => ({ type: "ref", ref: { id, version } });
const type = (id: string, value: ContractValue, version = "v1"): ContractTypeDefinition => ({
  id,
  version,
  name: id,
  description: "",
  value,
});
const variant = (tag: string): ContractValue => ({
  type: "object",
  fields: [field("status", { type: "text", enumValues: [tag] }), field("amount", ref("money"))],
});
function definition(): ArchitectureContract {
  return architectureContractSchema.parse({
    id: "checkout",
    version: "v1",
    name: "Checkout results",
    kind: "data",
    coverage: "Complete",
    shape: {
      operations: [],
      types: [
        type("money", {
          type: "object",
          fields: [
            field("minor", { type: "integer", minimum: 0, maximum: 999_999_999 }),
            field("currency", { type: "text", enumValues: ["USD"] }),
          ],
        }),
        type("address", {
          type: "object",
          fields: [field("line1", { type: "text", maxLength: 200 })],
        }),
        type("history", {
          type: "object",
          fields: [
            field("at", { type: "timestamp" }),
            field("action", { type: "text", maxLength: 80 }),
          ],
        }),
        type("paid", variant("paid")),
        type("pending", variant("pending")),
      ],
      payload: [
        field("subtotal", ref("money")),
        field("total", ref("money")),
        field("address", { ...ref("address"), nullable: true }, false),
        field("history", {
          type: "map",
          keys: { minLength: 1, maxLength: 80 },
          maxEntries: 100,
          values: ref("history"),
        }),
        field("payment", {
          type: "tagged-union",
          discriminator: "status",
          variants: [ref("paid"), ref("pending")],
        }),
      ],
    },
  });
}
function shapeOf(contract: ArchitectureContract): ContractShape {
  if (!contract.shape) throw new Error("Expected planned shape");
  return contract.shape;
}
function base(contract = definition()): DesignDocument {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [{ id: "api", name: "API", template: null, planned: "application-api" }],
    architecture: {
      system: { name: "Local types" },
      contracts: [contract],
      interfaces: [
        {
          id: "checkout-result",
          name: "Result",
          owner: { kind: "element", id: "api" },
          direction: "provided",
          necessity: "required",
          contract: { id: "checkout", version: "v1" },
        },
      ],
    },
  });
}
function commit(before: DesignDocument, next: DesignDocument) {
  return applyOperations(
    before,
    [
      { op: "setNotes", id: "api", notes: "Atomic edit" },
      { op: "setArchitecture", architecture: next.architecture ?? null },
    ],
    testLookup,
  );
}
function editShape(design: DesignDocument): ContractShape {
  const contract = design.architecture?.contracts?.[0];
  if (!contract) throw new Error("Expected contract");
  return shapeOf(contract);
}
function editType(shape: ContractShape, id: string): ContractTypeDefinition {
  const result = shape.types?.find((t) => t.id === id);
  if (!result) throw new Error(`Expected type ${id}`);
  return result;
}

it("resolves a shared money type, bounded history dictionary, tagged payment and optional nullable address without mutating saved references", () => {
  const contract = definition();
  const shape = shapeOf(contract);
  const original = structuredClone(shape);
  const report = inspectContractShape(shape);
  expect(report.ok).toBe(true);
  expect(new Set(report.references.map((r) => r.id))).toEqual(
    new Set(["money", "address", "history", "paid", "pending"]),
  );
  const resolved = resolveContractValue({ type: "object", fields: shape.payload }, shape.types);
  expect(resolved.ok).toBe(true);
  expect(contractValueSchema.safeParse(resolved.value).success).toBe(true);
  expect(JSON.stringify(resolved.value)).not.toContain('"ref"');
  const fields = resolved.value?.fields;
  expect(fields?.[0]?.fields).toEqual(fields?.[1]?.fields);
  expect(fields?.[2]).toMatchObject({ type: "object", required: false, nullable: true });
  expect(fields?.[3]).toMatchObject({
    type: "map",
    keys: { minLength: 1, maxLength: 80 },
    maxEntries: 100,
    values: { type: "object" },
  });
  expect(fields?.[4]?.variants?.map((v) => v.fields?.[0]?.enumValues)).toEqual([
    ["paid"],
    ["pending"],
  ]);
  expect(shape).toEqual(original);
  expect(architectureContractReview(base(contract))).toEqual([]);
});

it("keeps nullable referenced definitions nullable and field presence independent", () => {
  const types = [type("address", { type: "text", maxLength: 80, nullable: true })];
  const result = resolveContractValue(
    field("address", { ...ref("address"), nullable: false }, false),
    types,
  );
  expect(result.value).toMatchObject({ type: "text", nullable: true, required: false });
  expect(resolveContractValue(field("requiredAddress", ref("address")), types).value).toMatchObject(
    { required: true, nullable: true },
  );
});

it("rejects wrong-kind properties, malformed references, duplicate fields and invalid map bounds", () => {
  for (const value of [
    { type: "text", ref: { id: "money", version: "v1" } },
    { type: "map", items: { type: "text" } },
    { type: "map", keys: { maxLength: 0 } },
    { type: "map", keys: { minLength: 3, maxLength: 2 } },
    { type: "map", minEntries: 4, maxEntries: 3 },
    { type: "map", maxEntries: 10_001 },
    { type: "array", maxEntries: 4 },
    { type: "ref", ref: { id: "money", version: "" } },
    { type: "ref", ref: { id: "money", version: "v1", url: "https://example.test" } },
    { type: "tagged-union", variants: [variant("paid"), variant("pending")] },
    { type: "tagged-union", discriminator: "status", variants: [variant("paid")] },
    { type: "object", fields: [field("same", { type: "text" }), field("same", { type: "text" })] },
  ])
    expect(contractValueSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
});

it("saves explicit unresolved drafts while resolution and implementation review remain unavailable", async () => {
  for (const value of [
    { type: "unresolved" },
    { type: "ref" },
    { type: "map" },
    { type: "tagged-union", discriminator: "status" },
    {
      type: "tagged-union",
      discriminator: "status",
      variants: [{ type: "unresolved" }, { type: "object" }],
    },
  ] satisfies ContractValue[]) {
    const contract = definition();
    shapeOf(contract).payload = [field("draft", value)];
    const design = base(contract);
    expect(commit(base(), design).ok).toBe(false); // existing consumer pins the old shape
    const blank = base();
    if (blank.architecture) {
      blank.architecture.contracts = [];
      blank.architecture.interfaces = [];
    }
    expect(commit(blank, design).ok).toBe(true);
    expect(validateArchitectureContracts(design)).toEqual([]);
    expect(resolveContractValue(value).value).toBeUndefined();
    expect(architectureContractReview(design)).toContainEqual(
      expect.objectContaining({ code: "UNRESOLVED_CONTRACT" }),
    );
    const handoff = await buildArchitectureHandoff({
      design,
      project: { id: "types", name: "Types" },
      lookup: testLookup,
    });
    expect(handoff.openItems).toContainEqual(
      expect.objectContaining({
        critical: true,
        message: expect.stringContaining("UNRESOLVED_CONTRACT"),
      }),
    );
  }
});

it("rejects stale exact references, duplicate local identities and direct/indirect/unused cycles atomically", () => {
  const original = base();
  for (const mutate of [
    (s: ContractShape) => {
      s.payload[0] = field("subtotal", ref("money", "v99"));
    },
    (s: ContractShape) => {
      s.types?.push(type("money", { type: "text" }));
    },
    (s: ContractShape) => {
      s.types?.push(type("self", ref("self")));
    },
    (s: ContractShape) => {
      s.types?.push(type("a", ref("b")), type("b", { type: "array", items: ref("a") }));
    },
  ]) {
    const design = structuredClone(original);
    const shape = editShape(design);
    mutate(shape);
    expect(inspectContractShape(shape).ok).toBe(false);
    const result = commit(original, design);
    expect(result.ok).toBe(false);
    expect(original).toEqual(base());
    // Independently prove structural validation, rather than only the existing immutability gate.
    expect(validateArchitectureContracts(design).length).toBeGreaterThan(0);
    const blank = base();
    if (blank.architecture) {
      blank.architecture.contracts = [];
      blank.architecture.interfaces = [];
    }
    expect(commit(blank, design).ok).toBe(false);
  }
});

it("bounds expanded depth and total nodes, permits acyclic sharing, and stops expansion without partial values", () => {
  const leaf = type("leaf", { type: "text", maxLength: 80 });
  const pair = type("pair", {
    type: "object",
    fields: [field("left", ref("leaf")), field("right", ref("leaf"))],
  });
  const exact = resolveContractValue(ref("pair"), [leaf, pair], { maxNodes: 6, maxDepth: 3 });
  expect(exact).toMatchObject({ ok: true, visitedNodes: 6 });
  expect(resolveContractValue(ref("pair"), [leaf, pair], { maxNodes: 5 })).toMatchObject({
    ok: false,
    visitedNodes: 5,
    issues: [expect.objectContaining({ code: "NODES" })],
  });
  expect(
    resolveContractValue(ref("pair"), [leaf, pair], { maxDepth: 2 }).issues.some(
      (i) => i.code === "DEPTH",
    ),
  ).toBe(true);
  const types: ContractTypeDefinition[] = [type("n0", { type: "boolean" })];
  for (let i = 1; i <= 22; i++) types.push(type(`n${i}`, ref(`n${i - 1}`)));
  const deep = { operations: [], payload: [field("deep", ref("n22"))], types };
  expect(inspectContractShape(deep).issues.some((i) => i.code === "DEPTH")).toBe(true);
  const tooDeep = base();
  Object.assign(editShape(tooDeep), deep);
  const blank = base();
  if (blank.architecture) {
    blank.architecture.contracts = [];
    blank.architecture.interfaces = [];
  }
  expect(commit(blank, tooDeep).ok).toBe(false);
  types.splice(1);
  for (let i = 1; i <= 12; i++)
    types.push(
      type(`n${i}`, {
        type: "object",
        fields: [field("left", ref(`n${i - 1}`)), field("right", ref(`n${i - 1}`))],
      }),
    );
  const expansion = resolveContractValue(ref("n12"), types);
  expect(expansion).toMatchObject({ ok: false, visitedNodes: 2000 });
  expect(expansion.value).toBeUndefined();
  expect(expansion.issues.some((i) => i.code === "NODES")).toBe(true);
  const oversized = base();
  Object.assign(editShape(oversized), { types, payload: [field("wide", ref("n12"))] });
  expect(
    validateArchitectureContracts(oversized).some((f) => f.message.includes("node budget")),
  ).toBe(true);
  expect(commit(blank, oversized).ok).toBe(false);
  for (const limits of [{ maxDepth: NaN }, { maxDepth: -1 }, { maxNodes: 0 }, { maxNodes: 1.5 }])
    expect(() => resolveContractValue(ref("leaf"), [leaf], limits)).toThrow("budgets");
});

it("rejects ambiguous, repeated, optional, nullable and nonliteral discriminator tags, including resolved aliases", () => {
  for (const mutate of [
    (v: ContractValue) => {
      v.fields?.splice(0, 1);
    },
    (v: ContractValue) => {
      if (v.fields?.[0]) v.fields[0].required = false;
    },
    (v: ContractValue) => {
      if (v.fields?.[0]) v.fields[0].nullable = true;
    },
    (v: ContractValue) => {
      if (v.fields?.[0]) v.fields[0].enumValues = ["pending", "paid"];
    },
    (v: ContractValue) => {
      if (v.fields?.[0]) v.fields[0].enumValues = ["paid"];
    },
    (v: ContractValue) => {
      v.nullable = true;
    },
    (v: ContractValue) => {
      v.type = "text";
      delete v.fields;
    },
  ]) {
    const shape = shapeOf(definition());
    mutate(editType(shape, "pending").value);
    expect(inspectContractShape(shape).issues.some((i) => i.code === "INVALID_UNION")).toBe(true);
    const blank = base();
    if (blank.architecture) {
      blank.architecture.contracts = [];
      blank.architecture.interfaces = [];
    }
    const candidate = base();
    Object.assign(editShape(candidate), shape);
    expect(commit(blank, candidate).ok).toBe(false);
  }
  const shape = shapeOf(definition());
  shape.types?.push(type("paid-tag", { type: "text", enumValues: ["paid"] }));
  const pending = editType(shape, "pending").value;
  if (pending.fields) pending.fields[0] = field("status", ref("paid-tag"));
  expect(inspectContractShape(shape).issues.some((i) => i.code === "INVALID_UNION")).toBe(true);
});

it("covers references in inputs, outputs, nested map values and outcome payloads", () => {
  const shape = shapeOf(definition());
  shape.operations = [
    {
      id: "pay",
      name: "Pay",
      description: "",
      input: [field("amount", ref("money"))],
      output: [field("amount", ref("money"))],
      outcomes: [
        {
          id: "paid",
          name: "Paid",
          kind: "Success",
          condition: "Paid",
          state: "Committed",
          retry: "Safe",
          payload: [
            field("receipt", {
              type: "map",
              keys: { maxLength: 80 },
              maxEntries: 1,
              values: ref("missing"),
            }),
          ],
        },
      ],
    },
  ];
  shape.payload = [];
  const report = inspectContractShape(shape);
  expect(report.issues).toContainEqual(
    expect.objectContaining({
      code: "MISSING_TYPE",
      path: ["operations", 0, "outcomes", 0, "payload", 0, "values"],
    }),
  );
});

it("permits definition display renames but prevents editing or removing a referenced type even while migrating every consumer", () => {
  const original = base();
  const renamed = structuredClone(original);
  editType(editShape(renamed), "money").name = "Exact money";
  editType(editShape(renamed), "money").description = "Minor units and currency";
  expect(commit(original, renamed).ok).toBe(true);
  expect(renamed.architecture?.interfaces).toEqual(original.architecture?.interfaces);
  const deleted = structuredClone(original);
  if (deleted.architecture) {
    deleted.architecture.contracts = [];
    deleted.architecture.interfaces = [];
  }
  expect(commit(original, deleted).ok).toBe(false);
  for (const remove of [false, true]) {
    const changed = structuredClone(original);
    if (changed.architecture) changed.architecture.interfaces = [];
    const shape = editShape(changed);
    if (remove) {
      shape.types = shape.types?.filter((t) => t.id !== "money");
      shape.payload = [];
    } else editType(shape, "money").value = { type: "number" };
    const result = commit(original, changed);
    expect(result.ok).toBe(false);
    expect(original.elements[0]?.notes).toBe("");
    // The local reference gate also protects versions in a contract with no interface consumer.
    const draft = structuredClone(original);
    if (draft.architecture) draft.architecture.interfaces = [];
    expect(commit(draft, changed).ok).toBe(false);
  }
});

it("adds a successor contract/type version and explicitly moves selected consumers while retaining the original definition", () => {
  const original = base();
  const changed = structuredClone(original);
  const successor = definition();
  successor.version = "v2";
  const shape = shapeOf(successor);
  shape.types?.push(type("money", { type: "integer", minimum: 0, maximum: 1000 }, "v2"));
  shape.payload[1] = field("total", ref("money", "v2"));
  changed.architecture?.contracts?.push(successor);
  const consumer = changed.architecture?.interfaces?.[0];
  if (!consumer) throw new Error("Expected interface");
  changed.architecture?.interfaces?.push({
    ...structuredClone(consumer),
    id: "next-result",
    contract: { id: "checkout", version: "v2" },
  });
  const result = commit(original, changed);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.design.architecture?.contracts?.[0]).toEqual(original.architecture?.contracts?.[0]);
  expect(result.design.architecture?.interfaces?.map((i) => i.contract.version)).toEqual([
    "v1",
    "v2",
  ]);
  expect(inspectContractShape(shape).ok).toBe(true);
  expect(commit(result.design, result.design).ok).toBe(true);
});

it("preserves local identities through extraction, insertion, independent copies and exact definition matching", () => {
  const source = base();
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api"] },
    { id: "typed-result", version: "1.0.0", name: "Typed result", purpose: "Reuse local types" },
    testLookup,
  );
  expect(fragment.architecture.contracts?.[0]?.shape).toEqual(editShape(source));
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "a".repeat(64),
    availability: "architecture only",
  };
  const empty = designSchema.parse({ schemaVersion: 2, revision: 0 });
  const request = {
    id: entry.id,
    version: entry.version,
    contentHash: entry.contentHash,
    instanceId: "copy",
    baseRevision: 0,
    name: "Copy",
  };
  const preview = previewArchitectureTemplate(empty, entry, request, testLookup);
  expect(preview.errors).toEqual([]);
  const result = applyOperations(empty, preview.ops, testLookup);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const inserted = result.design.architecture?.contracts?.[0];
  expect(inserted?.id).not.toBe("checkout");
  expect(inserted?.shape).toEqual(editShape(source));
  expect(inspectContractShape(editShape(result.design)).ok).toBe(true);
  const local = fragment.architecture.contracts?.[0]?.id;
  if (!local || !inserted) throw new Error("Expected mapped contract");
  const again = {
    ...request,
    instanceId: "second",
    baseRevision: result.design.revision,
    definitions: { [local]: inserted.id },
  };
  expect(previewArchitectureTemplate(result.design, entry, again, testLookup).errors).toEqual([]);
  const stale = structuredClone(result.design);
  editType(editShape(stale), "money").value = { type: "text" };
  expect(previewArchitectureTemplate(stale, entry, again, testLookup).ok).toBe(false);
  const unresolved = structuredClone(result.design);
  editType(editShape(unresolved), "money").value = { type: "unresolved" };
  const draftEntry = structuredClone(entry);
  const contract = draftEntry.fragment.architecture.contracts?.[0];
  if (!contract) throw new Error("Expected fragment contract");
  editType(shapeOf(contract), "money").value = { type: "unresolved" };
  expect(previewArchitectureTemplate(unresolved, draftEntry, again, testLookup).ok).toBe(false);
  expect(source).toEqual(base());
});

it("exports exact stored graphs in handoff/chat schemas and includes referenced changes in target diffs and fingerprints", async () => {
  const design = base();
  const project = { id: "types", name: "Types" };
  const first = await buildArchitectureHandoff({ design, project, lookup: testLookup });
  expect(first.contracts[0]?.definition).toEqual(editShape(design));
  expect(first.contracts[0]?.status).toBe("resolved");
  expect(handoffJson(await buildArchitectureHandoff({ design, project, lookup: testLookup }))).toBe(
    handoffJson(first),
  );
  const changed = structuredClone(design);
  editType(editShape(changed), "money").value = { type: "text", maxLength: 80 };
  expect(await handoffFingerprint(changed, project)).not.toBe(
    await handoffFingerprint(design, project),
  );
  expect(targetChanges(design, changed)).toEqual([
    expect.objectContaining({ path: "architecture/contracts/checkout@v1", kind: "changed" }),
  ]);
  const jsonSchema = JSON.stringify(z.toJSONSchema(operationSchema, { io: "input" }));
  for (const key of [
    "types",
    "ref",
    "discriminator",
    "variants",
    "minEntries",
    "maxEntries",
    "values",
    "keys",
  ])
    expect(jsonSchema).toContain(`"${key}"`);
  expect(designSchema.parse(JSON.parse(JSON.stringify(design)))).toEqual(design);
});

it("round-trips existing nested payloads and saved legacy designs without adding type metadata", () => {
  const nested = architectureContractSchema.parse({
    id: "nested",
    version: "v1",
    name: "Nested",
    kind: "event",
    description: "",
    shape: {
      operations: [],
      payload: [
        field("items", {
          type: "array",
          maxItems: 30,
          items: {
            type: "object",
            fields: [field("label", { type: "text", maxLength: 80, nullable: true }, false)],
          },
        }),
      ],
    },
  });
  expect(architectureContractSchema.parse(JSON.parse(JSON.stringify(nested)))).toEqual(nested);
  expect(shapeOf(nested)).not.toHaveProperty("types");
  for (const name of [
    "resources",
    "qrwty",
    "pattern-composition",
    "architecture-scenarios",
    "qrwty-architecture",
    "relationship-policies",
  ]) {
    const url = new URL(`../../../fixtures/designs/${name}.json`, import.meta.url);
    const saved = JSON.parse(readFileSync(url, "utf8"));
    const parsed = designSchema.parse(saved);
    expect(designSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(
      parsed.architecture?.contracts?.every((c) => !c.shape || !("types" in c.shape)) ?? true,
    ).toBe(true);
  }
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  type LibraryInsertInput,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { previewArchitecturePattern } from "./architecture-patterns.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { testLookup } from "./test-support.ts";

function base() {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      {
        id: "api",
        name: "API",
        template: null,
        planned: "application-api",
        config: { interface: "REST", apiKey: "private-do-not-copy" },
      },
      { id: "worker", name: "Worker", template: null, planned: "background-worker" },
      { id: "store", name: "Store", template: null, planned: "relational-store" },
    ],
    architecture: { system: { name: "Private project identity" } },
  });
}
function composed(pattern = "tenant-workspace-access", prefix = "tenant", variant = "standard") {
  const design = base();
  const preview = previewArchitecturePattern(
    design,
    {
      pattern,
      version: "1.0.0",
      variant: variant as "standard",
      instanceId: prefix,
      baseRevision: 0,
      config: { name: prefix },
      roles: {
        api: { mode: "reuse", id: "api" },
        worker: { mode: "reuse", id: "worker" },
        store: { mode: "reuse", id: "store" },
      },
    },
    testLookup,
  );
  // A non-delivery pattern has no worker role.
  if (pattern !== "asynchronous-work-delivery") return composeWithoutWorker(design, prefix);
  expect(preview.errors).toEqual([]);
  return applied(design, preview.ops);
}
function composeWithoutWorker(design: DesignDocument, prefix: string) {
  const p = previewArchitecturePattern(
    design,
    {
      pattern: "tenant-workspace-access",
      version: "1.0.0",
      instanceId: prefix,
      baseRevision: 0,
      config: { name: prefix },
      roles: { api: { mode: "reuse", id: "api" }, store: { mode: "reuse", id: "store" } },
    },
    testLookup,
  );
  expect(p.errors).toEqual([]);
  return applied(design, p.ops);
}
function applied(design: DesignDocument, ops: Parameters<typeof applyOperations>[1]) {
  const result = applyOperations(design, ops, testLookup, { baseRevision: design.revision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
function saved(
  design: DesignDocument,
  selection: Parameters<typeof extractArchitectureTemplate>[1],
): ArchitectureLibraryEntry {
  const { fragment, metadata } = extractArchitectureTemplate(
    design,
    selection,
    {
      id: "my-template",
      version: "1.0.0",
      name: "My template",
      purpose: "Reusable access and delivery",
    },
    testLookup,
  );
  return {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "a".repeat(64),
    availability: "architecture only",
  };
}
function request(entry: ArchitectureLibraryEntry, target: DesignDocument): LibraryInsertInput {
  return {
    id: entry.id,
    version: entry.version,
    contentHash: entry.contentHash,
    instanceId: "copy",
    baseRevision: target.revision,
    name: "Local customization",
  };
}

describe("user-defined portable architecture library", () => {
  it("applies only exposed finite options and pins their values without modifying the source", () => {
    const source = composed();
    const entry = saved(source, { elements: ["api", "store"] });
    const role = entry.fragment.roles.find((r) => r.kind === "component" && !r.required)!;
    entry.metadata.exposedOptions = [{ role: role.id, field: "workloadShape" }];
    const target = designSchema.parse({ schemaVersion: 2, revision: 0 });
    const options = { [`${role.id}.workloadShape`]: "Bursty" };
    const p = previewArchitectureTemplate(
      target,
      entry,
      { ...request(entry, target), options },
      testLookup,
    );
    expect(p.errors).toEqual([]);
    const result = applied(target, p.ops);
    expect(
      result.architecture!.components!.find((c) => c.id === `copy-${role.id}`)!.config
        .workloadShape,
    ).toBe("Bursty");
    expect(result.architecture!.patternInstances![0]!.libraryOptions).toEqual(options);
    expect(
      entry.fragment.architecture.components!.find((c) => c.id === role.id)!.config.workloadShape,
    ).toBeUndefined();
  });

  it("retains multiple exact versions of a shared contract definition and supports deliberate definition reuse", () => {
    const source = composed();
    const definition = source.architecture!.contracts!.find((c) => c.kind === "in-process")!;
    source.architecture!.contracts!.push({ ...structuredClone(definition), version: "v2" });
    const entry = saved(source, { elements: ["api", "store"] });
    const target = designSchema.parse({ schemaVersion: 2, revision: 0 });
    const p = previewArchitectureTemplate(target, entry, request(entry, target), testLookup);
    expect(p.errors).toEqual([]);
    const first = applied(target, p.ops);
    expect(
      first.architecture!.contracts!.filter((c) => c.kind === "in-process").map((c) => c.version),
    ).toEqual(["v1", "v2"]);
    const local = entry.fragment.architecture.contracts!.find((c) => c.kind === "in-process")!.id;
    const existing = first.architecture!.contracts!.find((c) => c.kind === "in-process")!.id;
    const explicit = previewArchitectureTemplate(
      first,
      entry,
      { ...request(entry, first), instanceId: "second", definitions: { [local]: existing } },
      testLookup,
    );
    expect(explicit.errors).toEqual([]);
    const result = applied(first, explicit.ops);
    expect(result.architecture!.contracts!.filter((c) => c.kind === "in-process")).toHaveLength(2);
    expect(result.architecture!.patternInstances!.at(-1)!.identities[local]).toBe(existing);
  });

  it("preserves P54 context actors, client states and linked outcomes across a complete planned selection", () => {
    const source = designSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../../../fixtures/designs/architecture-scenarios.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const entry = saved(source, { elements: source.elements.map((e) => e.id) });
    const target = designSchema.parse({
      ...structuredClone(source),
      revision: 0,
      architecture: { ...source.architecture, system: { name: "Independent client product" } },
    });
    const roles = Object.fromEntries(
      entry.fragment.roles
        .filter((r) => r.kind === "context")
        .map((r) => [
          r.id,
          {
            mode: "reuse" as const,
            id: target.architecture!.nodes.find((node) => node.name === r.name)!.id,
          },
        ]),
    );
    const p = previewArchitectureTemplate(
      target,
      entry,
      { ...request(entry, target), roles },
      testLookup,
    );
    expect(p.errors).toEqual([]);
    expect(p.unfilled).toEqual([]);
    const result = applied(target, p.ops);
    expect(result.architecture!.system.name).toBe("Independent client product");
    expect(result.architecture!.scenarios).toHaveLength(source.architecture!.scenarios!.length * 2);
    const journey = result.architecture!.scenarios!.find(
      (s) => s.id.startsWith("copy-") && s.steps.some((step) => step.client),
    )!;
    expect(
      journey.steps
        .filter((s) => s.client)
        .every((s) => s.client!.component.startsWith("copy-") && !!s.binding?.startsWith("copy-")),
    ).toBe(true);
    expect(journey.actor).toBe("owner");
    expect(
      journey.alternatives!.some((p) => p.steps.some((s) => s.client?.state === "denied")),
    ).toBe(true);
  });

  it("extracts a single tenant-access component with named required hosts/interfaces, no project identity or private configuration", () => {
    const entry = saved(composed(), { components: ["tenant-access"] });
    expect(entry.fragment.roles.filter((r) => !r.required).map((r) => r.name)).toEqual([
      "tenant: Tenant access checks",
    ]);
    expect(entry.fragment.roles.some((r) => r.required && r.kind === "component")).toBe(true);
    const text = JSON.stringify(entry);
    expect(text).not.toContain("private-do-not-copy");
    expect(text).not.toContain("Private project identity");
    expect(text).not.toContain('"tenant-access"');
    expect(text).not.toContain("patternInstances");
    const missing = previewArchitectureTemplate(base(), entry, request(entry, base()), testLookup);
    expect(missing.ok).toBe(false);
    expect(missing.unfilled.join(" ")).toMatch(/Workspace membership/);
  });
  it("binds required exact interfaces in another project and preserves shared definitions deliberately", () => {
    const entry = saved(composed(), { components: ["tenant-access"] });
    const target = composed("tenant-workspace-access", "existing");
    const required = entry.fragment.roles.find((r) => r.kind === "component" && r.required)!;
    const req = {
      ...request(entry, target),
      roles: { [required.id]: { mode: "reuse" as const, id: "existing-workspace" } },
    };
    const preview = previewArchitectureTemplate(target, entry, req, testLookup);
    expect(preview.errors).toEqual([]);
    expect(preview.unfilled).toEqual([]);
    expect(preview.ok).toBe(true);
    const result = applied(target, preview.ops);
    expect(result.architecture!.patternInstances!.at(-1)!.libraryContentHash).toBe(
      entry.contentHash,
    );
    expect(result.architecture!.contracts).toHaveLength(target.architecture!.contracts!.length);
    const customized = structuredClone(result);
    customized.architecture!.components!.at(-1)!.responsibility = "Custom local behavior";
    expect(
      entry.fragment.architecture.components?.some(
        (c) => c.responsibility === "Custom local behavior",
      ),
    ).toBe(false);
    const weaker = structuredClone(target);
    weaker.architecture!.bindings!.find((b) => b.role === "request")!.policies!.access!.tenant =
      "Public";
    expect(previewArchitectureTemplate(weaker, entry, req, testLookup).ok).toBe(false);
    const incompatible = structuredClone(target);
    incompatible.architecture!.contracts!.find((c) => c.kind === "in-process")!.shape!
      .operations[0]!.input[0]!.type = "text";
    const rejected = previewArchitectureTemplate(
      incompatible,
      entry,
      { ...req, baseRevision: incompatible.revision },
      testLookup,
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.errors.join(" ")).toMatch(/mismatch/);
  });
  it("copies a multi-container outbox pattern with independent IDs and pinned v1 while v2 is different", () => {
    const source = composed("asynchronous-work-delivery", "delivery", "transactional-outbox");
    const entry = saved(source, { elements: source.elements.map((e) => e.id) });
    const target = designSchema.parse({ schemaVersion: 2, revision: 0 });
    const preview = previewArchitectureTemplate(target, entry, request(entry, target), testLookup);
    expect(preview.errors).toEqual([]);
    expect(preview.unfilled).toEqual([]);
    const result = applied(target, preview.ops);
    expect(result.elements.length).toBe(source.elements.length);
    expect(
      result.elements.every(
        (e) => e.id.startsWith("copy-") && !e.template && !e.attachments.length,
      ),
    ).toBe(true);
    expect(result.architecture!.bindings!.map((b) => b.policies)).toEqual(
      source.architecture!.bindings!.map((b) => b.policies),
    );
    expect(result.architecture!.patternInstances![0]!.version).toBe("1.0.0");
    const v2 = structuredClone(entry);
    v2.version = v2.fragment.version = "2.0.0";
    v2.contentHash = "b".repeat(64);
    expect(result.architecture!.patternInstances![0]!.version).toBe("1.0.0");
    expect(
      previewArchitectureTemplate(
        result,
        v2,
        { ...request(v2, result), instanceId: "next" },
        testLookup,
      ).ok,
    ).toBe(true);
  });
  it("remaps P54 alternative paths, binding/client identities and removes authored review evidence", () => {
    const source = composed("asynchronous-work-delivery", "delivery", "transactional-outbox");
    const s = source.architecture!.scenarios![0]!;
    s.startCondition = "A domain action commits";
    s.outcomes = [
      {
        id: "accepted",
        text: "Retained for delivery",
        invariants: ["No lost intent"],
        requirements: [],
        decisions: [],
      },
    ];
    s.mainOutcomes = ["accepted"];
    s.alternatives = [
      {
        id: "failed",
        name: "Queue unavailable",
        kind: "failure",
        condition: "Queue rejects publication",
        afterStep: s.steps[0]!.id,
        steps: [
          {
            ...s.steps[0]!,
            id: "buffer",
            binding: source.architecture!.bindings!.find(
              (b) => b.relationship.id === s.steps[0]!.relationship.id,
            )!.id,
          },
        ],
        outcomes: ["accepted"],
      },
    ];
    s.review = { fingerprint: "source-only-review" };
    const entry = saved(source, { elements: source.elements.map((e) => e.id) });
    const target = designSchema.parse({ schemaVersion: 2, revision: 0 });
    const p = previewArchitectureTemplate(target, entry, request(entry, target), testLookup);
    expect(p.errors).toEqual([]);
    const result = applied(target, p.ops);
    const scenario = result.architecture!.scenarios![0]!;
    expect(scenario.alternatives![0]!.steps[0]!.relationship.id).toMatch(/^copy-/);
    expect(scenario.alternatives![0]!.steps[0]!.binding).toMatch(/^copy-/);
    expect(scenario.review).toBeUndefined();
    expect(scenario.outcomes![0]!.invariants).toEqual(["No lost intent"]);
  });
  it("refuses retired/hash mismatches, stale designs, invalid options and identity collisions atomically", () => {
    const source = composed();
    const entry = saved(source, { elements: ["api", "store"] });
    const target = base();
    expect(() =>
      previewArchitectureTemplate(
        target,
        { ...entry, state: "retired" },
        request(entry, target),
        testLookup,
      ),
    ).toThrow(/published/);
    expect(() =>
      previewArchitectureTemplate(
        target,
        entry,
        { ...request(entry, target), contentHash: "b".repeat(64) },
        testLookup,
      ),
    ).toThrow(/hash/);
    expect(() =>
      previewArchitectureTemplate(
        target,
        entry,
        { ...request(entry, target), options: { "unknown.setting": "value" } },
        testLookup,
      ),
    ).toThrow(/exposed/);
    expect(
      previewArchitectureTemplate(
        target,
        entry,
        { ...request(entry, target), baseRevision: 99 },
        testLookup,
      ).ops,
    ).toEqual([]);
    const invalidDraft = previewArchitectureTemplate(
      target,
      entry,
      { ...request(entry, target), name: "" },
      testLookup,
    );
    expect(invalidDraft.ok).toBe(false);
    expect(invalidDraft.ops).toEqual([]);
    const p = previewArchitectureTemplate(target, entry, request(entry, target), testLookup);
    expect(p.ok).toBe(true);
    const after = applied(target, p.ops);
    expect(
      previewArchitectureTemplate(after, entry, request(entry, after), testLookup).errors.join(" "),
    ).toMatch(/identity|used/);
  });
});

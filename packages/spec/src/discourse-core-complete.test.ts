import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { contractCanonical, contractKey } from "./architecture-contracts.ts";
import { buildArchitectureHandoff, handoffJson } from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  type LibraryInsertInput,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import {
  architectureFragmentSchema,
  fragmentIds,
  mappedArchitecture,
} from "./architecture-patterns.ts";
import { validateBackendBehavior } from "./backend-behavior.ts";
import { backendModelSchema } from "./backend-model.ts";
import { protocolReferences } from "./backend-protocol-model.ts";
import { exportContractJsonSchema } from "./contract-json-schema.ts";
import { designSchema } from "./design.ts";
import { discourseCoreExample, discourseCorePartialExample } from "./discourse-core-example.ts";
import { discourseCoreDesignTrace, discourseCoreTrace } from "./discourse-core-trace.ts";
import { isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const fixture = () => designSchema.parse(discourseCoreExample().design);
const frozen = (file: string) =>
  JSON.parse(readFileSync(`benchmarks/discourse-core/v1/${file}.json`, "utf8"));
function need<T>(v: T | undefined): T {
  if (v === undefined) throw Error("Missing declaration");
  return v;
}
it("completes the design with exact 35 wire operations, eight pure seams, five scenarios and honest unsupported runtime", () => {
  const d = fixture(),
    m = need(d.architecture?.backend),
    a = need(d.architecture);
  expect(validateDesign(d, testLookup).filter((f) => f.code !== "NEEDS_TEMPLATE")).toEqual([]);
  expect(
    a.contracts
      ?.filter((c) => c.kind === "api" && c.version === "v2")
      .flatMap((c) => c.shape?.operations ?? []),
  ).toHaveLength(35);
  expect(m.hooks).toHaveLength(8);
  expect(a.scenarios).toHaveLength(5);
  expect(Object.keys(discourseCoreExample().layout.architecture ?? {})).toHaveLength(3);
  expect(
    a.deployments?.map((d) => d.instances.filter((i) => i.element === "dc-api").length),
  ).toEqual([1, 2]);
  expect(m.implementations).toBeUndefined();
  expect(m.entities.some((e) => /session|app-user/.test(e.storageId))).toBe(false);
  const before = discourseCorePartialExample().design.architecture;
  for (const c of before?.contracts ?? [])
    expect(a.contracts?.find((v) => contractKey(v) === contractKey(c))).toEqual(c);
  for (const p of before?.backend?.accessPolicies ?? [])
    expect(m.accessPolicies?.find((v) => contractKey(v) === contractKey(p))).toEqual(p);
  for (const c of a.contracts ?? [])
    if (c.shape) expect(exportContractJsonSchema(c).ok, contractKey(c)).toBe(true);
  const session = a.contracts
    ?.filter((c) => c.kind === "api" && c.version === "v2")
    .flatMap((c) => c.shape?.operations ?? [])
    .filter((o) => o.behavior?.session);
  expect(session).toHaveLength(4);
  for (const o of session ?? [])
    expect(o.behavior?.session).toMatchObject({
      authority: "existing-session-owner",
      publicGrants: "none",
      mutationProtection: "origin-csrf",
    });
  const rank = need(m.operations?.find((o) => o.target.operation === "rank")),
    render = need(m.operations?.find((o) => o.target.operation === "render"));
  for (const o of [rank, render]) {
    expect(o.kind).toBe("query");
    expect(o.writes).toEqual([]);
    expect(o.protocol?.receipt).toBe("none");
    expect(o.protocol?.hook).toBeDefined();
  }
  expect(fixture()).toEqual(d); // factories never retain mutable state
});
it("traces exactly twenty frozen rows, all66 observations, source/adaptation identities and every fixture step", () => {
  const req = frozen("requirements"),
    manifest = frozen("manifest"),
    source = frozen("source-map"),
    f = frozen("fixtures"),
    d = fixture();
  expect(discourseCoreTrace.map((r) => [r.id, r.weight, r.target])).toEqual(
    manifest.capabilities.map((r: any) => [r.id, r.weight, r.targetOrigin]),
  );
  expect(
    discourseCoreTrace.flatMap((r) => r.observations).map(({ operations, scenarios, ...o }) => o),
  ).toEqual(req.observations);
  expect(discourseCoreTrace.flatMap((r) => r.observations)).toHaveLength(66);
  const traces = discourseCoreDesignTrace(d);
  expect(traces).toHaveLength(20);
  expect(traces.flatMap((r) => r.observations)).toHaveLength(66);
  for (const row of traces) {
    expect(row.wire.length).toBeGreaterThan(0);
    expect(row.runtime).toBe("unsupported");
    expect(row.observedPoints).toBe(0);
    if (row.id !== "D01") expect(row.data.length).toBeGreaterThan(0);
    if (row.target === "H") expect(row.hooks).toHaveLength(1);
  }
  const identities = new Set(req.observations.map((o: any) => o.id));
  for (const o of d.architecture?.backend?.operations ?? [])
    for (const id of o.protocol?.acceptance ?? []) expect(identities.has(id), id).toBe(true);
  for (const row of discourseCoreTrace) {
    const s = source.rows.find((r: any) => r.caseId === row.id);
    expect([row.source, row.adaptation, row.supportingSources, row.decisions]).toEqual([
      s.primary.id,
      s.adaptation,
      s.supportingSources,
      s.decisions,
    ]);
    for (const ob of row.observations) {
      expect(ob.operations).toEqual(f.observations.find((o: any) => o.id === ob.id).operationIds);
      for (const sc of ob.scenarios) {
        const fixed = f.scenarios.find((s: any) => s.id === sc.id);
        expect(sc.steps).toEqual(
          fixed.steps.filter((s: any) => s.observationIds?.includes(ob.id)).map((s: any) => s.id),
        );
        expect(
          d.architecture?.scenarios
            ?.find((s) => s.id === sc.id.toLowerCase())
            ?.outcomes?.some((o) => o.id === ob.id.toLowerCase() && o.text === ob.expected),
        ).toBe(true);
      }
    }
  }
});
it("preserves all frozen hook signatures and exact allowed-failure/read-only boundaries", () => {
  const d = fixture(),
    m = need(d.architecture?.backend),
    fixed = frozen("hooks.contracts");
  for (const h of m.hooks ?? []) {
    expect(h.kind).toBe("pure");
    expect(h.repositories).toEqual([]);
    expect(h.services).toEqual([]);
    expect(h.timeoutSeconds).toBe(2);
    expect(h.unavailable).toEqual({ outcome: "status-503", status: 503, writes: "none" });
    expect(h.allowedEffects).toEqual([]);
    expect(h.acceptance).toEqual(
      discourseCoreTrace
        .find((r) => r.id === h.name.split(" · ")[1])
        ?.observations.map((o) => o.id),
    );
    for (const [part, ref] of Object.entries(h.contracts)) {
      if (part === "error") continue;
      const c = need(d.architecture?.contracts?.find((c) => contractKey(c) === contractKey(ref))),
        exported = exportContractJsonSchema(c);
      expect(exported.ok).toBe(true);
      if (exported.ok) {
        const raw: any = exported.schema;
        expect(
          Object.keys(
            fixed["JH-" + h.id.replace("dc-jh-", "")][part === "output" ? "result" : "input"]
              .properties,
          ),
        ).toEqual(c.shape?.payload.map((f) => f.name));
        expect(raw).toBeDefined();
      }
    }
  }
});
it("rejects incomplete inputs/writes/participants/versions, foreign selectors, lifecycle bypass and unsafe read mutation", () => {
  const mutations: ((d: ReturnType<typeof fixture>) => void)[] = [
    (d) => need(d.architecture?.backend?.operations?.[0]?.protocol).inputs.pop(),
    (d) => need(d.architecture?.backend?.operations?.[0]?.protocol).records[0]!.writes.pop(),
    (d) => need(d.architecture?.backend?.operations?.[0]).transaction.participants.pop(),
    (d) =>
      need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "restructure")
          ?.protocol,
      ).versionChecks.pop(),
    (d) =>
      (need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "get-topic")
          ?.protocol,
      ).records[0]!.keys[0]!.field = "title"),
    (d) => {
      const p = need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "transition-post")
          ?.protocol,
      );
      need(p.records[0]?.writes.find((w) => w.field === "state")).source = {
        kind: "literal",
        value: "removed",
      };
    },
    (d) =>
      need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "render"),
      ).writes.push({ entity: { id: "dc-topic-entity", version: "v1" }, field: "state" }),
    (d) =>
      (need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "materialize-inbox")
          ?.protocol,
      ).execution = "authority-owner"),
  ];
  for (const mutate of mutations) {
    const d = fixture();
    mutate(d);
    expect(validateBackendBehavior(d).some(isStructural)).toBe(true);
  }
});
it("protects referenced exact policies/hooks/lifecycles through simultaneous consumer removal", () => {
  for (const collection of ["accessPolicies", "hooks", "lifecycles"] as const) {
    const d = fixture(),
      next = fixture(),
      m = need(next.architecture?.backend);
    const first = need(m[collection]?.[0]);
    if (collection === "accessPolicies") need(m.accessPolicies?.[0]).default = "deny"; // mutate an actual semantic field below
    if (collection === "accessPolicies")
      need(m.accessPolicies?.find((p) => p.id === "dc-topic-entity-policy")).rules = [];
    if (collection === "hooks") need(m.hooks?.[0]).timeoutSeconds = 1;
    if (collection === "lifecycles") need(m.lifecycles?.[0]).transitions = [];
    m.operations = [];
    m.effects = [];
    expect(first).toBeDefined();
    expect(
      applyOperations(
        d,
        [{ op: "setArchitecture", architecture: next.architecture ?? null }],
        testLookup,
      ).ok,
    ).toBe(false);
  }
});
it("preserves full protocol refs in extraction/remapping, handoff and chat schema", async () => {
  const d = fixture(),
    m = need(d.architecture?.backend),
    before = structuredClone(d);
  const { fragment } = extractArchitectureTemplate(
    d,
    { elements: ["dc-api", "dc-worker", "dc-db"] },
    {
      id: "disc-test",
      version: "1.0.0",
      name: "Discourse design",
      purpose: "Exact protocol portability",
    },
    testLookup,
  );
  expect(fragment.architecture.backend?.hooks).toHaveLength(8);
  expect(fragment.architecture.backend?.operations).toHaveLength(m.operations?.length ?? 0);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  const mapped = mappedArchitecture(fragment, ids);
  expect(mapped.backend?.operations?.[0]?.protocol?.records[0]?.entity.id).toContain("copy-");
  for (const o of mapped.backend?.operations ?? [])
    for (const r of protocolReferences(need(o.protocol)))
      expect(r.id.startsWith("copy-")).toBe(true);
  const handoff = handoffJson(
    await buildArchitectureHandoff({
      design: d,
      project: { id: "discourse", name: "Complete design" },
      lookup: testLookup,
    }),
  );
  expect(handoff).toContain('"protocol"');
  expect(handoff).toContain("source-scope-message");
  expect(JSON.stringify(operationBatchJsonSchema())).toContain("notification-materialize");
  expect(d).toEqual(before);
  expect(contractCanonical(fixture())).toBe(contractCanonical(d));
}, 30_000);
it("preserves every frozen current wire payload while distinguishing logical503 aliases and no observed response", () => {
  const old = need(discourseCorePartialExample().design.architecture),
    a = need(fixture().architecture);
  for (const c of old.contracts?.filter((c) => c.kind === "api") ?? []) {
    const next = need(a.contracts?.find((v) => v.id === c.id && v.version === "v2"));
    expect(next.shape?.types).toEqual(c.shape?.types);
    for (const wire of c.shape?.operations ?? []) {
      const v = need(next.shape?.operations.find((v) => v.id === wire.id));
      expect(v.input).toEqual(wire.input);
      expect(v.output).toEqual(wire.output);
      const clean = (w: typeof wire) =>
        w.transport?.responses.map(({ outcome, outcomeAliases, ...r }) => r);
      expect(clean(v)).toEqual(clean(wire));
      expect(v.transport?.request).toEqual(wire.transport?.request);
      expect(v.transport?.parameters).toEqual(wire.transport?.parameters);
    }
  }
  const d = fixture(),
    wire = need(
      d.architecture?.contracts
        ?.find((c) => c.id === "dc-content-api" && c.version === "v2")
        ?.shape?.operations.find((o) => o.id === "render"),
    );
  const alias = need(wire.outcomes?.find((o) => o.id === "hook-failed"));
  alias.status = 200;
  expect(validateDesign(d, testLookup).some((f) => f.message.includes("aliases"))).toBe(true);
  const other = fixture(),
    c = need(
      other.architecture?.contracts?.find(
        (c) =>
          c.kind === "api" &&
          c.version === "v2" &&
          c.shape?.operations.some((o) => o.id === "create-topic"),
      ),
    ),
    create = need(c.shape?.operations.find((o) => o.id === "create-topic"));
  need(create.outcomes?.find((o) => o.id === "uncertain")).state = "Committed";
  expect(validateDesign(other, testLookup).some((f) => f.message.includes("No-response"))).toBe(
    true,
  );
});
it("rejects arbitrary derivations, body-owned identities, input bypasses and worker privilege borrowing", () => {
  const mutate: ((d: ReturnType<typeof fixture>) => void)[] = [
    (d) => {
      const o = need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "stage-file"),
      );
      need(o.protocol?.records[0]?.writes.find((w) => w.field === "owner-id")).source = {
        kind: "input",
        path: ["filename"],
      };
    },
    (d) => {
      const o = need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "stage-file"),
      );
      need(o.protocol?.records[0]?.writes.find((w) => w.field === "object-key")).source = {
        kind: "derived",
        rule: "validated-move-plan",
      };
    },
    (d) => {
      const o = need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "rank"),
      );
      need(o.protocol).outputs[0]!.source = "private-stream";
    },
    (d) => {
      const o = need(
        d.architecture?.backend?.operations?.find(
          (o) => o.target.operation === "materialize-inbox",
        ),
      );
      o.target.owner = { kind: "component", id: "dc-cleanup" };
    },
    (d) => {
      const o = need(
        d.architecture?.backend?.operations?.find((o) => o.target.operation === "evaluate-trust"),
      );
      need(o.protocol).hookInputs.pop();
    },
  ];
  for (const change of mutate) {
    const d = fixture();
    change(d);
    expect(validateDesign(d, testLookup).some(isStructural)).toBe(true);
  }
});
function schemaShape(value: any, doc: any): any {
  if (value?.$ref) {
    let x = doc;
    for (const part of value.$ref.slice(2).split("/"))
      x = x[part.replaceAll("~1", "/").replaceAll("~0", "~")];
    return schemaShape(x, doc);
  }
  if (Array.isArray(value)) return value.map((v) => schemaShape(v, doc));
  if (!value || typeof value !== "object") return value;
  const result: any = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["$schema", "$defs", "description", "x-jeeves"].includes(key))
      .map(([key, v]) => [key, schemaShape(v, doc)]),
  );
  if ("const" in result) {
    result.enum = [result.const];
    delete result.const;
  }
  for (const key of ["required", "enum"]) if (result[key]) result[key].sort();
  for (const key of ["minItems", "minLength"]) if (result[key] === 0) delete result[key];
  return result;
}
it("exports all sixteen H signature schemas exactly against the independent frozen contract", () => {
  const d = fixture(),
    fixed = frozen("hooks.contracts");
  for (const h of d.architecture?.backend?.hooks ?? [])
    for (const part of ["input", "output"] as const) {
      const c = need(
          d.architecture?.contracts?.find((c) => contractKey(c) === contractKey(h.contracts[part])),
        ),
        result = exportContractJsonSchema(c);
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(schemaShape(result.schema, result.schema), `${h.name}/${part}`).toEqual(
          schemaShape(
            fixed["JH-" + h.id.replace("dc-jh-", "")][part === "output" ? "result" : "input"],
            fixed,
          ),
        );
    }
});
it("binds causal resource IDs, exact providers, subject fences, unchanged gates and read aliases", () => {
  const d = fixture(),
    m = need(d.architecture?.backend),
    op = (id: string) => need(m.operations?.find((o) => o.target.operation === id));
  const hookInput = (id: string, field: string) =>
    need(op(id).protocol?.hookInputs.find((v) => v.field === field));
  expect(hookInput("evaluate-trust", "principal-id")).toMatchObject({
    source: "input",
    input: ["principal-id"],
  });
  expect(hookInput("restructure", "source-version")).toMatchObject({
    source: "input",
    input: ["source-expected-version"],
  });
  expect(hookInput("privacy", "subject-id")).toMatchObject({
    source: "input",
    input: ["principal-id"],
  });
  expect(hookInput("render", "policy-version")).toMatchObject({
    source: "owner-derived",
    literal: "render-v1",
  });
  expect(op("privacy").protocol?.versionChecks).toContainEqual({
    kind: "session-subject",
    subject: ["principal-id"],
    input: ["expected-version"],
    boundary: "existing-session-owner",
  });
  expect(op("privacy").protocol?.progress).toMatchObject({
    checkpoint: "progress-persisted",
    terminal: "success",
    overflow: "reject-before-mutation",
    maximumItems: 100,
    result: { id: "dc-jh-privacy-output", version: "v1" },
  });
  const intent = need(
    m.effects?.find((e) => e.source.id === op("privacy").id && e.target.kind === "operation"),
  );
  expect(intent.when).toEqual(["progress-persisted"]);
  expect(intent.values.find((v) => v.field === "progress-id")?.value).toMatchObject({
    kind: "current",
    entity: { id: "dc-privacy-request-entity" },
    field: "progress-id",
  });
  const cleanup = need(
    m.effects?.find(
      (e) => e.target.kind === "operation" && e.target.operation.id === op("cleanup-orphans").id,
    ),
  );
  expect(cleanup.payload.id).toBe("dc-private-cleanup-event");
  expect(cleanup.values.find((v) => v.field === "attachment-id")?.value).toMatchObject({
    kind: "current",
    entity: { id: "dc-attachment-entity" },
    field: "id",
  });
  for (const e of m.effects ?? [])
    for (const v of e.values)
      if (v.field.endsWith("-id") && v.field !== "event-id")
        expect(v.value.kind === "server" && v.value.factory === "uuid", `${e.id}/${v.field}`).toBe(
          false,
        );
  const email = need(m.effects?.find((e) => e.id === "dc-inbox-email-intent"));
  expect(email.values.find((v) => v.field === "recipient-id")?.value).toMatchObject({
    kind: "current",
    entity: { id: "dc-subscription-entity" },
    field: "principal-id",
  });
  expect(op("download-file").protocol?.provider).toMatchObject({
    operation: "read-object",
    binding: "dc-private-bytes-read-object",
  });
  expect(op("dispatch-digest").protocol?.provider).toMatchObject({
    contract: { id: "dc-email-delivery", version: "v2" },
    operation: "deliver-email",
  });
  expect(op("reconcile-email").protocol?.provider?.operation).toBe("lookup-delivery");
  expect(
    m.effects?.find((e) => e.source.id === op("transition-post").id && e.execution === "local")
      ?.when,
  ).toEqual(["success"]);
  expect(op("transition-post").outcomes.some((o) => o.trigger === "unchanged")).toBe(true);
  expect(op("post-history").query?.id).toBe("dc-current-history-query");
  expect(
    m.queries
      ?.find((q) => q.id === op("post-history").query?.id)
      ?.projection.find((p) => p.id === "version")?.field.field,
  ).toBe("post-version");
  expect(
    m.queries?.find((q) => q.id === op("inbox").query?.id)?.projection.find((p) => p.id === "title")
      ?.field,
  ).toEqual({ source: "topic", field: "title" });
  expect(
    op("restructure").protocol?.transitions.every(
      (t) => t.transition === "archive-open" && t.selector?.[0] === "source-topic-id",
    ),
  ).toBe(true);
  for (const id of ["put-membership", "put-grant", "put-subscription"]) {
    const r = need(op(id).protocol?.records[0]);
    expect(r.onMissing).toBe("insert-before-cas-from-one");
    expect(r.writes.find((w) => w.field === "version")?.source).toEqual({
      kind: "server",
      factory: "upsert-from-one-version",
    });
    expect(r.writes.filter((w) => w.when === "create-only").map((w) => w.field)).toEqual(
      expect.arrayContaining(["id", "scope-id", "created-at"]),
    );
  }
});

it("keeps reusable composition finite at 32 roles while retaining existing 20-role entries", () => {
  const { fragment } = extractArchitectureTemplate(
    fixture(),
    { elements: ["dc-api", "dc-worker", "dc-db", "dc-files", "dc-email", "dc-client"] },
    { id: "dc-bound", version: "1.0.0", name: "Discourse bound", purpose: "Finite composition" },
    testLookup,
  );
  expect(fragment.roles).toHaveLength(21);
  expect(architectureFragmentSchema.safeParse(fragment).success).toBe(true);
  const role = need(fragment.roles[0]);
  const roles = Array.from({ length: 33 }, (_, i) => ({ ...role, id: `role-${i}` }));
  expect(
    architectureFragmentSchema.safeParse({ ...fragment, roles: roles.slice(0, 20) }).success,
  ).toBe(true);
  expect(
    architectureFragmentSchema.safeParse({ ...fragment, roles: roles.slice(0, 32) }).success,
  ).toBe(true);
  expect(architectureFragmentSchema.safeParse({ ...fragment, roles }).success).toBe(false);
});

it("inserts the full preserved-version fragment and reuses every pinned identity without duplicate backend data", () => {
  const d = fixture(),
    original = structuredClone(d);
  const { fragment, metadata } = extractArchitectureTemplate(
    d,
    { elements: ["dc-api", "dc-worker", "dc-db", "dc-files", "dc-email", "dc-client"] },
    {
      id: "dc-composition",
      version: "1.0.0",
      name: "Discourse composition",
      purpose: "Complete model reuse",
    },
    testLookup,
  );
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
  const external: Record<string, string> = {
    "Email delivery provider": "dc-email",
    "Private object store": "dc-files",
    "External thin client": "dc-client",
    Member: "dc-member",
  };
  const roles: NonNullable<LibraryInsertInput["roles"]> = Object.fromEntries(
    fragment.roles
      .filter((r) => external[r.name])
      .map((r) => [r.id, { mode: "reuse" as const, id: need(external[r.name]) }]),
  );
  const input: LibraryInsertInput = {
    id: entry.id,
    version: entry.version,
    contentHash: entry.contentHash,
    instanceId: "dc-copy",
    baseRevision: d.revision,
    name: "Independent copy",
    roles,
  };
  const preview = previewArchitectureTemplate(d, entry, input, testLookup);
  expect(preview.errors).toEqual([]);
  expect(preview.unfilled).toEqual([]);
  expect(preview.ok).toBe(true);
  const applied = applyOperations(d, preview.ops, testLookup);
  if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
  const next = applied.design,
    model = need(next.architecture?.backend);
  expect(model.entities).toHaveLength(50);
  expect(model.aggregates).toHaveLength(84);
  expect(model.operations).toHaveLength(82);
  expect(model.hooks).toHaveLength(16);
  for (const e of need(d.architecture?.backend).entities)
    expect(model.entities.find((v) => v.id === e.id)).toEqual(e);
  const pinned = need(next.architecture?.patternInstances?.find((p) => p.pattern === entry.id));
  const reuse = previewArchitectureTemplate(
    next,
    entry,
    {
      ...input,
      instanceId: "dc-reuse",
      baseRevision: next.revision,
      roles: Object.fromEntries(
        fragment.roles.map((r) => [
          r.id,
          { mode: "reuse" as const, id: need(pinned.identities[r.id]) },
        ]),
      ),
    },
    testLookup,
  );
  expect(reuse.errors).toEqual([]);
  expect(reuse.unfilled).toEqual([]);
  expect(reuse.ok).toBe(true);
  const reused = applyOperations(next, reuse.ops, testLookup);
  if (!reused.ok) throw new Error(JSON.stringify(reused.errors));
  expect(reused.design.architecture?.backend).toEqual(model);
  expect(reused.design.architecture?.interfaces).toEqual(next.architecture?.interfaces);
  expect(reused.design.architecture?.bindings).toEqual(next.architecture?.bindings);
  expect(reused.design.architecture?.componentRelationships).toEqual(
    next.architecture?.componentRelationships,
  );
  expect(reused.design.connections).toEqual(next.connections);
  const aggregate = need(model.aggregates[0]),
    aggregates = Array.from({ length: 101 }, () => aggregate);
  expect(
    backendModelSchema.safeParse({ ...model, aggregates: aggregates.slice(0, 100) }).success,
  ).toBe(true);
  expect(backendModelSchema.safeParse({ ...model, aggregates }).success).toBe(false);
  expect(d).toEqual(original);
}, 30_000);

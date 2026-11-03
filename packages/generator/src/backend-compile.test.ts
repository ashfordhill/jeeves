import { blocksGenerate, type DesignDocument, validateDesign } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  BackendCompilationError,
  backendPlanJson,
  backendPlanText,
  compileBackendPlan,
  planBackend,
} from "./backend-compile.ts";
import { backendCompileFixture } from "./backend-compile-fixture.ts";
import { backendIdentity } from "./backend-plan.ts";
import { irModel, requiredIR as need, irRef as ref } from "./backend-plan-fixture.ts";
import { planGeneration } from "./backend-routing.ts";
import { templateSet } from "./modules.ts";
import { GenerationError, planProject } from "./plan.ts";
import { fixtureDesign } from "./test-support.ts";

describe("P70 complete pure compiler plan", () => {
  it("compiles a fully planned C2/C3/connection graph without changing planning identities", () => {
    const { design, lookup } = backendCompileFixture(),
      before = structuredClone(design);
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.blockingFindings).toEqual([]);
    expect(plan.blockingDiagnostics).toEqual([]);
    expect(plan.ready).toBe(true);
    expect(compileBackendPlan(design, lookup, { mode: "complete" })).toEqual(plan);
    expect(design).toEqual(before);
    expect(plan.snapshot.design).toEqual(before);
    expect(plan.rawFindings).toEqual(validateDesign(design, lookup));
    expect(
      blocksGenerate(
        [...plan.rawFindings].map((f) => ({
          ...f,
          target: { ...f.target, path: f.target.path ? [...f.target.path] : undefined },
        })),
      ),
    ).toBe(true);
    expect(plan.availability.every((a) => a.discharged)).toBe(true);
    expect(plan.accounting.every((a) => a.outputs.length > 0 && a.status === "supported")).toBe(
      true,
    );
    expect(plan.runtimeOutputAvailable).toBe(false);
    expect(plan).not.toHaveProperty("files");
    expect(plan.ir?.operationAdapters[0]).toMatchObject({
      reference: ref("touch"),
      host: backendIdentity("host", "api"),
      transport: { method: "POST", path: "/topics/{id}/touch" },
      intent: {
        idempotency: { replay: "current-policy-before-result" },
        cancellation: { afterCommit: "committed-or-unknown" },
      },
    });
    expect(plan.ir?.transactions[0]?.participants).toHaveLength(2);
    expect(plan.ir?.intents.find((v) => v.source.kind === "lifecycles")?.intent).toMatchObject({
      initial: "active",
      transitions: [{ id: "archive", from: "active", to: "archived" }],
    });
    expect(
      plan.ir?.intents.find((v) => v.source.kind === "capabilityConfigs")?.intent,
    ).toMatchObject({ kind: "calendar", timezone: "UTC" });
    expect(plan.ir?.effects[0]).toMatchObject({
      reference: ref("publish"),
      operation: backendIdentity("operation", "touch", "v1"),
      intent: { boundary: "atomic-intent", delivery: { guarantee: "at-least-once" } },
    });
  });

  it("permits exact safe hooks only in explicit foundation mode and preserves mode in snapshots", () => {
    const { design, lookup } = backendCompileFixture(true);
    const foundation = planBackend(design, lookup, { mode: "foundation" });
    expect(foundation.blockingFindings).toEqual([]);
    expect(foundation.blockingDiagnostics).toEqual([]);
    expect(foundation.ready).toBe(true);
    expect(foundation.pendingHooks).toEqual([backendIdentity("hook", "custom", "v1")]);
    expect(foundation.accounting.some((a) => a.status === "hooked")).toBe(true);
    expect(foundation.ir?.hookObligations[0]?.intent).toMatchObject({
      readiness: "before-mutation",
      unavailable: { status: 503, writes: "none" },
      acceptance: ["custom-success", "custom-unavailable"],
    });
    const complete = planBackend(design, lookup, { mode: "complete" });
    expect(complete.ready).toBe(false);
    expect(complete.blockingDiagnostics.some((d) => d.code === "HOOK_IMPLEMENTATION_PENDING")).toBe(
      true,
    );
    expect(() => compileBackendPlan(design, lookup, { mode: "complete" })).toThrow(
      BackendCompilationError,
    );
    expect(foundation.snapshot.mode).toBe("foundation");
    expect(complete.snapshot.mode).toBe("complete");
    expect(backendPlanJson(complete)).not.toBe(backendPlanJson(foundation));
  });

  it("requires exact external adapter/environment contracts and keeps fixture configuration explicit", () => {
    const { design, lookup } = backendCompileFixture(false, true);
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.blockingFindings).toEqual([]);
    expect(plan.blockingDiagnostics).toEqual([]);
    expect(plan.ready).toBe(true);
    expect(
      plan.accounting.find(
        (a) => a.obligation.kind === "container" && a.obligation.id === "provider",
      )?.status,
    ).toBe("external");
    expect(
      plan.ir?.runtimeDependencies.find((r) => r.implementation.id === "provider-selection")
        ?.environment,
    ).toMatchObject({
      mode: "fixture",
      configurationId: "fixture-provider",
      credentialId: "fixture-credential",
    });
    delete need(irModel(design).implementations?.find((s) => s.target.id === "provider"))
      .environment;
    expect(() => compileBackendPlan(design, lookup, { mode: "foundation" })).toThrow(
      BackendCompilationError,
    );
  });

  it("blocks a partially mapped relationship, unsupported sibling and omitted host independently", () => {
    for (const target of ["data-link", "audit", "api"]) {
      const { design, lookup } = backendCompileFixture();
      const m = irModel(design);
      if (target === "data-link")
        need(m.implementations?.find((s) => s.target.id === target)).obligations = [];
      else m.implementations = m.implementations?.filter((s) => s.target.id !== target);
      const plan = planBackend(design, lookup, { mode: "foundation" });
      expect(plan.ready).toBe(false);
      expect(plan.accounting.find((a) => a.obligation.id === target)?.status).toBe("unsupported");
      expect(
        plan.accounting.find(
          (a) => a.obligation.id === "domain" && a.obligation.kind === "component",
        )?.status,
      ).toBe("supported");
      expect(plan.snapshot.design).toEqual(design);
      expect(() => compileBackendPlan(design, lookup, { mode: "foundation" })).toThrow(
        BackendCompilationError,
      );
    }
  });

  it("lowers a supported read-only operation with bounded query output and no mutation path", () => {
    const { design, lookup } = backendCompileFixture(false, false, (d) => {
      const m = irModel(d),
        o = need(m.operations?.[0]);
      m.effects = [];
      const q = need(m.queries?.[0]);
      q.root = ref("topic-entity");
      q.joins = [];
      q.sourcePolicies = [];
      q.filters = [];
      q.projection = [{ id: "id", field: { source: "root", field: "id" } }];
      q.order = [{ field: { source: "root", field: "id" }, direction: "asc" }];
      q.cursor.fields = [{ source: "root", field: "id" }];
      q.accessPolicy = { kind: "policy", reference: ref("topic-policy") };
      o.kind = "query";
      o.query = ref(q.id);
      o.access.action = "read";
      delete o.access.writeProjection;
      o.actions = [];
      o.writes = [];
      o.identity = [];
      o.idempotency = { kind: "read-only" };
      o.transaction.kind = "read-only";
      o.outcomes = o.outcomes.filter((v) => !["conflict", "uncertain"].includes(v.trigger));
      need(o.outcomes.find((v) => v.trigger === "success")).values = [
        { field: "records", value: { kind: "query-result" } },
      ];
      const wire = need(
        d.architecture?.contracts?.find((c) => c.id === "commands")?.shape?.operations[0],
      );
      wire.behavior = { ...wire.behavior, kind: "Query" };
      wire.input = wire.input.filter((f) => f.id === "id");
      wire.output = [
        {
          id: "records",
          name: "records",
          description: "",
          required: true,
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            fields: [{ id: "id", name: "id", description: "", required: true, type: "uuid" }],
          },
        },
      ];
      wire.outcomes = wire.outcomes?.filter((v) => !["conflict", "uncertain"].includes(v.id));
      for (const outcome of wire.outcomes ?? []) if (outcome.id !== "success") outcome.payload = [];
      need(wire.outcomes?.find((v) => v.id === "success")).state = "Unchanged";
      const transport = need(wire.transport);
      transport.method = "GET";
      transport.path = "/topics/{id}";
      delete transport.request;
      transport.responses = transport.responses.filter(
        (r) => !["conflict", "uncertain"].includes(r.outcome ?? ""),
      );
      need(transport.responses.find((r) => r.outcome === "success")).body = {
        kind: "json",
        contentType: "application/json",
        fields: ["records"],
      };
    });
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.blockingFindings).toEqual([]);
    expect(plan.blockingDiagnostics).toEqual([]);
    expect(plan.ready).toBe(true);
    expect(plan.ir?.operationAdapters[0]?.intent).toMatchObject({
      kind: "query",
      actions: [],
      writes: [],
      query: ref("post-feed"),
      idempotency: { kind: "read-only" },
    });
    expect(plan.ir?.transactions[0]?.intent.kind).toBe("read-only");
  });

  it("blocks unaccounted provided operations even when their contract has exact descriptor support", () => {
    const { design, lookup } = backendCompileFixture(false, false, (d) => {
      const contract = need(d.architecture?.contracts?.find((c) => c.id === "commands")?.shape);
      const added = structuredClone(need(contract.operations[0]));
      added.id = "unprovided";
      need(added.transport).path = "/other/{id}";
      contract.operations.push(added);
    });
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.support.fullReady).toBe(true);
    expect(plan.blockingDiagnostics.map((d) => d.code)).toContain("OPERATION_UNACCOUNTED");
    expect(plan.ready).toBe(false);
  });

  it("accounts external API behavior only through that exact provider interface/operation adapter", () => {
    const { design, lookup } = backendCompileFixture(false, true, (d) => {
      const a = need(d.architecture);
      for (const id of ["provider-provided", "provider-required"])
        need(a.interfaces?.find((i) => i.id === id)).contract = ref("commands");
      const binding = need(a.bindings?.find((b) => b.id === "provider-binding"));
      binding.contract = ref("commands");
      binding.operation = "touch";
    });
    expect(planBackend(design, lookup, { mode: "complete" }).ready).toBe(true);
    const provided = need(
      design.architecture?.interfaces?.find((i) => i.id === "provider-provided"),
    );
    need(design.architecture?.interfaces).push({ ...provided, id: "unmapped-provider-interface" });
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.ready).toBe(false);
    expect(
      plan.blockingDiagnostics.some(
        (d) => d.code === "OPERATION_UNACCOUNTED" && d.source.id === "unmapped-provider-interface",
      ),
    ).toBe(true);
  });

  it("does not convert an anonymous unsupported strategy into an implicit foundation hook", () => {
    const { design, lookup } = backendCompileFixture(true);
    need(irModel(design).operations?.[0]).actions.push({
      id: "unsupported",
      kind: "capability",
      strategy: { kind: "unsupported", reference: ref("unregistered"), result: ref("hook-output") },
      input: [],
    });
    const plan = planBackend(design, lookup, { mode: "foundation" });
    expect(plan.ready).toBe(false);
    expect(
      plan.blockingFindings.some(
        (f) => f.code === "NEEDS_TEMPLATE" && f.message.includes("not an implicit hook"),
      ),
    ).toBe(true);
    expect(
      plan.availability.find((a) => a.finding.message.includes("not an implicit hook")),
    ).toMatchObject({ discharged: false, obligations: [] });
  });

  it("keeps malformed hook signatures, unsafe outcomes and missing hook selections blocking", () => {
    const mutations = [
      (d: DesignDocument) => {
        need(irModel(d).implementations?.find((s) => s.target.id === "domain")).hooks = [];
      },
      (d: DesignDocument) => {
        need(irModel(d).hooks?.[0]).unavailable.outcome = "success";
      },
      (d: DesignDocument) => {
        need(irModel(d).hooks?.[0]).contracts.input.version = "missing";
      },
      (d: DesignDocument) => {
        need(irModel(d).hooks?.[0]).recovery = [];
      },
    ];
    for (const mutate of mutations) {
      const { design, lookup } = backendCompileFixture(true);
      mutate(design);
      const plan = planBackend(design, lookup, { mode: "foundation" });
      expect(plan.ready).toBe(false);
      expect(plan.blockingFindings.length + plan.blockingDiagnostics.length).toBeGreaterThan(0);
      expect(() => compileBackendPlan(design, lookup, { mode: "foundation" })).toThrow(
        BackendCompilationError,
      );
    }
  });

  it("retains structural errors while discharging only separate exact availability obligations", () => {
    const { design, lookup } = backendCompileFixture();
    need(design.architecture?.bindings?.[0]).required = "missing-interface";
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.ready).toBe(false);
    expect(plan.blockingFindings.some((f) => f.code === "UNKNOWN_REFERENCE")).toBe(true);
    expect(plan.rawFindings).toEqual(validateDesign(design, lookup));
    expect(plan.support.structuralFindings.length).toBeGreaterThan(0);
    expect(
      plan.ir?.intents.find((v) => v.source.kind === "binding" && v.source.id === "data-binding")
        ?.intent,
    ).toMatchObject({ required: "missing-interface" });
  });

  it("detects same-host route and hook path collisions without overwriting intent", () => {
    const { design, lookup } = backendCompileFixture(true),
      m = irModel(design),
      a = need(design.architecture);
    const duplicateContract = structuredClone(need(a.contracts?.find((c) => c.id === "commands")));
    duplicateContract.id = "other-commands";
    need(a.contracts).push(duplicateContract);
    need(a.interfaces).push({
      ...structuredClone(need(a.interfaces?.[0])),
      id: "other-provided",
      contract: ref("other-commands"),
    });
    const duplicateOperation = structuredClone(need(m.operations?.[0]));
    duplicateOperation.id = "other-operation";
    duplicateOperation.target.contract = ref("other-commands");
    need(m.operations).push(duplicateOperation);
    const duplicateHook = structuredClone(need(m.hooks?.[0]));
    duplicateHook.version = "v2";
    need(m.hooks).push(duplicateHook);
    const plan = planBackend(design, lookup, { mode: "foundation" });
    expect(plan.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(["ROUTE_COLLISION", "HOOK_PATH_COLLISION"]),
    );
    expect(plan.ready).toBe(false);
    expect(plan.ir?.operationAdapters).toHaveLength(2);
    expect(plan.ir?.hookObligations).toHaveLength(2);
  });

  it("blocks cyclic effects, hooks and runtime dependencies before a strict compile returns", () => {
    for (const kind of ["effects", "hooks", "runtime"] as const) {
      const { design, lookup } = backendCompileFixture(true),
        m = irModel(design);
      if (kind === "effects") need(m.effects?.[0]).after = [ref("publish")];
      if (kind === "hooks") need(m.hooks?.[0]).dependencies = [ref("custom")];
      if (kind === "runtime") {
        const selected = need(m.implementations?.find((s) => s.target.id === "domain"));
        const descriptor = need(
          lookup.get(selected.template)?.capabilities?.find((c) => c.id === selected.capability.id),
        );
        descriptor.dependencies.push({
          template: selected.template,
          capability: selected.capability,
        });
      }
      const plan = planBackend(design, lookup, { mode: "foundation" });
      expect(plan.diagnostics.map((d) => d.code)).toContain(
        { effects: "EFFECT_CYCLE", hooks: "HOOK_CYCLE", runtime: "DEPENDENCY_CYCLE" }[kind],
      );
      expect(plan.ready).toBe(false);
      expect(() => compileBackendPlan(design, lookup, { mode: "foundation" })).toThrow(
        BackendCompilationError,
      );
    }
  });

  it("retains ordinary bidirectional C2 collaboration without inventing an execution cycle", () => {
    const { design, lookup } = backendCompileFixture(false, false, (d) => {
      const a = need(d.architecture);
      d.connections.push({
        ...structuredClone(need(d.connections[0])),
        id: "reverse-link",
        from: { element: "store" },
        to: { element: "api" },
      });
      need(a.interfaces).push(
        {
          ...need(a.interfaces?.[1]),
          id: "reverse-provided",
          owner: { kind: "component", id: "domain" },
        },
        {
          ...need(a.interfaces?.[2]),
          id: "reverse-required",
          owner: { kind: "element", id: "store" },
        },
      );
      need(a.bindings).push({
        ...need(a.bindings?.[0]),
        id: "reverse-binding",
        relationship: { kind: "connection", id: "reverse-link" },
        provided: "reverse-provided",
        required: "reverse-required",
      });
    });
    const plan = planBackend(design, lookup, { mode: "complete" });
    expect(plan.blockingFindings).toEqual([]);
    expect(plan.blockingDiagnostics).toEqual([]);
    expect(plan.ready).toBe(true);
    expect(plan.ir?.intents.filter((v) => v.source.kind === "connection")).toHaveLength(2);
  });

  it("resolves exact runtime dependency versions in the same host and retains their claimed origin/evidence", () => {
    const { design, lookup } = backendCompileFixture(),
      m = irModel(design);
    const audit = need(m.implementations?.find((s) => s.target.id === "audit"));
    const manifest = need(lookup.get(audit.template));
    const descriptor = structuredClone(need(manifest.capabilities?.[0]));
    descriptor.id = "audit-runtime";
    need(manifest.capabilities).push(descriptor);
    audit.capability = ref("audit-runtime");
    const domain = need(m.implementations?.find((s) => s.target.id === "domain"));
    const own = structuredClone(need(manifest.capabilities?.[0]));
    own.id = "domain-runtime";
    own.dependencies = [{ template: audit.template, capability: audit.capability }];
    need(manifest.capabilities).push(own);
    domain.capability = ref("domain-runtime");
    const plan = compileBackendPlan(design, lookup, { mode: "complete" });
    expect(
      plan.ir?.runtimeDependencies.find((r) => r.implementation.id === domain.id),
    ).toMatchObject({
      dependencies: [backendIdentity("runtime", audit.id, audit.version)],
      origin: { package: "isolated-compiler-fixture", version: "1.0.0" },
      evidencePackIds: ["unobserved-ir-fixture"],
    });
    own.dependencies[0] = { template: audit.template, capability: ref("audit-runtime", "v2") };
    expect(() => compileBackendPlan(design, lookup, { mode: "complete" })).toThrow(
      BackendCompilationError,
    );
  });

  it("blocks incompatible options, stores and exact versions while preserving inspectable IR", () => {
    for (const mutate of [
      (d: DesignDocument) => {
        need(irModel(d).effects?.[0]).delivery.attempts = 6;
      },
      (d: DesignDocument) => {
        need(irModel(d).operations?.[0]).transaction.store = "api";
      },
      (d: DesignDocument) => {
        need(irModel(d).operations?.[0]).aggregate.version = "missing";
      },
    ]) {
      const { design, lookup } = backendCompileFixture();
      mutate(design);
      const plan = planBackend(design, lookup, { mode: "complete" });
      expect(plan.ready).toBe(false);
      expect(plan.ir?.operationAdapters).toHaveLength(1);
      expect(plan.snapshot.design).toEqual(design);
      expect(() => compileBackendPlan(design, lookup, { mode: "complete" })).toThrow(
        BackendCompilationError,
      );
    }
  });

  it("produces identical semantic IR/source maps after display renames and irrelevant permutations", () => {
    const { design, lookup } = backendCompileFixture(true),
      original = planBackend(design, lookup, { mode: "foundation" });
    const m = irModel(design),
      a = need(design.architecture);
    design.elements.reverse();
    design.connections.reverse();
    for (const e of design.elements) e.name = "Renamed host";
    for (const c of design.connections) if (c.planned) c.planned.label = "Renamed relationship";
    for (const collection of [
      a.components,
      a.contracts,
      a.bindings,
      a.datasets,
      a.interfaces,
      m.entities,
      m.aggregates,
      m.operations,
      m.hooks,
      m.effects,
      m.implementations,
      m.lifecycles,
      m.capabilityConfigs,
    ]) {
      collection?.reverse();
      for (const v of collection ?? []) if ("name" in v) v.name = "Renamed declaration";
    }
    for (const c of a.contracts ?? []) {
      c.shape?.payload.reverse();
      for (const f of c.shape?.payload ?? []) f.name = `Renamed ${f.name}`;
      for (const o of c.shape?.operations ?? []) {
        o.name = "Renamed operation";
        o.input.reverse();
        o.outcomes?.reverse();
        o.transport?.responses.reverse();
      }
    }
    const op = need(m.operations?.[0]);
    op.transaction.participants.reverse();
    op.outcomes.reverse();
    need(m.hooks?.[0]).context.reverse();
    need(m.effects?.[0]).recovery.reverse();
    const permuted = planBackend(design, lookup, { mode: "foundation" });
    expect(permuted.blockingFindings).toEqual([]);
    expect(permuted.blockingDiagnostics).toEqual([]);
    expect(permuted.ready).toBe(true);
    expect(permuted.ir).toEqual(original.ir);
    expect(permuted.sourceMap).toEqual(original.sourceMap);
    expect(permuted.snapshot.design).not.toEqual(original.snapshot.design);
  });

  it("maps every lowered responsibility, accounts all exact obligations and freezes detached outputs", () => {
    const { design, lookup } = backendCompileFixture(true),
      plan = planBackend(design, lookup, { mode: "foundation" });
    const responsibilities: { id: string; source: unknown }[] = [];
    const walk = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if ("id" in v && "source" in v && "name" in v)
        responsibilities.push(v as { id: string; source: unknown });
      for (const child of Object.values(v)) walk(child);
    };
    walk(plan.ir);
    expect(plan.sourceMap).toHaveLength(responsibilities.length);
    for (const r of responsibilities)
      expect(plan.sourceMap.find((s) => s.output === r.id)?.source).toEqual(r.source);
    expect(plan.sourceMap.every((s) => s.source.path.every((p) => typeof p === "string"))).toBe(
      true,
    );
    expect(Object.isFrozen(plan.ir?.operationAdapters[0]?.intent.actions)).toBe(true);
    expect(() => Object.assign(need(plan.ir?.effects[0]), { operation: "changed" })).toThrow(
      TypeError,
    );
    expect(Object.isFrozen(lookup.get(ref("ir-module", "1.0.0"))?.capabilities)).toBe(false);
    const json = backendPlanJson(plan),
      text = backendPlanText(plan);
    expect(JSON.parse(json)).toEqual(plan);
    expect(JSON.parse(text.slice(text.indexOf("\n\n") + 2))).toEqual(plan);
    need(irModel(design).operations).length = 0;
    expect(backendPlanJson(plan)).toBe(json);
  });

  it("dispatches only opted-in designs with explicit modes and guards legacy emission", () => {
    const { design, lookup } = backendCompileFixture();
    const modules = templateSet([]);
    modules.lookup = lookup;
    const routed = planGeneration(design, modules, {
      projectName: "Pure plan",
      backendMode: "complete",
    });
    expect(routed.path).toBe("backend-plan");
    if (routed.path === "backend-plan") expect(routed.plan.ready).toBe(true);
    expect(() => planGeneration(design, modules, { projectName: "No implicit mode" })).toThrow(
      "explicit",
    );
    expect(() => planProject(design, modules, { projectName: "No emission" })).toThrow(
      GenerationError,
    );
    expect(planBackend(design, lookup, { mode: "analysis" })).toMatchObject({
      ready: false,
      enabled: true,
      mode: "analysis",
    });
    const templates = templateSet();
    for (const name of ["link-shortener", "resources", "resource-workspace", "event-orders"]) {
      const legacy = fixtureDesign(name),
        before = JSON.stringify(legacy),
        options = { projectName: "Compatibility" };
      const previous = JSON.stringify(planProject(legacy, templates, options));
      const dispatched = planGeneration(legacy, templates, options);
      expect(dispatched.path).toBe("legacy");
      expect(JSON.stringify(dispatched.plan)).toBe(previous);
      expect(JSON.stringify(legacy)).toBe(before);
      expect(planBackend(legacy, templates.lookup, { mode: "analysis" })).toMatchObject({
        enabled: false,
        ready: false,
      });
      expect(() =>
        planGeneration(legacy, templates, { ...options, backendMode: "complete" }),
      ).toThrow("opted-in");
    }
  });
});
